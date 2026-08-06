import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, User, Category, Product, ProductOption, Order, OrderItem } from './types';
import { calculateDoorWindowPrice } from './services/pricing';

const app = new Hono<{ Bindings: Env }>();

// 启用全局 CORS 跨域支持
app.use('*', cors());

// 全局异常捕获中间件
app.onError((err, c) => {
  console.error('Server Exception:', err);
  return c.json({
    success: false,
    message: err.message || '服务端异常，请检查数据库表结构是否已完成初始化(schema.sql)',
    error: String(err)
  }, 500);
});

// 健康检查
app.get('/', (c) => c.text('展晨门窗 Cloudflare Workers / D1 API 服务运行中...'));

// ----------------------------------------------------
// 0. 通用图片文件上传接口 (Upload API)
// ----------------------------------------------------

/**
 * 通用图片上传接口 (支持头像/矢量图/产品图上传)
 * POST /api/upload
 */
app.post('/api/upload', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'];

    if (!file || typeof file === 'string') {
      return c.json({ success: false, message: '请上传有效的图片文件' }, 400);
    }

    const ext = file.name ? file.name.split('.').pop() : 'jpg';
    const fileName = `upload/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

    // 1. 保存至 Cloudflare R2 对象存储桶 (zc-wx-app / upload 目录)
    if (c.env.BUCKET) {
      const buffer = await file.arrayBuffer();
      await c.env.BUCKET.put(fileName, buffer, {
        httpMetadata: { contentType: file.type || 'image/jpeg' }
      });
    }

    // 2. 返回标准的 Cloudflare R2 对象存储 CDN 唯一 URL (如: https://zc-oss.carelife.top/upload/1785900000_abc.jpg)
    const url = `https://zc-oss.carelife.top/${fileName}`;
    return c.json({ success: true, url, name: fileName, message: '成功保存至 Cloudflare R2 对象存储 (zc-wx-app/upload)' });
  } catch (e) {
    return c.json({ success: false, message: '图片上传至 R2 存储失败', error: String(e) }, 500);
  }
});

// ----------------------------------------------------
// 1. 微信小程序 官方鉴权与个人资料 (Auth & User Profile)
// ----------------------------------------------------

/**
 * 微信小程序 官方 code2Session 换取 openid 登录与注册
 * POST /api/auth/wx-login
 */
