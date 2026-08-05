import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, User, Category, Product, ProductOption, Order, OrderItem } from './types';
import { calculateDoorWindowPrice } from './services/pricing';

const app = new Hono<{ Bindings: Env }>();

// 启用全局 CORS 跨域支持
app.use('*', cors());

// 健康检查
app.get('/', (c) => c.text('展晨门窗 Cloudflare Workers / D1 API 服务运行中...'));

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

  if (!user_id) {
    return c.json({ success: false, message: '用户ID不能为空' }, 400);
  }

  await db.prepare(`
    UPDATE users 
    SET nickname = ?, avatar_url = ?, phone = ? 
    WHERE id = ?
  `).bind(nickname || '', avatar_url || '', phone || '', user_id).run();

  const updatedUser = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user_id).first<User>();
  return c.json({ success: true, user: updatedUser });
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
  const { results } = await db.prepare(`
    SELECT * FROM categories 
    WHERE is_active = 1 
    ORDER BY sort_order ASC
  `).all<Category>();

  return c.json({ success: true, data: results || [] });
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
  const categoryId = c.req.query('category_id');

  let sql = 'SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id WHERE p.is_active = 1';
  const params: any[] = [];

  if (categoryId) {
    sql += ' AND p.category_id = ?';
    params.push(categoryId);
  }
  sql += ' ORDER BY p.sort_order ASC';

  const { results } = await db.prepare(sql).bind(...params).all<Product>();
  return c.json({ success: true, data: results || [] });
});

/**
 * 获取指定门窗商品详情 (包含结构化选配分组)
 * GET /api/products/:id
 */
app.get('/api/products/:id', async (c) => {
  const db = c.env.DB;
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
    product_id,
    product_name,
    base_price_sqm,
    min_area,
    customSets
  } = body;

  if (!customSets || !Array.isArray(customSets) || customSets.length === 0) {
    return c.json({ success: false, message: '请至少添加一套门窗定制配置' }, 400);
  }

  const orderId = `ord_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const orderNo = `ZC${dateStr}${Math.floor(1000 + Math.random() * 9000)}`;

  // 获取产品及其选配规则用于精确算价
  const product = await db.prepare('SELECT * FROM products WHERE id = ?').bind(product_id || 'prod_1').first<Product>();
  const { results: options } = await db.prepare('SELECT * FROM product_options WHERE product_id = ?').bind(product_id || 'prod_1').all<ProductOption>();
  const optionMap = new Map<string, ProductOption>();
  (options || []).forEach(o => optionMap.set(o.id, o));

  let totalSets = customSets.length;
  let totalBilledArea = 0;
  let totalBaseAmount = 0;
  let totalExtraAmount = 0;
  let totalFinalAmount = 0;

  // 插入订单主表记录
  await db.prepare(`
    INSERT INTO orders 
    (id, order_no, user_id, customer_name, customer_phone, total_sets, total_area, base_amount, extra_amount, special_charges_amount, final_amount, status)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 'pending_review')
  `).bind(
    orderId,
    orderNo,
    user_id || 'user_demo_1',
    customer_name || 'care',
    customer_phone || '13344443333',
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
      min_area: min_area || product?.min_area || 1.5,
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
      product_id || 'prod_1',
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
 * 获取订单列表 (支持 user_id 与 status 过滤)
 * GET /api/orders?user_id=xxx&status=pending_review
 */
app.get('/api/orders', async (c) => {
  const db = c.env.DB;
  const userId = c.req.query('user_id');
  const status = c.req.query('status');

  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params: any[] = [];

  if (userId) {
    sql += ' AND user_id = ?';
    params.push(userId);
  }
  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';

  const { results: orders } = await db.prepare(sql).bind(...params).all<Order>();

  // 抓取各订单的第一条/主要明细项用于卡片预览
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

  return c.json({ success: true, data: orders || [] });
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

export default app;
