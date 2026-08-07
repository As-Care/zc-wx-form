import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  Env,
  User,
  Category,
  Product,
  ProductOption,
  Order,
  OrderItem,
} from "./types";
import { calculateDoorWindowPrice } from "./services/pricing";

const app = new Hono<{ Bindings: Env }>();


function decodeHeaderValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch (e) {
    return value;
  }
}

);

/**
 * 获取全量微信客户列表 (自动清洗归并相同手机号的客户与订单)
 * GET /api/users
 */

);

/**
 * 新增或编辑用户收货地址
 * POST /api/user/addresses
 */
app.post("/api/user/addresses", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const {
    id,
    user_id,
    name,
    phone,
    province,
    city,
    district,
    detail_address,
    is_default,
  } = body;

  if (!user_id || !name || !phone || !detail_address) {
    return c.json(
      { success: false, message: "请填写完整的联系人、电话及详细地址" },
      400,
    );
  }

  if (is_default) {
    await db
      .prepare("UPDATE user_addresses SET is_default = 0 WHERE user_id = ?")
      .bind(user_id)
      .run();
  }

  const defaultVal = is_default ? 1 : 0;

  if (id) {
    await db
      .prepare(
        `
      UPDATE user_addresses 
      SET name = ?, phone = ?, province = ?, city = ?, district = ?, detail_address = ?, is_default = ? 
      WHERE id = ? AND user_id = ?
    `,
      )
      .bind(
        name,
        phone,
        province || "",
        city || "",
        district || "",
        detail_address,
        defaultVal,
        id,
        user_id,
      )
      .run();

    return c.json({ success: true, id, message: "地址修改成功" });
  } else {
    const newId = `addr_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    await db
      .prepare(
        `
      INSERT INTO user_addresses (id, user_id, name, phone, province, city, district, detail_address, is_default) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .bind(
        newId,
        user_id,
        name,
        phone,
        province || "",
        city || "",
        district || "",
        detail_address,
        defaultVal,
      )
      .run();

    return c.json({ success: true, id: newId, message: "地址添加成功" });
  }
});

/**
 * 删除指定地址
 * DELETE /api/user/addresses/:id
 */
app.delete("/api/user/addresses/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  await db.prepare("DELETE FROM user_addresses WHERE id = ?").bind(id).run();
  return c.json({ success: true, message: "地址已删除" });
});

/**
 * 设置为默认地址
 * PATCH /api/user/addresses/:id/default
 */
app.patch("/api/user/addresses/:id/default", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();
  const userId = body.user_id || c.req.query("user_id");

  if (!userId) {
    return c.json({ success: false, message: "用户ID不能为空" }, 400);
  }

  await db
    .prepare("UPDATE user_addresses SET is_default = 0 WHERE user_id = ?")
    .bind(userId)
    .run();
  await db
    .prepare(
      "UPDATE user_addresses SET is_default = 1 WHERE id = ? AND user_id = ?",
    )
    .bind(id, userId)
    .run();

  return c.json({ success: true, message: "默认地址设置成功" });
});

// ----------------------------------------------------
// 2. 门窗分类接口 (Categories)
// ----------------------------------------------------


);

// -----------------------------------------------------------------------------
// 数据库初始化与迁移统一控制 (集中管理所有表的 CREATE TABLE 和 CREATE INDEX)
// -----------------------------------------------------------------------------
app.post("/api/admin/init-db", async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ success: false, message: "DB 未绑定" }, 500);

  try {
    const statements = [
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        actor_username TEXT NOT NULL,
        target_id TEXT,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        openid TEXT,
        nickname TEXT,
        avatar_url TEXT,
        phone TEXT,
        role TEXT DEFAULT 'customer',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)`,
      `CREATE TABLE IF NOT EXISTS user_addresses (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        province TEXT,
        city TEXT,
        district TEXT,
        detail TEXT,
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        icon TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category_id TEXT,
        description TEXT,
        base_price REAL DEFAULT 0,
        unit TEXT DEFAULT '㎡',
        images TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sort_order INTEGER DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS product_options (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        name TEXT NOT NULL,
        option_type TEXT DEFAULT 'single',
        price_modifier REAL DEFAULT 0,
        is_required INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_no TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        customer_name TEXT,
        customer_phone TEXT,
        install_address TEXT,
        customer_remark TEXT,
        scene_images TEXT,
        base_amount REAL DEFAULT 0,
        extra_amount REAL DEFAULT 0,
        special_charges_amount REAL DEFAULT 0,
        final_amount REAL DEFAULT 0,
        status TEXT DEFAULT 'pending_review',
        admin_remark TEXT,
        items TEXT,
        creator_type TEXT DEFAULT 'customer',
        creator_id TEXT,
        creator_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_orders_order_no ON orders(order_no)`,
      `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`,
      `CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone)`,
      `CREATE TABLE IF NOT EXISTS sys_menus (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        key TEXT NOT NULL UNIQUE,
        path TEXT NOT NULL,
        icon TEXT,
        sort_order INTEGER DEFAULT 0,
        is_visible INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS role_menus (
        role_id TEXT NOT NULL,
        menu_id TEXT NOT NULL,
        PRIMARY KEY (role_id, menu_id)
      )`,
      `CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT,
        role_id TEXT,
        status INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login_at DATETIME
      )`,
      `CREATE TABLE IF NOT EXISTS receivers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        qr_code_url TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS store_config (
        id TEXT PRIMARY KEY,
        name TEXT,
        phone TEXT,
        address TEXT,
        latitude REAL,
        longitude REAL,
        business_hours TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    const stmtBatch = statements.map(s => db.prepare(s));
    await db.batch(stmtBatch);

    return c.json({ success: true, message: "数据库初始化及迁移成功" });
  } catch (error: any) {
    console.error("Init DB Error:", error);
    return c.json({ success: false, message: "数据库初始化失败: " + error.message }, 500);
  }
});

export default app;