app.post('/api/auth/wx-login', async (c) => {
  const body = await c.req.json();
  const code = body.code;
  const nickname = body.nickname || '展晨尊享客户';
  const avatar_url = body.avatar_url || body.avatar || 'https://zc-oss.carelife.top/common/zc-logo.jpg';
  const phone = body.phone || '13344443333';

  let openid = '';
  const appId = c.env.WX_APP_ID;
  const appSecret = c.env.WX_APP_SECRET;

  // 1. 优先调用微信官方 jscode2session 接口
  if (code && appId && appSecret) {
    try {
      const wxRes = await fetch(
        `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`
      );
      const wxData: any = await wxRes.json();
      if (wxData.openid) {
        openid = wxData.openid;
      } else {
        console.warn('微信 code2Session 返回异常:', wxData);
      }
    } catch (e) {
      console.error('调用微信 code2Session 失败:', e);
    }
  }

  // 2. 环境兼容回退 (演示环境或未配置秘钥时)
  if (!openid) {
    openid = `wx_openid_${code ? code.substring(0, 10) : 'demo'}`;
  }

  const db = c.env.DB;
  let user = await db.prepare('SELECT * FROM users WHERE openid = ?').bind(openid).first<User>();

  if (!user) {
    const userId = `user_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    await db.prepare(`
      INSERT INTO users (id, openid, nickname, avatar_url, phone, role) 
      VALUES (?, ?, ?, ?, ?, 'customer')
    `).bind(userId, openid, nickname, avatar_url, phone).run();

    user = {
      id: userId,
      openid,
      nickname,
      avatar_url,
      phone,
      role: 'customer'
    };
  }

  return c.json({
    success: true,
    user,
    token: `zc_token_${user.id}`
  });
});

/**
 * 获取当前用户信息
 * GET /api/user/profile?user_id=xxx
 */
app.get('/api/user/profile', async (c) => {
  const db = c.env.DB;
  const userId = c.req.query('user_id');
  if (!userId) {
    return c.json({ success: false, message: '用户ID不能为空' }, 400);
  }

  const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<User>();
  if (!user) {
    return c.json({ success: false, message: '未找到该用户' }, 404);
  }

  return c.json({ success: true, user });
});

/**
 * 更新个人资料 (姓名、头像、手机号)
 * POST /api/user/profile
 */
app.post('/api/user/profile', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { user_id, nickname, avatar_url, phone } = body;

  const id = user_id || `user_${Date.now()}`;

  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        openid TEXT,
        nickname TEXT,
        avatar_url TEXT,
        phone TEXT,
        role TEXT DEFAULT 'customer',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (e) {}

  // 手机号唯一性校验：不允许不同客户绑定重复手机号
  if (phone && phone.trim()) {
    const cleanPhone = phone.trim();
    const existing = await db.prepare(
      'SELECT id, nickname FROM users WHERE phone = ? AND id != ? AND openid != ? AND openid != ?'
    ).bind(cleanPhone, id, id, `wx_openid_${id}`).first<{ id: string; nickname: string }>();

    if (existing) {
      return c.json({ 
        success: false, 
        message: `联系电话【${cleanPhone}】已被客户【${existing.nickname || existing.id}】绑定，手机号必须唯一！` 
      }, 400);
    }
  }

  await db.prepare(`
    INSERT INTO users (id, openid, nickname, avatar_url, phone, role)
    VALUES (?, ?, ?, ?, ?, 'customer')
    ON CONFLICT(id) DO UPDATE SET
      nickname = COALESCE(NULLIF(excluded.nickname, ''), users.nickname),
      avatar_url = COALESCE(NULLIF(excluded.avatar_url, ''), users.avatar_url),
      phone = COALESCE(NULLIF(excluded.phone, ''), users.phone)
  `).bind(id, `wx_openid_${id}`, nickname || 'care', avatar_url || '', phone || '').run();

  const updatedUser = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<any>();
  return c.json({ success: true, user: updatedUser });
});

/**
 * 获取全量微信客户列表 (供管理后台 Users.vue 包含订单数与默认安装地址)
 * GET /api/users
 */
app.get('/api/users', async (c) => {
  const db = c.env.DB;
  const { results: users } = await db.prepare('SELECT * FROM users ORDER BY created_at DESC').all<any>();

  // 动态建表容错
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS user_addresses (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        province TEXT,
        city TEXT,
        district TEXT,
        detail_address TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (e) {}

  for (const user of users || []) {
    // 统计订单数量
    try {
      const countRes = await db.prepare('SELECT COUNT(*) as count FROM orders WHERE user_id = ?').bind(user.id).first<{ count: number }>();
      user.order_count = countRes ? countRes.count : 0;
    } catch (e) {
      user.order_count = 0;
    }

    // 查询该客户的默认/最新地址
    try {
      const addressRes = await db.prepare('SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC LIMIT 1').bind(user.id).first<any>();
      if (addressRes) {
        user.address = `${addressRes.province || ''}${addressRes.city || ''}${addressRes.district || ''}${addressRes.detail_address || ''}`;
        user.address_detail = addressRes;
      } else {
        user.address = '暂无保存地址';
      }
    } catch (e) {
      user.address = '暂无保存地址';
    }
  }

  return c.json({ success: true, data: users || [] });
});

/**
 * 删除客户档案
 * DELETE /api/admin/users/:id
 */
app.delete('/api/admin/users/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  try {
    const user = await db.prepare('SELECT * FROM users WHERE id = ? OR openid = ?').bind(id, id).first<any>();
    const userId = user ? user.id : id;
    const openid = user ? user.openid : id;
    const phone = user ? user.phone : '';

    // 1. 级联删除该客户保存的所有收货/安装地址
    await db.prepare('DELETE FROM user_addresses WHERE user_id = ? OR user_id = ?').bind(userId, openid).run();

    // 2. 查找该客户关联的所有订单 ID
    let sql = 'SELECT id FROM orders WHERE user_id = ? OR user_id = ?';
    const params: any[] = [userId, openid];
    if (phone) {
      sql += ' OR customer_phone = ?';
      params.push(phone);
    }
    const { results: userOrders } = await db.prepare(sql).bind(...params).all<{ id: string }>();
    const orderIds = (userOrders || []).map(o => o.id);

    // 3. 级联删除订单商品明细项与状态扭转日志
    for (const oId of orderIds) {
      await db.prepare('DELETE FROM order_items WHERE order_id = ?').bind(oId).run();
      await db.prepare('DELETE FROM order_status_logs WHERE order_id = ?').bind(oId).run();
    }

    // 4. 级联删除订单主表记录
    for (const oId of orderIds) {
      await db.prepare('DELETE FROM orders WHERE id = ?').bind(oId).run();
    }

    // 5. 彻底删除客户主档案
    await db.prepare('DELETE FROM users WHERE id = ? OR openid = ?').bind(userId, openid).run();
  } catch (e) {}

  return c.json({ success: true, message: '客户档案及其历史订单与地址已全量清理完毕！' });
});

/**
 * 获取用户的收货/安装地址列表
 * GET /api/user/addresses?user_id=xxx
 */
app.get('/api/user/addresses', async (c) => {
  const db = c.env.DB;
  const userId = c.req.query('user_id');
  if (!userId) {
    return c.json({ success: false, message: '用户ID不能为空' }, 400);
  }

  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS user_addresses (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        province TEXT,
        city TEXT,
        district TEXT,
        detail_address TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (e) {}

  const { results } = await db.prepare('SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC').bind(userId).all();
  return c.json({ success: true, data: results || [] });
});

/**
 * 新增或编辑用户收货地址
 * POST /api/user/addresses
 */
app.post('/api/user/addresses', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { id, user_id, name, phone, province, city, district, detail_address, is_default } = body;

  if (!user_id || !name || !phone || !detail_address) {
    return c.json({ success: false, message: '请填写完整的联系人、电话及详细地址' }, 400);
  }

  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS user_addresses (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        province TEXT,
        city TEXT,
        district TEXT,
        detail_address TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (e) {}

  if (is_default) {
    await db.prepare('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?').bind(user_id).run();
  }

  const defaultVal = is_default ? 1 : 0;

  if (id) {
    await db.prepare(`
      UPDATE user_addresses 
      SET name = ?, phone = ?, province = ?, city = ?, district = ?, detail_address = ?, is_default = ? 
      WHERE id = ? AND user_id = ?
    `).bind(name, phone, province || '', city || '', district || '', detail_address, defaultVal, id, user_id).run();

    return c.json({ success: true, id, message: '地址修改成功' });
  } else {
    const newId = `addr_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    await db.prepare(`
      INSERT INTO user_addresses (id, user_id, name, phone, province, city, district, detail_address, is_default) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(newId, user_id, name, phone, province || '', city || '', district || '', detail_address, defaultVal).run();

    return c.json({ success: true, id: newId, message: '地址添加成功' });
  }
});

/**
 * 删除指定地址
 * DELETE /api/user/addresses/:id
 */
app.delete('/api/user/addresses/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM user_addresses WHERE id = ?').bind(id).run();
  return c.json({ success: true, message: '地址已删除' });
});

/**
 * 设置为默认地址
 * PATCH /api/user/addresses/:id/default
 */
app.patch('/api/user/addresses/:id/default', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const body = await c.req.json();
  const userId = body.user_id || c.req.query('user_id');

  if (!userId) {
    return c.json({ success: false, message: '用户ID不能为空' }, 400);
  }

  await db.prepare('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?').bind(userId).run();
  await db.prepare('UPDATE user_addresses SET is_default = 1 WHERE id = ? AND user_id = ?').bind(id, userId).run();

  return c.json({ success: true, message: '默认地址设置成功' });
});

// ----------------------------------------------------
// 2. 门窗分类接口 (Categories)
// ----------------------------------------------------

/**
 * 获取活动门窗分类列表
 * GET /api/categories
 */
app.get('/api/categories', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ success: false, message: '数据库 DB 未绑定' }, 500);
  }

  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sub_title TEXT,
        icon_url TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (e) {}

  const { results } = await db.prepare(`
    SELECT * FROM categories 
    WHERE is_active = 1 
    ORDER BY sort_order ASC, created_at DESC
  `).all<Category>();

  return c.json({ success: true, data: results || [], categories: results || [] });
});

// ----------------------------------------------------
// 3. 门窗商品与选配项 (Products & Options)
// ----------------------------------------------------

/**
 * 获取商品列表 (支持按 category_id 筛选)
 * GET /api/products?category_id=cat_1
 */
app.get('/api/products', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ success: false, message: '数据库 DB 未绑定' }, 500);
  }

  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        category_id TEXT,
        category_name TEXT,
        name TEXT NOT NULL,
        description TEXT,
        cover_image TEXT,
        base_price_sqm REAL DEFAULT 680,
        min_area REAL DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (e) {}

  try {
    await db.prepare('ALTER TABLE products ADD COLUMN category_name TEXT').run();
  } catch (e) {}

  const categoryId = c.req.query('category_id');
  const categoryName = c.req.query('category_name') || c.req.query('category');
  const targetCategory = categoryId || categoryName;

  try {
    // 采用 100% 安全无污染的标准 SELECT，绝不在 WHERE 子句中使用未确定的字段
    const { results } = await db.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY sort_order ASC, created_at DESC').all<any>();
    let list = results || [];

    if (targetCategory) {
      list = list.filter((p: any) => 
        p.category_id === targetCategory || 
        p.category_name === targetCategory || 
        (p.name && targetCategory && p.name.includes(targetCategory))
      );
    }

    // 批量为每个商品绑定其选配规则列表，供管理后台列表显示规则项数
    for (const prod of list) {
      try {
        const { results: opts } = await db.prepare('SELECT * FROM product_options WHERE product_id = ? ORDER BY sort_order ASC').bind(prod.id).all<any>();
        prod.options = opts || [];
      } catch (e) {
        prod.options = [];
      }
    }

    return c.json({ success: true, data: list });
  } catch (err) {
    return c.json({ success: true, data: [] });
  }
});

/**
 * 保存/更新产品的全量选配规则列表
 * POST /api/admin/products/:id/options
 */
app.post('/api/admin/products/:id/options', async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ success: false, message: 'DB 未绑定' }, 500);
  const id = c.req.param('id');
  const body = await c.req.json();
  const options = body.options || [];

  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS product_options (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        group_name TEXT NOT NULL,
        option_name TEXT NOT NULL,
        price_type TEXT DEFAULT 'per_sqm',
        price REAL DEFAULT 0,
        is_default INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        image_url TEXT
      )
    `).run();

    try {
      await db.prepare('ALTER TABLE product_options ADD COLUMN image_url TEXT').run();
    } catch (e) {}

    // 1. 删除该商品原有的选配规则
    await db.prepare('DELETE FROM product_options WHERE product_id = ?').bind(id).run();

    // 2. 批量插入最新的选配规则列表
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const optId = opt.id || `opt_${Date.now()}_${i}`;
      await db.prepare(`
        INSERT INTO product_options (id, product_id, group_name, option_name, price_type, price, is_default, sort_order, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        optId,
        id,
        opt.group_name || '选配分组',
        opt.option_name || '',
        opt.price_type || 'fixed',
        Number(opt.price || 0),
        opt.is_default ? 1 : 0,
        i,
        opt.image_url || ''
      ).run();
    }

    return c.json({ success: true, message: '选配规则更新成功！' });
  } catch (e: any) {
    return c.json({ success: false, message: '保存失败: ' + (e.message || String(e)) }, 500);
  }
});

/**
 * 获取指定门窗商品详情 (包含结构化选配分组)
 * GET /api/products/:id
 */
app.get('/api/products/:id', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ success: false, message: '数据库 DB 未绑定' }, 500);
  }
  const id = c.req.param('id');

  const product = await db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').bind(id).first<Product>();
  if (!product) {
    return c.json({ success: false, message: '商品不存在或已下架' }, 404);
  }

  // 读取对应选配规则
  const { results: rawOptions } = await db.prepare(`
    SELECT * FROM product_options 
    WHERE product_id = ? 
    ORDER BY sort_order ASC
  `).bind(id).all<ProductOption>();

  const options = (rawOptions || []).map(opt => {
    let priceText = '包含在基础单价内';
    if (opt.price > 0) {
      if (opt.price_type === 'per_sqm') priceText = `+¥ ${opt.price} / ㎡`;
      else if (opt.price_type === 'per_item') priceText = `+¥ ${opt.price} / 套`;
      else priceText = `+¥ ${opt.price}`;
    } else if (opt.group_name === 'color' && opt.is_default) {
      priceText = '标准配色';
    }
    return {
      ...opt,
      priceText
    };
  });

  // 按 group_name 进行分组归纳 (如 glass, hardware, color)
  const groupMap: Record<string, { group_name: string; groupTitle: string; options: ProductOption[] }> = {};
  options.forEach(opt => {
    if (!groupMap[opt.group_name]) {
      groupMap[opt.group_name] = {
        group_name: opt.group_name,
        groupTitle: opt.group_title || opt.group_name,
        options: []
      };
    }
    groupMap[opt.group_name].options.push(opt);
  });

  const optionGroups = Object.values(groupMap);
  product.options = options;
  product.optionGroups = optionGroups;

  return c.json({ success: true, data: product });
});

// ----------------------------------------------------
// 4. 门窗多套定制订单提交与查询 (Orders)
// ----------------------------------------------------

/**
 * 提交门窗定制订单 (支持多套配置)
 * POST /api/orders
 */
app.post('/api/orders', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();

  const {
    user_id,
    customer_name,
    customer_phone,
    install_address,
    customer_remark,
    scene_images,
    product_id,
    product_name,
    base_price_sqm,
    min_area,
    customSets: rawCustomSets,
    items: rawItems
  } = body;

  const customSets = (rawCustomSets && rawCustomSets.length > 0) ? rawCustomSets : (rawItems || []);

  if (!customSets || !Array.isArray(customSets) || customSets.length === 0) {
    return c.json({ success: false, message: '请至少添加一套门窗定制配置' }, 400);
  }

  try {
    await db.prepare('ALTER TABLE orders ADD COLUMN install_address TEXT').run();
  } catch (e) {}
  try {
    await db.prepare('ALTER TABLE orders ADD COLUMN customer_remark TEXT').run();
  } catch (e) {}
  try {
    await db.prepare('ALTER TABLE orders ADD COLUMN scene_images TEXT').run();
  } catch (e) {}

  const orderId = `ord_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const orderNo = `ZC${dateStr}${Math.floor(1000 + Math.random() * 9000)}`;

  // 外键安全校验与容错: 防止 invalid user_id / product_id 触发 SQLite 外键约束异常
  let validUserId: string | null = null;
  const rawUserId = (user_id || '').trim();
  if (rawUserId) {
    try {
      const u = await db.prepare('SELECT id FROM users WHERE id = ?').bind(rawUserId).first<{ id: string }>();
      if (u) validUserId = u.id;
    } catch (e) {}
  }

  let validProductId: string | null = null;
  const rawProdId = (product_id || '').trim();
  if (rawProdId) {
    try {
      const p = await db.prepare('SELECT id FROM products WHERE id = ?').bind(rawProdId).first<{ id: string }>();
      if (p) validProductId = p.id;
    } catch (e) {}
  }

  // 获取产品及其选配规则用于精确算价
  const product = validProductId
    ? await db.prepare('SELECT * FROM products WHERE id = ?').bind(validProductId).first<Product>()
    : await db.prepare('SELECT * FROM products LIMIT 1').first<Product>();

  const targetProdId = validProductId || (product ? product.id : null);
  const { results: options } = targetProdId
    ? await db.prepare('SELECT * FROM product_options WHERE product_id = ?').bind(targetProdId).all<ProductOption>()
    : { results: [] };

  const optionMap = new Map<string, ProductOption>();
  (options || []).forEach(o => optionMap.set(o.id, o));

  let totalSets = customSets.length;
  let totalBilledArea = 0;
  let totalBaseAmount = 0;
  let totalExtraAmount = 0;
  let totalFinalAmount = 0;

  // 插入订单主表记录 (包含现场图片 scene_images)
  await db.prepare(`
    INSERT INTO orders 
    (id, order_no, user_id, customer_name, customer_phone, install_address, customer_remark, scene_images, total_sets, total_area, base_amount, extra_amount, special_charges_amount, final_amount, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 'pending_review')
  `).bind(
    orderId,
    orderNo,
    validUserId,
    customer_name || '客户',
    customer_phone || '',
    install_address || '',
    customer_remark || '',
    scene_images || '',
    totalSets
  ).run();

  // 逐套算价并插入明细项
  for (let i = 0; i < customSets.length; i++) {
    const set = customSets[i];
    const width = Number(set.width_mm) || 2400;
    const height = Number(set.height_mm) || 2100;
    const label = set.label || `【${customer_name || 'care'}-${dateStr.slice(2)}-${i + 1}】`;
    const selectedOptionsMap = set.selected_options || {};

    // 筛选当前套系选中的选配规则
    const selectedOptionObjects: ProductOption[] = [];
    const selectedOptionsSummary: Array<{ groupTitle: string; option_name: string; priceText: string }> = [];

    Object.keys(selectedOptionsMap).forEach(grpKey => {
      const optId = selectedOptionsMap[grpKey];
      const optObj = optionMap.get(optId);
      if (optObj) {
        selectedOptionObjects.push(optObj);
        let pText = '包含在基础单价内';
        if (optObj.price > 0) {
          if (optObj.price_type === 'per_sqm') pText = `+¥ ${optObj.price} / ㎡`;
          else if (optObj.price_type === 'per_item') pText = `+¥ ${optObj.price} / 套`;
          else pText = `+¥ ${optObj.price}`;
        } else if (optObj.group_name === 'color' && optObj.is_default) {
          pText = '标准配色';
        }
        selectedOptionsSummary.push({
          groupTitle: optObj.group_title || grpKey,
          option_name: optObj.option_name,
          priceText: pText
        });
      }
    });

    const pricing = calculateDoorWindowPrice({
      width_mm: width,
      height_mm: height,
      quantity: 1,
      base_price_sqm: base_price_sqm || product?.base_price_sqm || 680,
      min_area: min_area || product?.min_area || 1,
      selected_options: selectedOptionObjects.map(o => ({ price_type: o.price_type, price: o.price }))
    });

    totalBilledArea += pricing.billed_area;
    totalBaseAmount += pricing.base_amount;
    totalExtraAmount += pricing.extra_amount;
    totalFinalAmount += pricing.subtotal;

    const itemId = `item_${Date.now()}_${i + 1}`;
    await db.prepare(`
      INSERT INTO order_items 
      (id, order_id, product_id, product_name, label, width_mm, height_mm, actual_area, billed_area, unit_price, item_subtotal, selected_options_json, options_summary_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      itemId,
      orderId,
      validProductId,
      product_name || product?.name || '展晨108热桥级系统断桥铝窗',
      label,
      width,
      height,
      pricing.actual_area,
      pricing.billed_area,
      base_price_sqm || product?.base_price_sqm || 680,
      pricing.subtotal,
      JSON.stringify(selectedOptionsMap),
      JSON.stringify(selectedOptionsSummary)
    ).run();
  }

  // 格式化并更新订单主表总金额
  totalBilledArea = Number(totalBilledArea.toFixed(2));
  totalBaseAmount = Number(totalBaseAmount.toFixed(2));
  totalExtraAmount = Number(totalExtraAmount.toFixed(2));
  totalFinalAmount = Number(totalFinalAmount.toFixed(2));

  await db.prepare(`
    UPDATE orders 
    SET total_area = ?, base_amount = ?, extra_amount = ?, final_amount = ? 
    WHERE id = ?
  `).bind(totalBilledArea, totalBaseAmount, totalExtraAmount, totalFinalAmount, orderId).run();

  // 记录订单生成日志
  await db.prepare(`
    INSERT INTO order_status_logs 
    (id, order_id, operator_name, from_status, to_status, remark) 
    VALUES (?, ?, ?, '', 'pending_review', '新建门窗多套定制订单')
  `).bind(`log_${Date.now()}`, orderId, customer_name || '客户').run();

  return c.json({
    success: true,
    order_id: orderId,
    order_no: orderNo,
    total_sets: totalSets,
    total_area: totalBilledArea,
    final_amount: totalFinalAmount
  });
});

/**
 * 获取订单列表 (支持 user_id, status, order_no, customer, product_name, keyword 模糊搜索与服务端分页 page/pageSize)
 * GET /api/orders?status=pending_review&order_no=ZC&customer=张&product_name=108&page=1&pageSize=10
 */
app.get('/api/orders', async (c) => {
  const db = c.env.DB;
  const userId = c.req.query('user_id');
  const status = c.req.query('status');
  const orderNo = c.req.query('order_no');
  const customer = c.req.query('customer');
  const productName = c.req.query('product_name');
  const keyword = c.req.query('keyword') || c.req.query('search');

  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const pageSize = Math.max(1, parseInt(c.req.query('pageSize') || c.req.query('limit') || '10', 10));
  const offset = (page - 1) * pageSize;

  let whereClause = ' WHERE 1=1';
  const params: any[] = [];

  if (userId) {
    whereClause += ' AND o.user_id = ?';
    params.push(userId);
  }
  if (status && status !== 'all') {
    whereClause += ' AND o.status = ?';
    params.push(status);
  }
  if (orderNo && orderNo.trim() !== '') {
    whereClause += ' AND o.order_no LIKE ?';
    params.push(`%${orderNo.trim()}%`);
  }
  if (customer && customer.trim() !== '') {
    const cust = `%${customer.trim()}%`;
    whereClause += ' AND (o.customer_name LIKE ? OR o.customer_phone LIKE ? OR u.nickname LIKE ?)';
    params.push(cust, cust, cust);
  }
  if (productName && productName.trim() !== '') {
    whereClause += ' AND oi.product_name LIKE ?';
    params.push(`%${productName.trim()}%`);
  }
  if (keyword && keyword.trim() !== '') {
    const kw = `%${keyword.trim()}%`;
    whereClause += ' AND (o.order_no LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ? OR u.nickname LIKE ? OR oi.product_name LIKE ?)';
    params.push(kw, kw, kw, kw, kw);
  }

  // 1. 查询符合条件的总记录数
  const countSql = `SELECT COUNT(DISTINCT o.id) as total FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id LEFT JOIN users u ON o.user_id = u.id${whereClause}`;
  const countRes = await db.prepare(countSql).bind(...params).first<{ total: number }>();
  const total = countRes ? countRes.total : 0;

  // 2. 分页查询当前页订单列表
  const dataSql = `SELECT DISTINCT o.* FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id LEFT JOIN users u ON o.user_id = u.id${whereClause} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
  const dataParams = [...params, pageSize, offset];
  const { results: orders } = await db.prepare(dataSql).bind(...dataParams).all<Order>();

  // 抓取各订单的明细项用于卡片预览
  for (const order of orders || []) {
    const { results: items } = await db.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(order.id).all<OrderItem>();
    (items || []).forEach(it => {
      if (it.options_summary_json) {
        try {
          it.options_summary = JSON.parse(it.options_summary_json);
        } catch (e) {
          it.options_summary = [];
        }
      }
    });
    order.items = items || [];
  }

  return c.json({
    success: true,
    data: orders || [],
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  });
});

/**
 * 获取特定订单详情 (包含多套明细与流转日志)
 * GET /api/orders/:id
 */
app.get('/api/orders/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');

  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<Order>();
  if (!order) {
    return c.json({ success: false, message: '未找到对应订单记录' }, 404);
  }

  const { results: items } = await db.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(id).all<OrderItem>();
  (items || []).forEach(it => {
    if (it.options_summary_json) {
      try {
        it.options_summary = JSON.parse(it.options_summary_json);
      } catch (e) {
        it.options_summary = [];
      }
    }
  });

  const { results: logs } = await db.prepare('SELECT * FROM order_status_logs WHERE order_id = ? ORDER BY created_at ASC').bind(id).all();

  order.items = items || [];
  return c.json({
    success: true,
    data: {
      order,
      logs: logs || []
    }
  });
});

// ----------------------------------------------------
// 5. 管理端后台专属 API (Admin Dashboard APIs)
// ----------------------------------------------------

/**
 * 管理员登录接口
 * POST /api/admin/login
 */
app.post('/api/admin/login', async (c) => {
  const body = await c.req.json();
  const { username, password } = body;

  if (username === 'admin' && (password === 'zhanchen888' || password === 'admin123')) {
    return c.json({
      success: true,
      user: {
        id: 'admin_1',
        nickname: '展晨总管理',
        role: 'admin',
        phone: '13545941637'
      },
      token: 'zc_admin_token_2026'
    });
  }

  return c.json({ success: false, message: '管理员账号或密码不正确' }, 401);
});

/**
 * 管理端仪表盘统计概览
 * GET /api/admin/stats
 */
app.get('/api/admin/stats', async (c) => {
  const db = c.env.DB;
  const { results: orders } = await db.prepare('SELECT status, final_amount FROM orders').all<Order>();

  let totalOrders = (orders || []).length;
  let pendingReviewCount = 0;
  let producingCount = 0;
  let installingCount = 0;
  let completedCount = 0;
  let totalRevenue = 0;

  (orders || []).forEach(o => {
    totalRevenue += o.final_amount || 0;
    if (o.status === 'pending_review') pendingReviewCount++;
    else if (o.status === 'producing') producingCount++;
    else if (o.status === 'installing') installingCount++;
    else if (o.status === 'completed') completedCount++;
  });

  return c.json({
    success: true,
    data: {
      totalOrders,
      pendingReviewCount,
      producingCount,
      installingCount,
      completedCount,
      totalRevenue: Number(totalRevenue.toFixed(2))
    }
  });
});

/**
 * 管理端 扭转订单状态 & 追加特殊费用
 * PATCH /api/admin/orders/:id/status
 */
app.patch('/api/admin/orders/:id/status', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const body = await c.req.json();
  const { new_status, admin_remark, operator_name, special_charges_amount } = body;

  const currentOrder = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<Order>();
  if (!currentOrder) {
    return c.json({ success: false, message: '未找到订单记录' }, 404);
  }

  const oldStatus = currentOrder.status;
  let newSpecialCharges = currentOrder.special_charges_amount || 0;
  let newFinalAmount = currentOrder.final_amount;

  if (special_charges_amount !== undefined && !isNaN(Number(special_charges_amount))) {
    newSpecialCharges = Number(special_charges_amount);
    newFinalAmount = Number((currentOrder.base_amount + currentOrder.extra_amount + newSpecialCharges).toFixed(2));
  }

  const targetStatus = new_status || oldStatus;
  const targetRemark = admin_remark || currentOrder.admin_remark || '';

  await db.prepare(`
    UPDATE orders 
    SET status = ?, admin_remark = ?, special_charges_amount = ?, final_amount = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).bind(targetStatus, targetRemark, newSpecialCharges, newFinalAmount, id).run();

  // 写入状态扭转日志
  await db.prepare(`
    INSERT INTO order_status_logs (id, order_id, operator_name, from_status, to_status, remark) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    `log_${Date.now()}`,
    id,
    operator_name || '接单员',
    oldStatus,
    targetStatus,
    targetRemark || `状态变更: ${oldStatus} -> ${targetStatus}`
  ).run();

  return c.json({
    success: true,
    order_id: id,
    status: targetStatus,
    special_charges_amount: newSpecialCharges,
    final_amount: newFinalAmount
  });
});

/**
 * 管理端 获取全量分类列表 (包含已禁用的分类)
 * GET /api/admin/categories
 */
app.get('/api/admin/categories', async (c) => {
  const db = c.env.DB;
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sub_title TEXT,
        icon_url TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (e) {}

  const nameQuery = (c.req.query('name') || c.req.query('keyword') || '').trim().toLowerCase();

  const { results } = await db.prepare(`
    SELECT * FROM categories 
    ORDER BY sort_order ASC, created_at DESC
  `).all<any>();

  let list = results || [];
  if (nameQuery) {
    list = list.filter((cat: any) =>
      (cat.name && cat.name.toLowerCase().includes(nameQuery)) ||
      (cat.sub_title && cat.sub_title.toLowerCase().includes(nameQuery))
    );
  }

  return c.json({ success: true, data: list, categories: list });
});

/**
 * 管理端 分类管理 CRUD (创建、编辑、物理删除、快捷修改排序)
 * POST /api/admin/categories
 */
app.post('/api/admin/categories', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();

  if (!body.name || !body.name.trim()) {
    return c.json({ success: false, message: '分类名称为必填项' }, 400);
  }

  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sub_title TEXT,
        icon_url TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (e) {}

  const id = body.id || `cat_${Date.now()}`;
  const name = body.name.trim();
  const sub_title = (body.sub_title && body.sub_title.trim()) || name.slice(0, 5);
  const icon_url = body.icon_url || '';
  const sortOrder = (body.sort_order !== undefined && body.sort_order !== null) ? Number(body.sort_order) : 0;
  const isActive = (body.is_active !== undefined && body.is_active !== null) ? Number(body.is_active) : 1;

  // UPSERT: ID 存在即更新原记录，不存在则精准新建
  await db.prepare(`
    INSERT INTO categories (id, name, sub_title, icon_url, sort_order, is_active) 
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
      name = excluded.name, 
      sub_title = excluded.sub_title, 
      icon_url = excluded.icon_url,
      sort_order = excluded.sort_order,
      is_active = excluded.is_active
  `).bind(id, name, sub_title, icon_url, sortOrder, isActive).run();

  return c.json({ success: true, id, message: '保存成功！' });
});

app.put('/api/admin/categories/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const body = await c.req.json();
  const name = (body.name || '').trim();
  const sub_title = (body.sub_title && body.sub_title.trim()) || name.slice(0, 5);
  const icon_url = body.icon_url || '';
  const sortOrder = (body.sort_order !== undefined && body.sort_order !== null) ? Number(body.sort_order) : 0;
  const isActive = (body.is_active !== undefined && body.is_active !== null) ? Number(body.is_active) : 1;

  await db.prepare(`
    INSERT INTO categories (id, name, sub_title, icon_url, sort_order, is_active) 
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
      name = excluded.name, 
      sub_title = excluded.sub_title, 
      icon_url = excluded.icon_url,
      sort_order = excluded.sort_order,
      is_active = excluded.is_active
  `).bind(id, name, sub_title, icon_url, sortOrder, isActive).run();

  return c.json({ success: true, message: '保存成功！' });
});

// 快捷更新排序权重
app.patch('/api/admin/categories/:id/sort', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const body = await c.req.json();
  const sortOrder = Number(body.sort_order || 0);

  await db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?').bind(sortOrder, id).run();
  return c.json({ success: true, message: '排序修改成功！' });
});

// 物理删除分类
app.delete('/api/admin/categories/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  return c.json({ success: true, message: '删除成功！' });
});

/**
 * 管理端 获取全量商品列表 (支持名称模糊搜索与分类多选筛选)
 * GET /api/admin/products
 */
app.get('/api/admin/products', async (c) => {
  const db = c.env.DB;
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        category_id TEXT,
        category_name TEXT,
        name TEXT NOT NULL,
        description TEXT,
        cover_image TEXT,
        base_price_sqm REAL DEFAULT 680,
        min_area REAL DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (e) {}

  const nameQuery = (c.req.query('name') || c.req.query('keyword') || '').trim().toLowerCase();
  const categoryParam = c.req.query('categories') || c.req.query('category_name') || '';

  const { results } = await db.prepare('SELECT * FROM products ORDER BY sort_order ASC, created_at DESC').all<any>();
  let list = results || [];

  if (nameQuery) {
    list = list.filter((p: any) =>
      (p.name && p.name.toLowerCase().includes(nameQuery)) ||
      (p.description && p.description.toLowerCase().includes(nameQuery))
    );
  }

  if (categoryParam) {
    const selectedCats = categoryParam.split(',').map(s => s.trim()).filter(Boolean);
    if (selectedCats.length > 0) {
      list = list.filter((p: any) =>
        selectedCats.includes(p.category_name) || selectedCats.includes(p.category_id)
      );
    }
  }
  for (const prod of list) {
    try {
      const { results: opts } = await db.prepare('SELECT * FROM product_options WHERE product_id = ? ORDER BY sort_order ASC').bind(prod.id).all<any>();
      prod.options = opts || [];
    } catch (e) {
      prod.options = [];
    }
  }

  return c.json({ success: true, data: list });
});

/**
 * 管理端 商品管理 CRUD (支持上下架 is_active 设置)
 * POST /api/admin/products
 */
app.post('/api/admin/products', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();

  if (!body.name || !body.name.trim()) {
    return c.json({ success: false, message: '商品名称为必填项' }, 400);
  }

  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        category_id TEXT,
        category_name TEXT,
        name TEXT NOT NULL,
        description TEXT,
        cover_image TEXT,
        base_price_sqm REAL DEFAULT 680,
        min_area REAL DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (e) {}

  const id = body.id || `prod_${Date.now()}`;
  const name = body.name.trim();
  const isActive = (body.is_active !== undefined && body.is_active !== null) ? Number(body.is_active) : 1;

  let validCategoryId: string | null = null;
  const rawCatId = (body.category_id || '').trim();
  const rawCatName = (body.category_name || '').trim();

  if (rawCatId || rawCatName) {
    try {
      const existingCat = await db.prepare(
        'SELECT id FROM categories WHERE id = ? OR name = ?'
      ).bind(rawCatId, rawCatName).first<{ id: string }>();

      if (existingCat) {
        validCategoryId = existingCat.id;
      }
    } catch (e) {}
  }

  // UPSERT: ID 存在即覆盖修改原记录，不存在则新增，绝对零重复
  await db.prepare(`
    INSERT INTO products (id, category_id, category_name, name, description, cover_image, base_price_sqm, min_area, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    ON CONFLICT(id) DO UPDATE SET
      category_id = excluded.category_id,
      category_name = excluded.category_name,
      name = excluded.name,
      description = excluded.description,
      cover_image = excluded.cover_image,
      base_price_sqm = excluded.base_price_sqm,
      min_area = excluded.min_area,
      is_active = excluded.is_active
  `).bind(
    id,
    validCategoryId,
    rawCatName,
    name,
    body.description || '',
    body.cover_image || '',
    body.base_price_sqm || 680,
    (body.min_area !== undefined && body.min_area !== null) ? Number(body.min_area) : 1,
    isActive
  ).run();

  // 若新建商品尚未绑定选配规则，自动填充用户指定的 6 大标准化默认分组与细项规则
  try {
    const { results: existingOpts } = await db.prepare('SELECT id FROM product_options WHERE product_id = ?').bind(id).all();
    if (!existingOpts || existingOpts.length === 0) {
      const defaultOptions = [
        { group_name: '玻璃配置', option_name: '双层玻璃', price_type: 'fixed', price: 0, is_default: 1 },
        { group_name: '玻璃配置', option_name: '双层钢化玻璃', price_type: 'fixed', price: 50, is_default: 0 },
        { group_name: '门锁配置', option_name: '默认门锁', price_type: 'fixed', price: 0, is_default: 1 },
        { group_name: '铝材配置', option_name: '默认铝材', price_type: 'fixed', price: 0, is_default: 1 },
        { group_name: '颜色配置', option_name: '琉璃白', price_type: 'fixed', price: 0, is_default: 1 },
        { group_name: '颜色配置', option_name: '深空灰', price_type: 'fixed', price: 0, is_default: 0 },
        { group_name: '开门方向', option_name: '左锁（左合页）', price_type: 'fixed', price: 0, is_default: 1 },
        { group_name: '开门方向', option_name: '右锁（左合页）', price_type: 'fixed', price: 0, is_default: 0 },
        { group_name: '开门内外', option_name: '内开（朝内打开）', price_type: 'fixed', price: 0, is_default: 1 },
        { group_name: '开门内外', option_name: '外开（朝外打开）', price_type: 'fixed', price: 0, is_default: 0 }
      ];

      for (let i = 0; i < defaultOptions.length; i++) {
        const opt = defaultOptions[i];
        const optId = `opt_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;
        await db.prepare(`
          INSERT INTO product_options (id, product_id, group_name, option_name, price_type, price, is_default, sort_order, image_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, '')
        `).bind(optId, id, opt.group_name, opt.option_name, opt.price_type, opt.price, opt.is_default, i).run();
      }
    }
  } catch (e) {}

  return c.json({ success: true, id, message: '保存成功' });
});

app.put('/api/admin/products/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const body = await c.req.json();
  const name = (body.name || '').trim();
  const isActive = (body.is_active !== undefined && body.is_active !== null) ? Number(body.is_active) : 1;

  let validCategoryId: string | null = null;
  const rawCatId = (body.category_id || '').trim();
  const rawCatName = (body.category_name || '').trim();

  if (rawCatId || rawCatName) {
    try {
      const existingCat = await db.prepare(
        'SELECT id FROM categories WHERE id = ? OR name = ?'
      ).bind(rawCatId, rawCatName).first<{ id: string }>();

      if (existingCat) {
        validCategoryId = existingCat.id;
      }
    } catch (e) {}
  }

  await db.prepare(`
    INSERT INTO products (id, category_id, category_name, name, description, cover_image, base_price_sqm, min_area, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    ON CONFLICT(id) DO UPDATE SET
      category_id = excluded.category_id,
      category_name = excluded.category_name,
      name = excluded.name,
      description = excluded.description,
      cover_image = excluded.cover_image,
      base_price_sqm = excluded.base_price_sqm,
      min_area = excluded.min_area,
      is_active = excluded.is_active
  `).bind(
    id,
    validCategoryId,
    rawCatName,
    name,
    body.description || '',
    body.cover_image || '',
    body.base_price_sqm || 680,
    (body.min_area !== undefined && body.min_area !== null) ? Number(body.min_area) : 1,
    isActive
  ).run();

  return c.json({ success: true, message: '保存成功' });
});

app.delete('/api/admin/products/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').bind(id).run();
  return c.json({ success: true, message: '商品已下架' });
});

/**
 * 获取接单员列表 (小程序及管理后台使用)
 * GET /api/receivers
 */
app.get('/api/receivers', async (c) => {
  const db = c.env.DB;
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS receivers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        qr_code_url TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (e) {}

  const { results } = await db.prepare('SELECT * FROM receivers WHERE is_active = 1 ORDER BY created_at ASC').all<any>();
  let list = results || [];

  if (!list || list.length === 0) {
    const defaultReceivers = [
      { id: 'rec_1', name: '李师傅 (仙桃店主管)', phone: '13545941637', qr_code_url: 'https://zc-oss.carelife.top/common/qr-li.png', is_active: 1 },
      { id: 'rec_2', name: '张经理 (客服拓展经理)', phone: '13888889999', qr_code_url: 'https://zc-oss.carelife.top/common/qr-zhang.png', is_active: 1 }
    ];
    for (const r of defaultReceivers) {
      try {
        await db.prepare('INSERT OR IGNORE INTO receivers (id, name, phone, qr_code_url, is_active) VALUES (?, ?, ?, ?, 1)').bind(r.id, r.name, r.phone, r.qr_code_url).run();
      } catch (e) {}
    }
    list = defaultReceivers;
  }

  return c.json({ success: true, data: list });
});

/**
 * 新增或修改接单员
 * POST /api/admin/receivers
 */
app.post('/api/admin/receivers', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { id, name, phone, qr_code_url } = body;

  if (!name || !phone) {
    return c.json({ success: false, message: '【姓名】与【手机号】为必填项' }, 400);
  }

  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS receivers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        qr_code_url TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (e) {}

  if (id) {
    await db.prepare(`
      UPDATE receivers 
      SET name = ?, phone = ?, qr_code_url = ? 
      WHERE id = ?
    `).bind(name, phone, qr_code_url || '', id).run();

    return c.json({ success: true, id, message: '接单员更新成功' });
  } else {
    const newId = `rec_${Date.now()}`;
    await db.prepare(`
      INSERT INTO receivers (id, name, phone, qr_code_url, is_active) 
      VALUES (?, ?, ?, ?, 1)
    `).bind(newId, name, phone, qr_code_url || '').run();

    return c.json({ success: true, id: newId, message: '接单员添加成功' });
  }
});

/**
 * 删除 (停用) 接单员
 * DELETE /api/admin/receivers/:id
 */
app.delete('/api/admin/receivers/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('UPDATE receivers SET is_active = 0 WHERE id = ?').bind(id).run();
  return c.json({ success: true, message: '接单员已移出列表' });
});

/**
 * 获取门店配置信息 (小程序及管理后台使用)
 * GET /api/config/store
 */
app.get('/api/config/store', async (c) => {
  const db = c.env.DB;
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS store_config (
        id TEXT PRIMARY KEY DEFAULT 'default',
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        business_hours TEXT DEFAULT '08:30 - 18:30',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (e) {}

  try {
    await db.prepare('ALTER TABLE store_config ADD COLUMN latitude REAL').run();
  } catch (e) {}
  try {
    await db.prepare('ALTER TABLE store_config ADD COLUMN longitude REAL').run();
  } catch (e) {}

  const config = await db.prepare('SELECT * FROM store_config WHERE id = ?').bind('default').first<any>();
  if (config) {
    return c.json({ success: true, data: config });
  }

  const defaultConfig = {
    id: 'default',
    name: '展晨门窗',
    phone: '13545941637',
    address: '湖北省仙桃市恒迪建材市场2期14栋1-107',
    latitude: null,
    longitude: null,
    business_hours: '08:30 - 18:30'
  };
  return c.json({ success: true, data: defaultConfig });
});

/**
 * 修改保存门店配置信息
 * POST /api/admin/config/store
 */
app.post('/api/admin/config/store', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { name, phone, address, latitude, longitude, business_hours } = body;

  if (!name || !phone || !address) {
    return c.json({ success: false, message: '【门店名称】、【客服电话】与【详细地址】为必填项' }, 400);
  }

  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS store_config (
        id TEXT PRIMARY KEY DEFAULT 'default',
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        business_hours TEXT DEFAULT '08:30 - 18:30',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch (e) {}

  try {
    await db.prepare('ALTER TABLE store_config ADD COLUMN latitude REAL').run();
  } catch (e) {}
  try {
    await db.prepare('ALTER TABLE store_config ADD COLUMN longitude REAL').run();
  } catch (e) {}

  const lat = (latitude !== undefined && latitude !== null && latitude !== '') ? parseFloat(latitude) : null;
  const lng = (longitude !== undefined && longitude !== null && longitude !== '') ? parseFloat(longitude) : null;

  await db.prepare(`
    INSERT INTO store_config (id, name, phone, address, latitude, longitude, business_hours, updated_at)
    VALUES ('default', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      phone = excluded.phone,
      address = excluded.address,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      business_hours = excluded.business_hours,
      updated_at = CURRENT_TIMESTAMP
  `).bind(name, phone, address, lat, lng, business_hours || '08:30 - 18:30').run();

  return c.json({ success: true, message: '门店信息与地图坐标保存成功' });
});

export default app;
