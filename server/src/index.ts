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

type AdminIdentity = {
  id: string;
  username: string;
  nickname: string;
  role_id: string;
  role_code: string;
};

type UserIdentity = {
  id: string;
  openid: string;
  nickname: string;
  phone: string;
};

const app = new Hono<{ Bindings: Env; Variables: { admin?: AdminIdentity; user?: UserIdentity } }>();

let adminSessionsInitialized = false;
let adminSessionsInitializationPromise: Promise<void> | null = null;
let userSessionsInitialized = false;
let userSessionsInitializationPromise: Promise<void> | null = null;
let orderIndexesInitialized = false;
let orderIndexesInitializationPromise: Promise<void> | null = null;
let productHotFieldInitialized = false;
let productHotFieldInitializationPromise: Promise<void> | null = null;

async function initProductHotField(db: D1Database) {
  if (productHotFieldInitialized) return;
  if (productHotFieldInitializationPromise) return productHotFieldInitializationPromise;

  productHotFieldInitializationPromise = (async () => {
    const { results: columns } = await db.prepare("PRAGMA table_info(products)").all<any>();
    if (!(columns || []).some((column: any) => column.name === "is_hot")) {
      try {
        await db.prepare("ALTER TABLE products ADD COLUMN is_hot INTEGER NOT NULL DEFAULT 0").run();
      } catch (error) {
        const { results: refreshedColumns } = await db.prepare("PRAGMA table_info(products)").all<any>();
        if (!(refreshedColumns || []).some((column: any) => column.name === "is_hot")) throw error;
      }
    }
    await db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_products_hot_active_sort ON products(is_hot, is_active, sort_order)",
    ).run();
    productHotFieldInitialized = true;
  })().finally(() => {
    productHotFieldInitializationPromise = null;
  });
  return productHotFieldInitializationPromise;
}

async function initOrderQueryIndexes(db: D1Database) {
  if (orderIndexesInitialized) return;
  if (orderIndexesInitializationPromise) return orderIndexesInitializationPromise;

  orderIndexesInitializationPromise = (async () => {
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at DESC)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)").run();
    orderIndexesInitialized = true;
  })().finally(() => {
    orderIndexesInitializationPromise = null;
  });
  return orderIndexesInitializationPromise;
}

async function initAdminSessions(db: D1Database) {
  if (adminSessionsInitialized) return;
  if (adminSessionsInitializationPromise) return adminSessionsInitializationPromise;

  adminSessionsInitializationPromise = (async () => {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        token TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    await db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_expires ON admin_sessions(admin_id, expires_at)",
    ).run();
    adminSessionsInitialized = true;
  })().finally(() => {
    adminSessionsInitializationPromise = null;
  });
  return adminSessionsInitializationPromise;
}

async function createAdminSession(db: D1Database, adminId: string) {
  await initAdminSessions(db);
  const token = `zc_admin_token_${crypto.randomUUID()}`;
  await db.prepare("DELETE FROM admin_sessions WHERE expires_at <= CURRENT_TIMESTAMP").run();
  await db.prepare(
    "INSERT INTO admin_sessions (token, admin_id, expires_at) VALUES (?, ?, datetime('now', '+7 days'))",
  ).bind(token, adminId).run();
  return token;
}

async function getAdminFromSession(db: D1Database, authorization: string): Promise<AdminIdentity | null> {
  const match = authorization.match(/^Bearer\s+(zc_admin_token_[A-Za-z0-9-]+)$/i);
  if (!match) return null;
  await initAdminSessions(db);
  const admin = await db.prepare(`
    SELECT a.id, a.username, a.nickname, a.role_id, r.code AS role_code
    FROM admin_sessions s
    JOIN admin_users a ON a.id = s.admin_id
    LEFT JOIN roles r ON r.id = a.role_id
    WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP AND a.status = 1
  `).bind(match[1]).first<AdminIdentity>();
  return admin || null;
}

async function initUserSessions(db: D1Database) {
  if (userSessionsInitialized) return;
  if (userSessionsInitializationPromise) return userSessionsInitializationPromise;

  userSessionsInitializationPromise = (async () => {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    await db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_user_sessions_user_expires ON user_sessions(user_id, expires_at)",
    ).run();
    userSessionsInitialized = true;
  })().finally(() => {
    userSessionsInitializationPromise = null;
  });
  return userSessionsInitializationPromise;
}

async function createUserSession(db: D1Database, userId: string) {
  await initUserSessions(db);
  const token = `zc_user_token_${crypto.randomUUID()}`;
  await db.prepare("DELETE FROM user_sessions WHERE expires_at <= CURRENT_TIMESTAMP").run();
  await db.prepare(
    "INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+7 days'))",
  ).bind(token, userId).run();
  return token;
}

async function getUserFromSession(db: D1Database, authorization: string): Promise<UserIdentity | null> {
  const match = authorization.match(/^Bearer\s+(zc_user_token_[A-Za-z0-9-]+)$/i);
  if (!match) return null;
  await initUserSessions(db);
  const user = await db.prepare(`
    SELECT u.id, u.openid, u.nickname, u.phone
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP
  `).bind(match[1]).first<UserIdentity>();
  return user || null;
}

const ADMIN_ROUTE_MENU: Array<[string, string]> = [
  ["/api/admin/audit-logs", "AuditLogs"],
  ["/api/admin/sys-menus", "Menus"],
  ["/api/admin/roles", "Roles"],
  ["/api/admin/users", "Admins"],
  ["/api/admin/customers", "Users"],
  ["/api/admin/orders", "Orders"],
  ["/api/admin/categories", "Categories"],
  ["/api/admin/products", "Products"],
  ["/api/admin/receivers", "StaffConfig"],
  ["/api/admin/config", "Settings"],
  ["/api/admin/stats", "Overview"],
];

function getRequiredMenu(path: string) {
  return ADMIN_ROUTE_MENU.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1] || null;
}

async function hasAdminMenuAccess(db: D1Database, admin: AdminIdentity, menuKey: string) {
  if (admin.role_code === "root") return true;
  const permission = await db.prepare(
    "SELECT 1 FROM role_menus WHERE role_id = ? AND menu_key = ?",
  ).bind(admin.role_id, menuKey).first();
  return Boolean(permission);
}


async function writeAuditLog(db: any, input: {
  event_type: string;
  action: string;
  actor_id?: string;
  actor_username?: string;
  actor_name?: string;
  target_type?: string;
  target_id?: string;
  target_name?: string;
  user_id?: string;
  user_nickname?: string;
  user_phone?: string;
  details?: any;
}) {
  try {
    await db.prepare(`
      INSERT INTO audit_logs
      (id, event_type, action, actor_id, actor_username, actor_name, target_type, target_id, target_name, user_id, user_nickname, user_phone, details_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `audit_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      input.event_type,
      input.action,
      input.actor_id || "",
      input.actor_username || "",
      input.actor_name || input.actor_username || "管理员",
      input.target_type || "",
      input.target_id || "",
      input.target_name || "",
      input.user_id || "",
      input.user_nickname || "",
      input.user_phone || "",
      JSON.stringify(input.details || {}),
    ).run();
  } catch (e) {
    console.error("writeAuditLog failed:", e);
  }
}

const AUDIT_EVENT_MAP: Record<string, string> = {
  "/api/admin/customers": "客户管理",
  "/api/user/profile": "客户资料",
  "/api/user/addresses": "客户地址",
  "/api/admin/users": "管理员账号",
  "/api/admin/roles": "角色权限",
  "/api/admin/sys-menus": "系统菜单",
  "/api/admin/categories": "门窗分类",
  "/api/admin/products": "门窗商品",
  "/api/admin/receivers": "接单员",
  "/api/admin/config/store": "门店配置",
  "/api/orders": "订单管理",
};

function getAuditEventType(path: string) {
  const key = Object.keys(AUDIT_EVENT_MAP).find((item) => path === item || path.startsWith(`${item}/`));
  return key ? AUDIT_EVENT_MAP[key] : "系统操作";
}

// Write audit logs only after the request is authenticated. Identity headers
// are never trusted as the source of the acting administrator.
app.use("*", async (c, next) => {
  const method = c.req.method.toUpperCase();
  const path = new URL(c.req.url).pathname;

  let body: any = {};
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    try {
      body = await c.req.raw.clone().json();
      if (body && typeof body === "object" && body.password) body.password = "[已隐藏]";
    } catch (e) {}
  }

  const routeTargetId = c.req.param("id") || "";
  let targetContext: any = {};
  try {
    if (routeTargetId && (path.includes("/api/orders/") || path.includes("/api/admin/orders/"))) {
      targetContext = await c.env.DB.prepare(
        "SELECT id, order_no, user_id, customer_name, customer_phone FROM orders WHERE id = ?",
      ).bind(routeTargetId).first<any>() || {};
    } else if (routeTargetId && path.includes("/api/admin/users/")) {
      targetContext = await c.env.DB.prepare(
        "SELECT id, nickname, phone FROM users WHERE id = ?",
      ).bind(routeTargetId).first<any>() || {};
    } else if (routeTargetId && path.includes("/api/admin/products/")) {
      targetContext = await c.env.DB.prepare(
        "SELECT id, name FROM products WHERE id = ?",
      ).bind(routeTargetId).first<any>() || {};
    }
  } catch (e) {}

  await next();
  const response = c.res;
  const admin = c.get("admin");
  if (!admin) return response;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return response;
  if (path === "/api/admin/login" || path === "/api/admin/audit-logs") return response;
  if (response.status < 200 || response.status >= 300) return response;

  const targetId = body.id || body.user_id || body.product_id || body.order_id || routeTargetId || "";
  const actionMap: Record<string, string> = { POST: "新增", PUT: "修改", PATCH: "更新", DELETE: "删除" };
  const action = actionMap[method] || method;
  const detailName = body.order_no || targetContext.order_no || body.nickname || targetContext.nickname || body.name || targetContext.name || body.product_name || body.username || "";
  const isOrderStatus = path.includes("/api/admin/orders/") && path.endsWith("/status");
  const isProductStatus = path.includes("/api/admin/products/") && path.endsWith("/status");
  const isProductHot = path.includes("/api/admin/products/") && path.endsWith("/hot");
  const actionText = isOrderStatus
    ? `修改订单 ${targetId} 状态为 ${body.new_status || ""}`
    : isProductStatus
      ? `修改商品 ${targetId} 状态为 ${Number(body.is_active) === 1 ? "上架" : "下架"}`
      : isProductHot
        ? `修改商品 ${targetId} 热门推荐为 ${Number(body.is_hot) === 1 ? "热门" : "普通"}`
    : `${action}${getAuditEventType(path)}${detailName ? `：${detailName}` : ""}`;

  await writeAuditLog(c.env.DB, {
    event_type: isOrderStatus ? "订单状态" : getAuditEventType(path),
    action: actionText,
    actor_id: admin.id,
    actor_username: admin.username,
    actor_name: admin.nickname || admin.username,
    target_type: getAuditEventType(path),
    target_id: targetId,
    target_name: detailName,
    user_id: body.user_id || targetContext.user_id || "",
    user_nickname: body.customer_name || targetContext.customer_name || targetContext.nickname || body.nickname || "",
    user_phone: body.customer_phone || targetContext.customer_phone || targetContext.phone || body.phone || "",
    details: body,
  });
  return response;
});

async function mergeCustomerData(db: any, fromUserId: string, toUserId: string) {
  if (!fromUserId || !toUserId || fromUserId === toUserId) return;
  await db.prepare("UPDATE orders SET user_id = ? WHERE user_id = ?").bind(toUserId, fromUserId).run();
  await db.prepare("UPDATE user_addresses SET user_id = ? WHERE user_id = ?").bind(toUserId, fromUserId).run();
  await db.prepare("DELETE FROM users WHERE id = ?").bind(fromUserId).run();
}

function isLegacyCustomerIdentity(user: { openid?: string | null; role?: string | null }) {
  const openid = String(user.openid || "");
  return (
    user.role === "admin_created" ||
    !openid ||
    openid.startsWith("wx_openid_") ||
    openid.startsWith("admin_created_")
  );
}

/**
 * A phone number can claim legacy placeholder or admin-created records, but
 * never another real WeChat identity. This preserves historical orders while
 * preventing one signed-in customer from taking over a different account.
 */
async function claimLegacyCustomerDataByPhone(db: any, currentUserId: string, phone: string) {
  const result = await db
    .prepare(
      "SELECT id, openid, role FROM users WHERE phone = ? AND id != ? ORDER BY created_at ASC",
    )
    .bind(phone, currentUserId)
    .all();

  const matches = (result.results || []) as Array<{
    id: string;
    openid: string | null;
    role: string | null;
  }>;
  const realIdentity = matches.find((user) => !isLegacyCustomerIdentity(user));
  if (realIdentity) return { conflict: true };

  for (const user of matches) {
    await mergeCustomerData(db, user.id, currentUserId);
  }
  await db
    .prepare("UPDATE orders SET user_id = ? WHERE user_id IS NULL AND customer_phone = ?")
    .bind(currentUserId, phone)
    .run();
  return { conflict: false };
}

/**
 * Resolve the customer identity carried by the mini-program token.
 * Admin pages currently use the legacy unauthenticated order query path,
 * while mini-program requests always send a Bearer token.
 */
function getBearerTokenUserId(c: any): string | null {
  return c.get("user")?.id || null;
}

type CustomerAccess =
  | { id: string }
  | { status: 400 | 401 | 403; message: string };

/**
 * Mini-program requests may only operate on their own customer record.
 * Administrators with customer-management permission may explicitly select a
 * target customer so the admin order and customer-management screens work.
 */
async function resolveCustomerAccess(
  c: any,
  db: D1Database,
  requestedUserId?: string | null,
): Promise<CustomerAccess> {
  const admin = c.get("admin") as AdminIdentity | undefined;
  if (admin) {
    if (!(await hasAdminMenuAccess(db, admin, "Users"))) {
      return { status: 403, message: "当前账号没有客户管理权限" };
    }
    const id = String(requestedUserId || "").trim();
    return id
      ? { id }
      : { status: 400, message: "请选择需要操作的客户" };
  }

  const user = c.get("user") as UserIdentity | undefined;
  return user
    ? { id: user.id }
    : { status: 401, message: "登录状态无效，请重新登录" };
}

function normalizeImageUrls(value: unknown): string {
  const items = Array.isArray(value) ? value : [value];
  return items
    .map((item: any) => {
      if (typeof item === "string") return item.trim();
      if (!item || typeof item !== "object") return "";
      const url = item.url || item.response?.url || item.file?.url;
      return typeof url === "string" ? url.trim() : "";
    })
    .filter(Boolean)
    .join(",");
}

// 启用全局 CORS 跨域支持。后台审计需要携带管理员身份 Header，必须
// 显式加入预检允许列表，否则浏览器会拦截所有后台 API 请求。
app.use("*", cors({
  allowHeaders: ["Content-Type", "Authorization", "X-Client", "X-Admin-Id", "X-Admin-Username", "X-Admin-Name"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));

// Validate an administrator session for every request carrying an admin token.
// This also covers the legacy /api/orders routes used by the admin dashboard.
app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") return next();

  const path = c.req.path;
  if (path === "/api/admin/login") return next();
  const authorization = c.req.header("Authorization") || "";
  if (authorization.startsWith("Bearer zc_admin_token_")) {
    const admin = await getAdminFromSession(c.env.DB, authorization);
    if (!admin) {
      return c.json({ success: false, message: "登录已失效，请重新登录" }, 401);
    }
    c.set("admin", admin);
  } else if (authorization.startsWith("Bearer zc_user_token_")) {
    const user = await getUserFromSession(c.env.DB, authorization);
    if (user) c.set("user", user);
  }

  if (!path.startsWith("/api/admin/")) {
    if (path === "/api/orders" || path.startsWith("/api/orders/")) {
      const admin = c.get("admin");
      if (admin && !(await hasAdminMenuAccess(c.env.DB, admin, "Orders"))) {
        return c.json({ success: false, message: "当前账号没有订单管理权限" }, 403);
      }
    }
    return next();
  }

  const admin = c.get("admin");
  if (!admin) {
    return c.json({ success: false, message: "请先登录后台管理系统" }, 401);
  }
  if (path === "/api/admin/logout") return next();

  const requiredMenu = getRequiredMenu(path);
  if (!requiredMenu || !(await hasAdminMenuAccess(c.env.DB, admin, requiredMenu))) {
    return c.json({ success: false, message: "当前账号没有该功能权限" }, 403);
  }
  return next();
});

// 全局异常捕获中间件
app.onError((err, c) => {
  console.error("Server Exception:", err);
  return c.json(
    {
      success: false,
      message:
        err.message ||
        "服务端异常，请检查数据库表结构是否已完成初始化(schema.sql)",
      error: String(err),
    },
    500,
  );
});

// 健康检查
app.get("/", (c) =>
  c.text("展晨门窗 Cloudflare Workers / D1 API 服务运行中..."),
);

// ----------------------------------------------------
// 0. 通用图片文件上传接口 (Upload API)
// ----------------------------------------------------

/**
 * 通用图片上传接口 (支持头像/矢量图/产品图上传)
 * POST /api/upload
 */
app.post("/api/upload", async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body["file"];

    if (!file || typeof file === "string") {
      return c.json({ success: false, message: "请上传有效的图片文件" }, 400);
    }

    const ext = file.name ? file.name.split(".").pop() : "jpg";
    const fileName = `upload/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

    // 1. 保存至 Cloudflare R2 对象存储桶 (zc-wx-app / upload 目录)
    if (c.env.BUCKET) {
      const buffer = await file.arrayBuffer();
      await c.env.BUCKET.put(fileName, buffer, {
        httpMetadata: { contentType: file.type || "image/jpeg" },
      });
    }

    // 2. 返回标准的 Cloudflare R2 对象存储 CDN 唯一 URL (如: https://zc-oss.carelife.top/upload/1785900000_abc.jpg)
    const url = `https://zc-oss.carelife.top/${fileName}`;
    return c.json({
      success: true,
      url,
      name: fileName,
      message: "成功保存至 Cloudflare R2 对象存储 (zc-wx-app/upload)",
    });
  } catch (e) {
    return c.json(
      { success: false, message: "图片上传至 R2 存储失败", error: String(e) },
      500,
    );
  }
});

// ----------------------------------------------------
// 1. 微信小程序 官方鉴权与个人资料 (Auth & User Profile)
// ----------------------------------------------------

/**
 * 微信小程序 官方 code2Session 换取 openid 登录与注册
 * POST /api/auth/wx-login
 */
app.post("/api/auth/wx-login", async (c) => {
  const body = await c.req.json();
  const code = body.code;
  const nickname = body.nickname || "展晨尊享客户";
  const avatar_url =
    body.avatar_url ||
    body.avatar ||
    "https://zc-oss.carelife.top/common/zc-logo.jpg";
  const requestedPhone = String(body.phone || "").trim();
  const phone = /^1[3-9]\d{9}$/.test(requestedPhone) ? requestedPhone : "";

  let openid = "";
  const appId = c.env.WX_APP_ID;
  const appSecret = c.env.WX_APP_SECRET;

  // 1. 优先调用微信官方 jscode2session 接口
  if (code && appId && appSecret) {
    try {
      const wxRes = await fetch(
        `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`,
      );
      const wxData: any = await wxRes.json();
      if (wxData.openid) {
        openid = wxData.openid;
      } else {
        console.warn("微信 code2Session 返回异常:", wxData);
      }
    } catch (e) {
      console.error("调用微信 code2Session 失败:", e);
    }
  }

  // 2. 如果无法获取真实 openid，直接拒绝登录以保证安全性
  if (!openid) {
    return c.json(
      {
        success: false,
        message: "微信鉴权失败，无法获取真实用户身份",
      },
      401,
    );
  }

  const db = c.env.DB;
  let user = await db
    .prepare("SELECT * FROM users WHERE openid = ?")
    .bind(openid)
    .first<User>();

  // A customer created by an administrator can claim that record after
  // registering in the mini-program with the same phone number.
  const cleanPhone = String(phone || "").trim();
  const precreatedUser = !user && cleanPhone
    ? await db
        .prepare("SELECT * FROM users WHERE phone = ? AND role = 'admin_created' ORDER BY created_at ASC LIMIT 1")
        .bind(cleanPhone)
        .first<User>()
    : null;

  if (precreatedUser) {
    await db
      .prepare("UPDATE users SET openid = ?, nickname = ?, avatar_url = ?, phone = ?, role = 'customer' WHERE id = ?")
      .bind(openid, nickname, avatar_url, cleanPhone, precreatedUser.id)
      .run();
    user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(precreatedUser.id).first<User>();
  } else if (user && cleanPhone) {
    const duplicatePrecreated = await db
      .prepare("SELECT id FROM users WHERE phone = ? AND role = 'admin_created' AND id != ? ORDER BY created_at ASC LIMIT 1")
      .bind(cleanPhone, user.id)
      .first<{ id: string }>();
    if (duplicatePrecreated) {
      await mergeCustomerData(db, duplicatePrecreated.id, user.id);
    }
  }

  if (!user) {
    const userId = `user_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    await db
      .prepare(
        `
      INSERT INTO users (id, openid, nickname, avatar_url, phone, role) 
      VALUES (?, ?, ?, ?, ?, 'customer')
    `,
      )
      .bind(userId, openid, nickname, avatar_url, phone)
      .run();

    user = {
      id: userId,
      openid,
      nickname,
      avatar_url,
      phone,
      role: "customer",
    };
  }

  // Use a previously saved valid phone only to claim legacy placeholder data.
  // A real WeChat account with the same phone is never merged automatically.
  if (phone && (!user.phone || user.phone === phone)) {
    const claimResult = await claimLegacyCustomerDataByPhone(db, user.id, phone);
    if (!claimResult.conflict && !user.phone) {
      await db.prepare("UPDATE users SET phone = ? WHERE id = ?").bind(phone, user.id).run();
      user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first<User>();
    }
  }

  const token = await createUserSession(db, user.id);
  return c.json({
    success: true,
    user,
    token,
  });
});

/**
 * Create a customer record from the admin console before the customer has
 * opened the mini-program. OpenID remains empty until the phone is claimed.
 */
app.post("/api/admin/customers", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const nickname = String(body.nickname || "").trim();
  const phone = String(body.phone || "").trim();

  if (!nickname || !phone) {
    return c.json({ success: false, message: "客户姓名/昵称和联系电话均为必填项" }, 400);
  }
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return c.json({ success: false, message: "请输入有效的手机号码" }, 400);
  }

  const existing = await db.prepare("SELECT id, nickname, role FROM users WHERE phone = ? LIMIT 1").bind(phone).first<any>();
  if (existing) {
    return c.json({ success: false, message: `联系电话已被客户【${existing.nickname || existing.id}】绑定` }, 409);
  }

  const id = `customer_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  try {
    await db
      .prepare("INSERT INTO users (id, openid, nickname, avatar_url, phone, role) VALUES (?, NULL, ?, '', ?, 'admin_created')")
      .bind(id, nickname, phone)
      .run();
  } catch (error) {
    // Existing deployments may still have users.openid declared NOT NULL.
    // Keep the record claimable while migrations are rolled out; this value
    // is never exposed as a real OpenID and is replaced at mini-program login.
    await db
      .prepare("INSERT INTO users (id, openid, nickname, avatar_url, phone, role) VALUES (?, ?, ?, '', ?, 'admin_created')")
      .bind(id, `admin_created_${id}`, nickname, phone)
      .run();
  }

  const user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<any>();
  return c.json({ success: true, user, message: "客户创建成功" });
});

/**
 * 获取当前用户信息
 * GET /api/user/profile
 */
app.get("/api/user/profile", async (c) => {
  const db = c.env.DB;
  const access = await resolveCustomerAccess(c, db, c.req.query("user_id"));
  if ("status" in access) {
    return c.json({ success: false, message: access.message }, access.status);
  }

  const user = await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(access.id)
    .first<User>();
  if (!user) {
    return c.json({ success: false, message: "未找到该用户" }, 404);
  }

  return c.json({ success: true, user });
});

/**
 * 更新个人资料 (姓名、头像、手机号)
 * POST /api/user/profile
 */
app.post("/api/user/profile", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { nickname, avatar_url, phone } = body;
  const access = await resolveCustomerAccess(c, db, body.user_id);
  if ("status" in access) {
    return c.json({ success: false, message: access.message }, access.status);
  }
  const id = access.id;
  const isAdmin = Boolean(c.get("admin"));
  const cleanPhone = String(phone || "").trim();

  if (cleanPhone && !/^1[3-9]\d{9}$/.test(cleanPhone)) {
    return c.json({ success: false, message: "请输入有效的手机号码" }, 400);
  }
  if (cleanPhone) {
    if (isAdmin) {
      const duplicate = await db
        .prepare("SELECT id FROM users WHERE phone = ? AND id != ? LIMIT 1")
        .bind(cleanPhone, id)
        .first<{ id: string }>();
      if (duplicate) {
        return c.json({ success: false, message: "该手机号已被其他客户绑定" }, 409);
      }
    } else {
      const claimResult = await claimLegacyCustomerDataByPhone(db, id, cleanPhone);
      if (claimResult.conflict) {
        return c.json({ success: false, message: "该手机号已绑定其他微信账号，请联系门店处理" }, 409);
      }
    }
  }

  await db
    .prepare(
      `
    UPDATE users SET
      nickname = COALESCE(?, nickname),
      avatar_url = COALESCE(?, avatar_url),
      phone = COALESCE(?, phone),
      role = CASE WHEN ? THEN role ELSE 'customer' END
    WHERE id = ?
  `,
    )
    .bind(nickname || null, avatar_url || null, cleanPhone || null, isAdmin ? 1 : 0, id)
    .run();

  const user = await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(id)
    .first<User>();
  return c.json({ success: true, user });
});

async function mergeDuplicateUsersByPhone(db: any) {
  try {
    // 1. 将孤立/分散订单根据下单联系电话 customer_phone 重定向关联到手机号对应的已有主用户
    await db
      .prepare(
        `
      UPDATE orders 
      SET user_id = (
        SELECT u.id FROM users u 
        WHERE u.phone = orders.customer_phone AND u.phone IS NOT NULL AND u.phone != '' 
        ORDER BY u.created_at ASC LIMIT 1
      )
      WHERE customer_phone IS NOT NULL AND customer_phone != '' 
        AND customer_phone IN (SELECT phone FROM users WHERE phone IS NOT NULL AND phone != '')
    `,
      )
      .run();

    // 2. 查找拥有重复手机号的用户记录 (COUNT > 1)
    const duplicateResult = await db
      .prepare(
        `
      SELECT phone, COUNT(*) as cnt 
      FROM users 
      WHERE phone IS NOT NULL AND phone != '' 
      GROUP BY phone 
      HAVING cnt > 1
    `,
      )
      .all();
    const dupes = (duplicateResult.results || []) as Array<{ phone: string; cnt: number }>;

    for (const dup of dupes || []) {
      const phoneUserResult = await db
        .prepare(
          'SELECT * FROM users WHERE phone = ? ORDER BY (CASE WHEN openid LIKE "wx_openid_usr_%" THEN 2 WHEN openid LIKE "wx_openid_demo_%" THEN 3 ELSE 1 END), created_at ASC',
        )
        .bind(dup.phone)
        .all();
      const phoneUsers = (phoneUserResult.results || []) as any[];

      if (phoneUsers && phoneUsers.length > 1) {
        const primaryUser = phoneUsers[0];
        const duplicateIds = phoneUsers.slice(1).map((u) => u.id);

        for (const dupId of duplicateIds) {
          await db
            .prepare("UPDATE orders SET user_id = ? WHERE user_id = ?")
            .bind(primaryUser.id, dupId)
            .run();
          await db
            .prepare("UPDATE user_addresses SET user_id = ? WHERE user_id = ?")
            .bind(primaryUser.id, dupId)
            .run();
          await db.prepare("DELETE FROM users WHERE id = ?").bind(dupId).run();
        }
      }
    }
  } catch (e) {
    console.error("Merge duplicate users failed:", e);
  }
}

/**
 * 客户端更新/同步用户信息
 * POST /api/user/sync
 */
app.post("/api/user/sync", async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ success: false, message: "DB 未绑定" }, 500);
  const currentUser = c.get("user");
  if (!currentUser) {
    return c.json({ success: false, message: "登录状态无效，请重新登录" }, 401);
  }

  const body = await c.req.json();
  const { nickname, avatar_url, phone } = body;
  const id = currentUser.id;
  const cleanPhone = String(phone || "").trim();

  if (cleanPhone && !/^1[3-9]\d{9}$/.test(cleanPhone)) {
    return c.json({ success: false, message: "请输入有效的手机号码" }, 400);
  }
  if (cleanPhone) {
    const claimResult = await claimLegacyCustomerDataByPhone(db, id, cleanPhone);
    if (claimResult.conflict) {
      return c.json({ success: false, message: "该手机号已绑定其他微信账号，请联系门店处理" }, 409);
    }
  }

  await db
    .prepare(
      `
    UPDATE users SET
      nickname = COALESCE(NULLIF(?, ''), nickname),
      avatar_url = COALESCE(NULLIF(?, ''), avatar_url),
      phone = COALESCE(NULLIF(?, ''), phone)
    WHERE id = ?
  `,
    )
    .bind(
      nickname || "",
      avatar_url || "",
      cleanPhone,
      id,
    )
    .run();

  const updatedUser = await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(id)
    .first<any>();
  return c.json({ success: true, user: updatedUser });
});

/**
 * 获取全量微信客户列表 (自动清洗归并相同手机号的客户与订单)
 * GET /api/users
 */


/**
 * 获取全量微信客户列表 (单次 Batch 高效加载)
 * GET /api/users
 */
app.get("/api/users", async (c) => {
  const db = c.env.DB;
  const admin = c.get("admin");
  if (!admin) {
    return c.json({ success: false, message: "请先登录后台管理系统" }, 401);
  }
  if (!(await hasAdminMenuAccess(db, admin, "Users"))) {
    return c.json({ success: false, message: "当前账号没有客户管理权限" }, 403);
  }

  const nickname = c.req.query("nickname");
  const phone = c.req.query("phone");
  const keyword = c.req.query("keyword") || c.req.query("search");

  let whereClause = " WHERE (role != 'admin' OR role IS NULL)";
  const params: any[] = [];

  if (nickname && nickname.trim()) {
    whereClause += " AND nickname LIKE ?";
    params.push(`%${nickname.trim()}%`);
  }

  if (phone && phone.trim()) {
    whereClause += " AND phone LIKE ?";
    params.push(`%${phone.trim()}%`);
  }

  if (keyword && keyword.trim()) {
    const kw = `%${keyword.trim()}%`;
    whereClause +=
      " AND (nickname LIKE ? OR phone LIKE ? OR id LIKE ? OR openid LIKE ?)";
    params.push(kw, kw, kw, kw);
  }

  const sql = `SELECT * FROM users${whereClause} ORDER BY created_at DESC`;
  const { results: users } = await db
    .prepare(sql)
    .bind(...params)
    .all<any>();
  const userList = users || [];

  // 单次 Batch 批量拉取 orders 与 addresses，彻底消除 N+1 数据库耗时
  const orderCountMap: Record<string, number> = {};
  const phoneOrderCountMap: Record<string, number> = {};
  const latestInstallAddressMap: Record<string, string> = {};

  try {
    const { results: ordersSummary } = await db
      .prepare(
        "SELECT id, user_id, customer_phone, install_address FROM orders ORDER BY created_at ASC",
      )
      .all<any>();

    (ordersSummary || []).forEach((o) => {
      if (o.user_id) {
        orderCountMap[o.user_id] = (orderCountMap[o.user_id] || 0) + 1;
        if (o.install_address)
          latestInstallAddressMap[o.user_id] = o.install_address;
      }
      if (o.customer_phone) {
        phoneOrderCountMap[o.customer_phone] =
          (phoneOrderCountMap[o.customer_phone] || 0) + 1;
        if (o.install_address)
          latestInstallAddressMap[o.customer_phone] = o.install_address;
      }
    });
  } catch (e) {}

  const addressMap: Record<string, any> = {};
  try {
    const { results: addresses } = await db
      .prepare(
        "SELECT * FROM user_addresses ORDER BY is_default DESC, created_at DESC",
      )
      .all<any>();

    (addresses || []).forEach((a) => {
      if (a.user_id && !addressMap[a.user_id]) addressMap[a.user_id] = a;
      if (a.phone && !addressMap[a.phone]) addressMap[a.phone] = a;
    });
  } catch (e) {}

  userList.forEach((user) => {
    const uPhone = user.phone || "";
    const uidCount = orderCountMap[user.id] || 0;
    const phoneCount = uPhone ? phoneOrderCountMap[uPhone] || 0 : 0;
    user.order_count = Math.max(uidCount, phoneCount);

    const addrObj = addressMap[user.id] || (uPhone ? addressMap[uPhone] : null);
    if (addrObj) {
      user.address = `${addrObj.province || ""}${addrObj.city || ""}${addrObj.district || ""}${addrObj.detail_address || ""}`;
      user.address_detail = addrObj;
    } else {
      user.address =
        latestInstallAddressMap[user.id] ||
        (uPhone ? latestInstallAddressMap[uPhone] : "") ||
        "暂无保存地址";
    }
  });

  return c.json({ success: true, data: userList });
});

/**
 * 删除客户档案
 * DELETE /api/admin/users/:id
 */
app.delete("/api/admin/users/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  try {
    const user = await db
      .prepare("SELECT * FROM users WHERE id = ? OR openid = ?")
      .bind(id, id)
      .first<any>();
    const userId = user ? user.id : id;
    const openid = user ? user.openid : id;
    const phone = user ? user.phone : "";

    // 1. 级联删除该客户保存的所有收货/安装地址
    await db
      .prepare("DELETE FROM user_addresses WHERE user_id = ? OR user_id = ?")
      .bind(userId, openid)
      .run();

    // 2. 查找该客户关联的所有订单 ID
    let sql = "SELECT id FROM orders WHERE user_id = ? OR user_id = ?";
    const params: any[] = [userId, openid];
    if (phone) {
      sql += " OR customer_phone = ?";
      params.push(phone);
    }
    const { results: userOrders } = await db
      .prepare(sql)
      .bind(...params)
      .all<{ id: string }>();
    const orderIds = (userOrders || []).map((o) => o.id);

    // 3. 级联删除订单商品明细项与状态扭转日志
    for (const oId of orderIds) {
      await db
        .prepare("DELETE FROM order_items WHERE order_id = ?")
        .bind(oId)
        .run();
      await db
        .prepare("DELETE FROM order_status_logs WHERE order_id = ?")
        .bind(oId)
        .run();
    }

    // 4. 级联删除订单主表记录
    for (const oId of orderIds) {
      await db.prepare("DELETE FROM orders WHERE id = ?").bind(oId).run();
    }

    // 5. 彻底删除客户主档案
    await db
      .prepare("DELETE FROM users WHERE id = ? OR openid = ?")
      .bind(userId, openid)
      .run();
  } catch (e) {}

  return c.json({
    success: true,
    message: "客户档案及其历史订单与地址已全量清理完毕！",
  });
});

/**
 * 获取用户的收货/安装地址列表
 * GET /api/user/addresses?user_id=xxx
 */
app.get("/api/user/addresses", async (c) => {
  const db = c.env.DB;
  const access = await resolveCustomerAccess(c, db, c.req.query("user_id"));
  if ("status" in access) {
    return c.json({ success: false, message: access.message }, access.status);
  }


  const { results } = await db
    .prepare(
      "SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC",
    )
    .bind(access.id)
    .all();

  return c.json({ success: true, data: results || [] });
});

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
  const access = await resolveCustomerAccess(c, db, user_id);
  if ("status" in access) {
    return c.json({ success: false, message: access.message }, access.status);
  }

  if (!name || !phone || !detail_address) {
    return c.json(
      { success: false, message: "请填写完整的联系人、电话及详细地址" },
      400,
    );
  }


  if (is_default) {
    await db
      .prepare("UPDATE user_addresses SET is_default = 0 WHERE user_id = ?")
      .bind(access.id)
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
        access.id,
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
        access.id,
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
  const access = await resolveCustomerAccess(c, db, c.req.query("user_id"));
  if ("status" in access) {
    return c.json({ success: false, message: access.message }, access.status);
  }
  const id = c.req.param("id");
  await db.prepare("DELETE FROM user_addresses WHERE id = ? AND user_id = ?").bind(id, access.id).run();
  return c.json({ success: true, message: "地址已删除" });
});

/**
 * 设置为默认地址
 * PATCH /api/user/addresses/:id/default
 */
app.patch("/api/user/addresses/:id/default", async (c) => {
  const db = c.env.DB;
  let body: any = {};
  try {
    body = await c.req.json();
  } catch (error) {}
  const access = await resolveCustomerAccess(c, db, body.user_id || c.req.query("user_id"));
  if ("status" in access) {
    return c.json({ success: false, message: access.message }, access.status);
  }
  const id = c.req.param("id");

  await db
    .prepare("UPDATE user_addresses SET is_default = 0 WHERE user_id = ?")
    .bind(access.id)
    .run();
  await db
    .prepare(
      "UPDATE user_addresses SET is_default = 1 WHERE id = ? AND user_id = ?",
    )
    .bind(id, access.id)
    .run();

  return c.json({ success: true, message: "默认地址设置成功" });
});

// ----------------------------------------------------
// 2. 门窗分类接口 (Categories)
// ----------------------------------------------------



/**
 * 获取活动门窗分类列表
 * GET /api/categories
 */
app.get("/api/categories", async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ success: false, message: "数据库 DB 未绑定" }, 500);
  }

  const { results } = await db
    .prepare(
      `
    SELECT * FROM categories 
    WHERE is_active = 1 
    ORDER BY sort_order ASC, created_at DESC
  `,
    )
    .all<Category>();

  return c.json({
    success: true,
    data: results || [],
    categories: results || [],
  });
});

// ----------------------------------------------------
// 3. 门窗商品与选配项 (Products & Options)
// ----------------------------------------------------



/**
 * 获取商品列表 (支持按分类、热门和关键词筛选)
 * GET /api/products?category_id=cat_1&hot=1&keyword=系统窗
 */
app.get("/api/products", async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ success: false, message: "数据库 DB 未绑定" }, 500);
  }

  const categoryId = c.req.query("category_id");
  const categoryName = c.req.query("category_name") || c.req.query("category");
  const targetCategory = categoryId || categoryName;
  const hotOnly = c.req.query("hot") === "1";
  const keyword = (c.req.query("keyword") || c.req.query("search") || "").trim();

  try {
    await initProductHotField(db);
    const filters = ["is_active = 1"];
    const params: string[] = [];

    if (hotOnly) {
      filters.push("is_hot = 1");
    }
    if (targetCategory) {
      filters.push("(category_id = ? OR category_name = ? OR name LIKE ?)");
      params.push(targetCategory, targetCategory, `%${targetCategory}%`);
    }
    if (keyword) {
      filters.push("(name LIKE ? OR description LIKE ? OR category_name LIKE ?)");
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const { results } = await db
      .prepare(
        `SELECT * FROM products WHERE ${filters.join(" AND ")} ORDER BY sort_order ASC, created_at DESC`,
      )
      .bind(...params)
      .all<any>();
    let list = results || [];

    // 单次批量拉取当前商品的选配规则，避免 N+1 查询和无关规则传输。
    const optionsGroupMap: Record<string, any[]> = {};
    try {
      const productIds = list.map((product: any) => product.id);
      if (productIds.length > 0) {
        const placeholders = productIds.map(() => "?").join(", ");
        const { results: allOptions } = await db
          .prepare(`SELECT * FROM product_options WHERE product_id IN (${placeholders}) ORDER BY sort_order ASC`)
          .bind(...productIds)
          .all<any>();
        (allOptions || []).forEach((o: any) => {
          if (!optionsGroupMap[o.product_id]) optionsGroupMap[o.product_id] = [];
          optionsGroupMap[o.product_id].push(o);
        });
      }
    } catch (e) {}

    for (const prod of list) {
      prod.options = optionsGroupMap[prod.id] || [];
    }

    return c.json({ success: true, data: list });
  } catch (err) {
    console.error("get products failed:", err);
    return c.json({ success: false, message: "商品加载失败，请稍后重试" }, 500);
  }
});



/**
 * 保存/更新产品的全量选配规则列表
 * POST /api/admin/products/:id/options
 */
app.post("/api/admin/products/:id/options", async (c) => {
  const db = c.env.DB;
  if (!db) return c.json({ success: false, message: "DB 未绑定" }, 500);
  const id = c.req.param("id");
  const body = await c.req.json();
  const options = body.options || [];

  try {
    // 1. 删除该商品原有的选配规则
    await db
      .prepare("DELETE FROM product_options WHERE product_id = ?")
      .bind(id)
      .run();

    // 2. 批量插入最新的选配规则列表 (为每条插入自动生成绝对唯一的主键 ID，杜绝全局主键冲突)
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const optId = `opt_${id.replace(/[^a-zA-Z0-9]/g, "")}_${Date.now()}_${i}_${Math.floor(1000 + Math.random() * 9000)}`;
      const groupName = opt.group_name || opt.group_title || "glass";
      const groupTitle =
        opt.group_title ||
        opt.groupTitle ||
        opt.group_name ||
        groupName ||
        "选配分组";
      const optionName = opt.option_name || opt.name || "";

      await db
        .prepare(
          `
        INSERT INTO product_options (id, product_id, group_name, group_title, option_name, price_type, price, is_default, sort_order, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .bind(
          optId,
          id,
          groupName,
          groupTitle,
          optionName,
          opt.price_type || "fixed",
          Number(opt.price || 0),
          opt.is_default ? 1 : 0,
          i,
          opt.image_url || "",
        )
        .run();
    }

    return c.json({ success: true, message: "选配规则更新成功！" });
  } catch (e: any) {
    return c.json(
      { success: false, message: "保存失败: " + (e.message || String(e)) },
      500,
    );
  }
});

/**
 * 获取指定门窗商品详情 (包含结构化选配分组)
 * GET /api/products/:id
 */
app.get("/api/products/:id", async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ success: false, message: "数据库 DB 未绑定" }, 500);
  }
  const id = c.req.param("id");

  const product = await db
    .prepare("SELECT * FROM products WHERE id = ? AND is_active = 1")
    .bind(id)
    .first<Product>();
  if (!product) {
    return c.json({ success: false, message: "商品不存在或已下架" }, 404);
  }

  // 读取对应选配规则
  const { results: rawOptions } = await db
    .prepare(
      `
    SELECT * FROM product_options 
    WHERE product_id = ? 
    ORDER BY sort_order ASC
  `,
    )
    .bind(id)
    .all<ProductOption>();

  const options = (rawOptions || []).map((opt) => {
    let priceText = "包含在基础单价内";
    if (opt.price > 0) {
      if (opt.price_type === "per_sqm") priceText = `+¥ ${opt.price} / ㎡`;
      else if (opt.price_type === "per_item")
        priceText = `+¥ ${opt.price} / 套`;
      else priceText = `+¥ ${opt.price}`;
    } else if (opt.group_name === "color" && opt.is_default) {
      priceText = "标准配色";
    }
    return {
      ...opt,
      priceText,
    };
  });

  // 按 group_name 进行分组归纳 (如 glass, hardware, color)
  const groupMap: Record<
    string,
    { group_name: string; groupTitle: string; options: ProductOption[] }
  > = {};
  options.forEach((opt) => {
    if (!groupMap[opt.group_name]) {
      groupMap[opt.group_name] = {
        group_name: opt.group_name,
        groupTitle: opt.group_title || opt.group_name,
        options: [],
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
app.post("/api/orders", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();

  const {
    user_id,
    customer_name,
    customer_phone,
    install_address,
    customer_remark,
    admin_remark,
    scene_images,
    product_id,
    product_name,
    base_price_sqm,
    min_area,
    status: requestedStatus,
    creator_type,
    customSets: rawCustomSets,
    items: rawItems,
  } = body;

  const admin = c.get("admin");
  const currentUser = c.get("user");
  if (creator_type === "admin" && !admin) {
    return c.json({ success: false, message: "请先登录后台管理系统" }, 401);
  }
  if (!admin && !currentUser) {
    return c.json({ success: false, message: "登录状态无效，请重新登录" }, 401);
  }

  const cleanPhone = (customer_phone || "").trim();
  if (!cleanPhone || !/^1[3-9]\d{9}$/.test(cleanPhone)) {
    return c.json(
      { success: false, message: "必须提供有效的手机号码方可提交订单" },
      400,
    );
  }

  const customSets =
    rawCustomSets && rawCustomSets.length > 0 ? rawCustomSets : rawItems || [];

  if (!customSets || !Array.isArray(customSets) || customSets.length === 0) {
    return c.json(
      { success: false, message: "请至少添加一套门窗定制配置" },
      400,
    );
  }

  const orderId = `ord_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const orderNo = `ZC${dateStr}${Math.floor(1000 + Math.random() * 9000)}`;
  const isAdminCreated = creator_type === "admin";
  const allowedStatuses = new Set(["pending_review", "producing", "installing", "completed", "cancelled"]);
  // 小程序用户只能创建待复核订单，不能通过请求伪造已取消或其他状态。
  const initialStatus = isAdminCreated && allowedStatuses.has(requestedStatus)
    ? requestedStatus
    : "pending_review";

  // 小程序订单始终归属当前已验证的微信用户；后台代客下单才按手机号匹配客户。
  let validUserId: string | null = null;
  const rawUserId = (user_id || "").trim();
  if (!admin) {
    validUserId = currentUser!.id;
  } else if (cleanPhone) {
    try {
      let targetUser = await db
        .prepare("SELECT * FROM users WHERE phone = ? LIMIT 1")
        .bind(cleanPhone)
        .first<User>();

      if (!targetUser && rawUserId) {
        const currentU = await db
          .prepare("SELECT * FROM users WHERE id = ?")
          .bind(rawUserId)
          .first<User>();
        if (currentU) {
          if (!currentU.phone) {
            await db
              .prepare(
                'UPDATE users SET phone = ?, nickname = COALESCE(NULLIF(nickname, ""), ?) WHERE id = ?',
              )
              .bind(cleanPhone, customer_name || "客户", currentU.id)
              .run();
            currentU.phone = cleanPhone;
          }
          targetUser = currentU;
        }
      }

      if (!targetUser) {
        const autoUserId = `usr_${cleanPhone}`;
        await db
          .prepare(
            `
          INSERT INTO users (id, openid, nickname, phone, role)
          VALUES (?, ?, ?, ?, 'customer')
          ON CONFLICT(id) DO UPDATE SET
            phone = excluded.phone,
            nickname = COALESCE(NULLIF(users.nickname, ""), excluded.nickname)
        `,
          )
          .bind(
            autoUserId,
            `wx_openid_${autoUserId}`,
            customer_name || "客户",
            cleanPhone,
          )
          .run();
        targetUser = await db
          .prepare("SELECT * FROM users WHERE id = ?")
          .bind(autoUserId)
          .first<User>();
      }

      if (targetUser) {
        validUserId = targetUser.id;
      }
    } catch (e) {}
  } else if (admin && rawUserId) {
    try {
      const u = await db
        .prepare("SELECT id FROM users WHERE id = ?")
        .bind(rawUserId)
        .first<{ id: string }>();
      if (u) validUserId = u.id;
    } catch (e) {}
  }

  let validProductId: string | null = null;
  const rawProdId = (product_id || "").trim();
  if (rawProdId) {
    try {
      const p = await db
        .prepare("SELECT id FROM products WHERE id = ?")
        .bind(rawProdId)
        .first<{ id: string }>();
      if (p) validProductId = p.id;
    } catch (e) {}
  }

  // 获取产品及其选配规则用于精确算价
  const product = validProductId
    ? await db
        .prepare("SELECT * FROM products WHERE id = ?")
        .bind(validProductId)
        .first<Product>()
    : await db.prepare("SELECT * FROM products LIMIT 1").first<Product>();

  const targetProdId = validProductId || (product ? product.id : null);
  const { results: options } = targetProdId
    ? await db
        .prepare("SELECT * FROM product_options WHERE product_id = ?")
        .bind(targetProdId)
        .all<ProductOption>()
    : { results: [] };

  const optionMap = new Map<string, ProductOption>();
  (options || []).forEach((o) => optionMap.set(o.id, o));

  let totalSets = customSets.length;
  let totalBilledArea = 0;
  let totalBaseAmount = 0;
  let totalExtraAmount = 0;
  let totalFinalAmount = 0;
  const normalizedSceneImages = normalizeImageUrls(scene_images);

  // 插入订单主表记录 (包含现场图片 scene_images)
  await db
    .prepare(
      `
    INSERT INTO orders 
    (id, order_no, user_id, customer_name, customer_phone, install_address, customer_remark, scene_images, total_sets, total_area, base_amount, extra_amount, special_charges_amount, final_amount, status, creator_type, creator_id, creator_name, admin_remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, ?, ?, ?, ?, ?)
  `,
    )
    .bind(
      orderId,
      orderNo,
      validUserId,
      customer_name || "客户",
      customer_phone || "",
      install_address || "",
      customer_remark || "",
      normalizedSceneImages,
      totalSets,
      initialStatus,
      isAdminCreated ? "admin" : "customer",
      isAdminCreated ? admin!.id : currentUser!.id,
      isAdminCreated ? admin!.nickname || admin!.username : customer_name || "客户本人",
      admin_remark || "",
    )
    .run();

  // 逐套算价并插入明细项
  for (let i = 0; i < customSets.length; i++) {
    const set = customSets[i];
    const width = Number(set.width_mm) || 2400;
    const height = Number(set.height_mm) || 2100;
    const label =
      set.label ||
      `${customer_name || "care"}-${dateStr.slice(2)}-${i + 1}`;
    const selectedOptionsMap = set.selected_options || {};

    const itemRemark = set.remark || set.customer_remark || set.note || "";
    const itemImages = normalizeImageUrls(
      set.scene_images || set.scene_image || set.images,
    );

    // 筛选当前套系选中的选配规则 (完全按下单当时的前端已选中文快照保存，确保与后续商品修改彻底隔离)
    const selectedOptionObjects: ProductOption[] = [];
    const selectedOptionsSummary: Array<{
      groupTitle: string;
      option_name: string;
      priceText: string;
      image_url?: string;
    }> = [];

    if (
      Array.isArray(set.selectedOptionsSummary) &&
      set.selectedOptionsSummary.length > 0
    ) {
      set.selectedOptionsSummary.forEach((so: any) => {
        let name = so.option_name || so.name || "";
        const groupTitle = so.groupTitle || so.group_name || "选配";
        if (name) {
          selectedOptionsSummary.push({
            groupTitle,
            option_name: name,
            priceText: so.priceText || "",
            image_url: so.image_url || "",
          });
          
          selectedOptionObjects.push({
            id: so.id || "",
            product_id: "",
            group_name: so.group_name || groupTitle,
            group_title: groupTitle,
            option_name: name,
            price: Number(so.price || 0),
            price_type: so.price_type || "fixed",
            is_default: so.is_default ? 1 : 0,
            sort_order: Number(so.sort_order || 0),
            image_url: so.image_url || "",
            created_at: "",
            updated_at: ""
          });
        }
      });
    }

    if (selectedOptionsSummary.length === 0) {
      Object.keys(selectedOptionsMap).forEach((grpKey) => {
        const rawVal = selectedOptionsMap[grpKey];
        const optId =
          typeof rawVal === "string"
            ? rawVal
            : rawVal && (rawVal.id || rawVal.option_name);

        let optObj = optId ? optionMap.get(optId) : null;
        if (!optObj && optId) {
          optObj =
            (options || []).find(
              (o) =>
                o.id === optId ||
                o.option_name === optId ||
                ((o.group_name === grpKey || o.group_title === grpKey) &&
                  o.is_default === 1),
            ) || null;
        }

        let name = optObj
          ? optObj.option_name
          : typeof rawVal === "string"
            ? rawVal
            : rawVal?.option_name || rawVal?.name || "";
        let groupTitle = optObj
          ? optObj.group_title || optObj.group_name || grpKey
          : grpKey;

        if (optObj) {
          selectedOptionObjects.push(optObj);
          let pText = "包含在基础单价内";
          if (optObj.price > 0) {
            if (optObj.price_type === "per_sqm")
              pText = `+¥ ${optObj.price} / ㎡`;
            else if (optObj.price_type === "per_item")
              pText = `+¥ ${optObj.price} / 套`;
            else pText = `+¥ ${optObj.price}`;
          } else if (optObj.group_name === "color" && optObj.is_default) {
            pText = "标准配色";
          }
          selectedOptionsSummary.push({
            groupTitle,
            option_name: name,
            priceText: pText,
            image_url: optObj.image_url || "",
          });
        } else if (name) {
          selectedOptionsSummary.push({
            groupTitle,
            option_name: name,
            priceText: "",
          });
        }
      });
    }

    const pricing = calculateDoorWindowPrice({
      width_mm: width,
      height_mm: height,
      quantity: 1,
      base_price_sqm: base_price_sqm || product?.base_price_sqm || 680,
      min_area: min_area || product?.min_area || 1,
      selected_options: selectedOptionObjects.map((o) => ({
        price_type: o.price_type,
        price: o.price,
      })),
    });

    totalBilledArea += pricing.billed_area;
    totalBaseAmount += pricing.base_amount;
    totalExtraAmount += pricing.extra_amount;
    totalFinalAmount += pricing.subtotal;

    const itemId = `item_${Date.now()}_${i + 1}`;
    await db
      .prepare(
        `
      INSERT INTO order_items 
      (id, order_id, product_id, product_name, label, width_mm, height_mm, actual_area, billed_area, unit_price, item_subtotal, selected_options_json, options_summary_json, remark, scene_images)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .bind(
        itemId,
        orderId,
        validProductId,
        product_name || product?.name || "展晨108热桥级系统断桥铝窗",
        label,
        width,
        height,
        pricing.actual_area,
        pricing.billed_area,
        base_price_sqm || product?.base_price_sqm || 680,
        pricing.subtotal,
        JSON.stringify(selectedOptionsMap),
        JSON.stringify(selectedOptionsSummary),
        itemRemark,
        itemImages,
      )
      .run();
  }

  // 格式化并更新订单主表总金额
  totalBilledArea = Number(totalBilledArea.toFixed(2));
  totalBaseAmount = Number(totalBaseAmount.toFixed(2));
  totalExtraAmount = Number(totalExtraAmount.toFixed(2));
  totalFinalAmount = Number(totalFinalAmount.toFixed(2));

  await db
    .prepare(
      `
    UPDATE orders 
    SET total_area = ?, base_amount = ?, extra_amount = ?, final_amount = ? 
    WHERE id = ?
  `,
    )
    .bind(
      totalBilledArea,
      totalBaseAmount,
      totalExtraAmount,
      totalFinalAmount,
      orderId,
    )
    .run();

  // 记录订单生成日志
  await db
    .prepare(
      `
    INSERT INTO order_status_logs 
    (id, order_id, operator_name, from_status, to_status, remark) 
    VALUES (?, ?, ?, '', ?, ?)
  `,
    )
    .bind(
      `log_${Date.now()}`,
      orderId,
      isAdminCreated ? admin!.nickname || admin!.username : customer_name || "客户本人",
      initialStatus,
      isAdminCreated ? "管理员代客户创建订单" : "客户本人创建门窗多套定制订单",
    )
    .run();

  return c.json({
    success: true,
    order_id: orderId,
    order_no: orderNo,
    total_sets: totalSets,
    total_area: totalBilledArea,
    final_amount: totalFinalAmount,
    status: initialStatus,
  });
});

/**
 * 获取订单列表 (支持 user_id, status, order_no, customer, product_name, keyword 模糊搜索与服务端分页 page/pageSize)
 * GET /api/orders?status=pending_review&order_no=ZC&customer=张&product_name=108&page=1&pageSize=10
 */
app.get("/api/orders", async (c) => {
  const db = c.env.DB;
  await initOrderQueryIndexes(db);
  const isAdmin = Boolean(c.get("admin"));
  const tokenUserId = getBearerTokenUserId(c);

  // A request carrying a mini-program token must be scoped to that user.
  // Never trust a user_id supplied by the client when a token is present.
  if (!isAdmin && !tokenUserId) {
    return c.json({ success: false, message: "登录状态无效，请重新登录" }, 401);
  }
  const userId = tokenUserId || (isAdmin ? c.req.query("user_id") : null);
  const status = c.req.query("status");
  const orderNo = c.req.query("order_no");
  const customer = c.req.query("customer");
  const productName = c.req.query("product_name");
  const keyword = c.req.query("keyword") || c.req.query("search");
  const startTime = (c.req.query("start_time") || "").trim();
  const endTime = (c.req.query("end_time") || "").trim();

  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const pageSize = Math.max(
    1,
    parseInt(c.req.query("pageSize") || c.req.query("limit") || "10", 10),
  );
  const offset = (page - 1) * pageSize;

  let whereClause = " WHERE 1=1";
  const params: any[] = [];

  if (userId) {
    whereClause += " AND o.user_id = ?";
    params.push(userId);
  }
  if (orderNo && orderNo.trim() !== "") {
    whereClause += " AND o.order_no LIKE ?";
    params.push(`%${orderNo.trim()}%`);
  }
  if (customer && customer.trim() !== "") {
    const cust = `%${customer.trim()}%`;
    whereClause +=
      " AND (o.customer_name LIKE ? OR o.customer_phone LIKE ? OR u.nickname LIKE ?)";
    params.push(cust, cust, cust);
  }
  if (productName && productName.trim() !== "") {
    whereClause += " AND oi.product_name LIKE ?";
    params.push(`%${productName.trim()}%`);
  }
  if (keyword && keyword.trim() !== "") {
    const kw = `%${keyword.trim()}%`;
    whereClause +=
      " AND (o.order_no LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ? OR u.nickname LIKE ? OR oi.product_name LIKE ?)";
    params.push(kw, kw, kw, kw, kw);
  }
  if (startTime) {
    whereClause += " AND o.created_at >= ?";
    params.push(startTime);
  }
  if (endTime) {
    whereClause += " AND o.created_at <= ?";
    params.push(endTime);
  }

  // 状态计数不受当前状态页签影响，供小程序一次请求渲染全部页签数量。
  const statusCountsWhereClause = whereClause;
  const statusCountsParams = [...params];
  if (status && status !== "all") {
    whereClause += " AND o.status = ?";
    params.push(status);
  }

  // 1. 查询符合条件的总记录数
  const countSql = `SELECT COUNT(DISTINCT o.id) as total FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id LEFT JOIN users u ON o.user_id = u.id${whereClause}`;
  const countRes = await db
    .prepare(countSql)
    .bind(...params)
    .first<{ total: number }>();
  const total = countRes ? countRes.total : 0;

  const { results: statusCountRows } = await db
    .prepare(
      `SELECT o.status, COUNT(DISTINCT o.id) as total FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id LEFT JOIN users u ON o.user_id = u.id${statusCountsWhereClause} GROUP BY o.status`,
    )
    .bind(...statusCountsParams)
    .all<{ status: string; total: number }>();
  const statusCounts = (statusCountRows || []).reduce<Record<string, number>>((counts, row) => {
    counts[row.status] = Number(row.total || 0);
    return counts;
  }, {});

  // 2. 分页查询当前页订单列表
  const dataSql = `SELECT DISTINCT o.* FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id LEFT JOIN users u ON o.user_id = u.id${whereClause} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
  const dataParams = [...params, pageSize, offset];
  const { results: orders } = await db
    .prepare(dataSql)
    .bind(...dataParams)
    .all<Order>();

  // Fetch item snapshots for the whole page in one query to avoid N+1 reads.
  const orderIds = (orders || []).map((order) => order.id);
  const itemsByOrder = new Map<string, OrderItem[]>();
  if (orderIds.length) {
    const placeholders = orderIds.map(() => "?").join(", ");
    const { results: items } = await db
      .prepare(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`)
      .bind(...orderIds)
      .all<OrderItem>();
    (items || []).forEach((it) => {
      let summary: any[] = [];
      if (it.options_summary_json) {
        try {
          summary = JSON.parse(it.options_summary_json);
        } catch (e) {
          summary = [];
        }
      }
      if (!summary || summary.length === 0) {
        let selMap: any = {};
        if (it.selected_options_json) {
          try {
            selMap = JSON.parse(it.selected_options_json);
          } catch (e) {
            selMap = {};
          }
        }
        if (selMap && typeof selMap === "object") {
          summary = Object.keys(selMap)
            .map((grp) => {
              const rawVal = selMap[grp];
              const optName =
                typeof rawVal === "string"
                  ? rawVal
                  : rawVal && (rawVal.option_name || rawVal.name || rawVal.id);
              return {
                groupTitle: grp,
                option_name: optName || "",
                priceText: "",
              };
            })
            .filter((o) => o.option_name);
        }
      }
      it.options_summary = summary;
      const orderItems = itemsByOrder.get(it.order_id) || [];
      orderItems.push(it);
      itemsByOrder.set(it.order_id, orderItems);
    });
  }
  (orders || []).forEach((order) => {
    order.items = itemsByOrder.get(order.id) || [];
  });

  return c.json({
    success: true,
    data: orders || [],
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
    status_counts: statusCounts,
  });
});

/**
 * 删除订单 (软删除或硬删除，这里采用硬删除)
 * DELETE /api/orders/:id
 */
app.delete("/api/orders/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  if (!c.get("admin")) {
    return c.json({ success: false, message: "请先登录后台管理系统" }, 401);
  }

  try {
    // 检查订单是否存在
    const order = await db
      .prepare("SELECT id FROM orders WHERE id = ?")
      .bind(id)
      .first();
      
    if (!order) {
      return c.json({ success: false, message: "订单不存在或已删除" }, 404);
    }

    // 删除订单明细
    await db.prepare("DELETE FROM order_items WHERE order_id = ?").bind(id).run();
    // 删除订单状态日志
    await db.prepare("DELETE FROM order_status_logs WHERE order_id = ?").bind(id).run();
    // 删除主订单
    await db.prepare("DELETE FROM orders WHERE id = ?").bind(id).run();

    return c.json({ success: true, message: "订单已成功删除" });
  } catch (error: any) {
    return c.json(
      { success: false, message: "删除订单失败: " + error.message },
      500
    );
  }
});

/**
 * 获取特定订单详情 (包含多套明细与流转日志)
 * GET /api/orders/:id
 */
app.get("/api/orders/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const isAdmin = Boolean(c.get("admin"));
  const tokenUserId = getBearerTokenUserId(c);

  if (!isAdmin && !tokenUserId) {
    return c.json({ success: false, message: "登录状态无效，请重新登录" }, 401);
  }

  const order = await db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .bind(id)
    .first<Order>();
  if (!order) {
    return c.json({ success: false, message: "未找到对应订单记录" }, 404);
  }

  // Do not reveal whether another customer's order exists.
  if (!isAdmin && tokenUserId && order.user_id !== tokenUserId) {
    return c.json({ success: false, message: "无权查看该订单" }, 403);
  }

  const { results: items } = await db
    .prepare("SELECT * FROM order_items WHERE order_id = ?")
    .bind(id)
    .all<OrderItem>();

  (items || []).forEach((it) => {
    let summary: any[] = [];
    if (it.options_summary_json) {
      try {
        summary = JSON.parse(it.options_summary_json);
      } catch (e) {
        summary = [];
      }
    }

    // 严禁关联产品动态配置表，保证历史订单快照 100% 隔离不联动
    if (!summary || summary.length === 0) {
      let selMap: any = {};
      if (it.selected_options_json) {
        try {
          selMap = JSON.parse(it.selected_options_json);
        } catch (e) {
          selMap = {};
        }
      }
      if (selMap && typeof selMap === "object") {
        summary = Object.keys(selMap)
          .map((grp) => {
            const rawVal = selMap[grp];
            let optName = "";
            let pText = "";
            if (typeof rawVal === "string") {
              optName = rawVal;
            } else if (rawVal && typeof rawVal === "object") {
              optName = rawVal.option_name || rawVal.name || rawVal.id || "";
              pText =
                rawVal.priceText ||
                (rawVal.price > 0 ? `+¥ ${rawVal.price}` : "");
            }
            return {
              groupTitle: grp,
              option_name: optName,
              priceText: pText,
            };
          })
          .filter((o) => o.option_name);
      }
    }

    it.options_summary = summary;
  });

  const { results: logs } = await db
    .prepare(
      "SELECT * FROM order_status_logs WHERE order_id = ? ORDER BY created_at ASC",
    )
    .bind(id)
    .all();

  order.items = items || [];
  return c.json({
    success: true,
    data: {
      order,
      logs: logs || [],
    },
  });
});

// ----------------------------------------------------
// 5. 管理端后台专属 API (Admin Dashboard APIs)
// ----------------------------------------------------
// 5. 管理端 RBAC 权限系统与专属 API (Admin Dashboard RBAC & APIs)
// ----------------------------------------------------

/**
 * 操作日志查询
 * GET /api/admin/audit-logs?event_type=订单状态&actor_username=admin&user_nickname=张&user_phone=138&page=1&pageSize=20&start_time=...&end_time=...
 */
app.get("/api/admin/audit-logs", async (c) => {
  const db = c.env.DB;
  const eventType = (c.req.query("event_type") || "").trim();
  const actorUsername = (c.req.query("actor_username") || "").trim();
  const userNickname = (c.req.query("user_nickname") || "").trim();
  const userPhone = (c.req.query("user_phone") || "").trim();
  const startTime = (c.req.query("start_time") || "").trim();
  const endTime = (c.req.query("end_time") || "").trim();
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query("pageSize") || "20", 10)));
  const params: any[] = [];
  let where = " WHERE 1=1";

  if (eventType) { where += " AND event_type = ?"; params.push(eventType); }
  if (actorUsername) {
    where += " AND (actor_username LIKE ? OR actor_name LIKE ?)";
    params.push(`%${actorUsername}%`, `%${actorUsername}%`);
  }
  if (userNickname) { where += " AND user_nickname LIKE ?"; params.push(`%${userNickname}%`); }
  if (userPhone) { where += " AND user_phone LIKE ?"; params.push(`%${userPhone}%`); }
  if (startTime) { where += " AND created_at >= ?"; params.push(startTime); }
  if (endTime) { where += " AND created_at <= ?"; params.push(endTime); }

  const count = await db.prepare(`SELECT COUNT(*) as total FROM audit_logs${where}`).bind(...params).first<{ total: number }>();
  const total = Number(count?.total || 0);
  const rows = await db.prepare(
    `SELECT * FROM audit_logs${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
  ).bind(...params, pageSize, (page - 1) * pageSize).all<any>();

  return c.json({
    success: true,
    data: rows.results || [],
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

let rbacInitializationPromise: Promise<void> | null = null;



/**
 * 管理员登录接口
 * POST /api/admin/login
 */
app.post("/api/admin/login", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { username, password } = body;

  const cleanUser = (username || "").trim();
  const cleanPass = (password || "").trim();

  if (!cleanUser || !cleanPass) {
    return c.json({ success: false, message: "请输入管理员账号与密码" }, 400);
  }

  const adminAccount = await db
    .prepare(
      `
    SELECT a.*, r.name as role_name, r.code as role_code 
    FROM admin_users a 
    LEFT JOIN roles r ON a.role_id = r.id 
    WHERE a.username = ? AND a.password = ?
  `,
    )
    .bind(cleanUser, cleanPass)
    .first<any>();

  if (!adminAccount) {
    return c.json({ success: false, message: "管理员账号或密码不正确" }, 401);
  }

  if (adminAccount.status === 0) {
    return c.json(
      { success: false, message: "该管理员账号已被禁用，请联系超级管理员" },
      403,
    );
  }

  let menus: string[] = [];
  if (adminAccount.role_code === "root") {
    const { results: allMenuRows } = await db
      .prepare(
        "SELECT key FROM sys_menus WHERE is_visible = 1 ORDER BY sort_order ASC",
      )
      .all<{ key: string }>();
    menus = (allMenuRows || []).map((m) => m.key);
  } else {
    const { results: roleMenuRows } = await db
      .prepare(
        `
      SELECT rm.menu_key 
      FROM role_menus rm 
      JOIN sys_menus sm ON rm.menu_key = sm.key 
      WHERE rm.role_id = ? AND sm.is_visible = 1 
      ORDER BY sm.sort_order ASC
    `,
      )
      .bind(adminAccount.role_id)
      .all<{ menu_key: string }>();
    menus = (roleMenuRows || []).map((m) => m.menu_key);
  }

  return c.json({
    success: true,
    user: {
      id: adminAccount.id,
      username: adminAccount.username,
      nickname: adminAccount.nickname || adminAccount.username,
      role_id: adminAccount.role_id,
      role_name: adminAccount.role_name || "后台角色",
      role_code: adminAccount.role_code || "custom",
      phone: adminAccount.phone || "",
    },
    menus,
    token: await createAdminSession(db, adminAccount.id),
  });
});

app.post("/api/admin/logout", async (c) => {
  const authorization = c.req.header("Authorization") || "";
  const match = authorization.match(/^Bearer\s+(zc_admin_token_[A-Za-z0-9-]+)$/i);
  if (match) {
    await initAdminSessions(c.env.DB);
    await c.env.DB.prepare("DELETE FROM admin_sessions WHERE token = ?").bind(match[1]).run();
  }
  return c.json({ success: true });
});

/* ================= 系统菜单 CRUD 接口 ================= */

app.get("/api/admin/sys-menus", async (c) => {
  const db = c.env.DB;
  const { results: menus } = await db
    .prepare("SELECT * FROM sys_menus ORDER BY sort_order ASC")
    .all<any>();
  return c.json({ success: true, data: menus || [] });
});

app.post("/api/admin/sys-menus", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { key, name, path, icon, sort_order, is_visible } = body;

  if (!key || !name || !path) {
    return c.json(
      {
        success: false,
        message: "【菜单 Key】、【菜单名称】与【路由路径】为必填项",
      },
      400,
    );
  }

  const existing = await db
    .prepare("SELECT id FROM sys_menus WHERE key = ?")
    .bind(key.trim())
    .first();
  if (existing) {
    return c.json({ success: false, message: `菜单 Key【${key}】已存在` }, 400);
  }

  const id = `m_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
  await db
    .prepare(
      `
    INSERT INTO sys_menus (id, key, name, path, icon, sort_order, is_visible)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .bind(
      id,
      key.trim(),
      name.trim(),
      path.trim(),
      icon || "IconMenu",
      sort_order || 0,
      is_visible !== undefined ? is_visible : 1,
    )
    .run();

  await db
    .prepare(
      "INSERT OR IGNORE INTO role_menus (role_id, menu_key) VALUES ('role_root', ?)",
    )
    .bind(key.trim())
    .run();
  return c.json({ success: true, message: "新增菜单成功" });
});

app.put("/api/admin/sys-menus/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();
  const { key, name, path, icon, sort_order, is_visible } = body;

  if (!key || !name || !path) {
    return c.json(
      {
        success: false,
        message: "【菜单 Key】、【菜单名称】与【路由路径】为必填项",
      },
      400,
    );
  }

  const oldMenu = await db
    .prepare("SELECT * FROM sys_menus WHERE id = ?")
    .bind(id)
    .first<any>();
  if (!oldMenu) {
    return c.json({ success: false, message: "菜单记录不存在" }, 404);
  }

  if (oldMenu.key !== key.trim()) {
    await db
      .prepare("UPDATE role_menus SET menu_key = ? WHERE menu_key = ?")
      .bind(key.trim(), oldMenu.key)
      .run();
  }

  await db
    .prepare(
      `
    UPDATE sys_menus 
    SET key = ?, name = ?, path = ?, icon = ?, sort_order = ?, is_visible = ?
    WHERE id = ?
  `,
    )
    .bind(
      key.trim(),
      name.trim(),
      path.trim(),
      icon || "IconMenu",
      sort_order || 0,
      is_visible !== undefined ? is_visible : 1,
      id,
    )
    .run();

  return c.json({ success: true, message: "修改菜单成功" });
});

app.delete("/api/admin/sys-menus/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const oldMenu = await db
    .prepare("SELECT * FROM sys_menus WHERE id = ?")
    .bind(id)
    .first<any>();
  if (oldMenu) {
    await db
      .prepare("DELETE FROM role_menus WHERE menu_key = ?")
      .bind(oldMenu.key)
      .run();
    await db.prepare("DELETE FROM sys_menus WHERE id = ?").bind(id).run();
  }
  return c.json({ success: true, message: "删除菜单成功" });
});

/* ================= 角色与权限 CRUD 接口 ================= */

app.get("/api/admin/roles", async (c) => {
  const db = c.env.DB;
  const { results: roles } = await db
    .prepare("SELECT * FROM roles ORDER BY created_at ASC")
    .all<any>();

  const { results: menuRows } = await db
    .prepare("SELECT role_id, menu_key FROM role_menus")
    .all<{ role_id: string; menu_key: string }>();
  const menuKeysByRole = new Map<string, string[]>();
  for (const row of menuRows || []) {
    const keys = menuKeysByRole.get(row.role_id) || [];
    keys.push(row.menu_key);
    menuKeysByRole.set(row.role_id, keys);
  }
  for (const role of roles || []) {
    role.menu_keys = menuKeysByRole.get(role.id) || [];
  }

  return c.json({ success: true, data: roles || [] });
});

app.post("/api/admin/roles", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { name, code, description, menu_keys } = body;

  if (!name || !code) {
    return c.json(
      { success: false, message: "【角色名称】与【角色标识】为必填项" },
      400,
    );
  }

  const existing = await db
    .prepare("SELECT id FROM roles WHERE code = ?")
    .bind(code.trim())
    .first();
  if (existing) {
    return c.json(
      { success: false, message: `角色标识【${code}】已存在` },
      400,
    );
  }

  const id = `role_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
  await db
    .prepare(
      `
    INSERT INTO roles (id, name, code, description)
    VALUES (?, ?, ?, ?)
  `,
    )
    .bind(id, name.trim(), code.trim(), description || "")
    .run();

  if (Array.isArray(menu_keys)) {
    for (const k of menu_keys) {
      await db
        .prepare("INSERT INTO role_menus (role_id, menu_key) VALUES (?, ?)")
        .bind(id, k)
        .run();
    }
  }

  return c.json({ success: true, message: "创建角色成功" });
});

app.put("/api/admin/roles/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();
  const { name, code, description, menu_keys } = body;

  if (!name || !code) {
    return c.json(
      { success: false, message: "【角色名称】与【角色标识】为必填项" },
      400,
    );
  }

  await db
    .prepare(
      `
    UPDATE roles 
    SET name = ?, code = ?, description = ?
    WHERE id = ?
  `,
    )
    .bind(name.trim(), code.trim(), description || "", id)
    .run();

  if (Array.isArray(menu_keys)) {
    await db.prepare("DELETE FROM role_menus WHERE role_id = ?").bind(id).run();
    for (const k of menu_keys) {
      await db
        .prepare("INSERT INTO role_menus (role_id, menu_key) VALUES (?, ?)")
        .bind(id, k)
        .run();
    }
  }

  return c.json({ success: true, message: "修改角色成功" });
});

app.delete("/api/admin/roles/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const targetRole = await db
    .prepare("SELECT * FROM roles WHERE id = ?")
    .bind(id)
    .first<any>();
  if (targetRole && targetRole.code === "root") {
    return c.json(
      { success: false, message: "Root 超级管理员角色禁止删除" },
      400,
    );
  }

  await db.prepare("DELETE FROM role_menus WHERE role_id = ?").bind(id).run();
  await db.prepare("DELETE FROM roles WHERE id = ?").bind(id).run();
  return c.json({ success: true, message: "删除角色成功" });
});

/* ================= 管理员账号 CRUD 接口 ================= */

app.get("/api/admin/users", async (c) => {
  const db = c.env.DB;
  const { results: users } = await db
    .prepare(
      `
    SELECT a.*, r.name as role_name, r.code as role_code 
    FROM admin_users a 
    LEFT JOIN roles r ON a.role_id = r.id 
    ORDER BY a.created_at DESC
  `,
    )
    .all<any>();

  return c.json({ success: true, data: users || [] });
});

app.post("/api/admin/users", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { username, password, nickname, phone, role_id, status } = body;

  if (!username || !password || !role_id) {
    return c.json(
      {
        success: false,
        message: "【登录账号】、【登录密码】与【角色权限】为必填项",
      },
      400,
    );
  }

  const existing = await db
    .prepare("SELECT id FROM admin_users WHERE username = ?")
    .bind(username.trim())
    .first();
  if (existing) {
    return c.json(
      { success: false, message: `管理员账号【${username}】已存在` },
      400,
    );
  }

  const id = `admin_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
  await db
    .prepare(
      `
    INSERT INTO admin_users (id, username, password, nickname, phone, role_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .bind(
      id,
      username.trim(),
      password.trim(),
      nickname || username,
      phone || "",
      role_id,
      status !== undefined ? status : 1,
    )
    .run();

  return c.json({ success: true, message: "创建管理员账号成功" });
});

app.put("/api/admin/users/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();
  const { password, nickname, phone, role_id, status } = body;

  const target = await db
    .prepare("SELECT * FROM admin_users WHERE id = ?")
    .bind(id)
    .first<any>();
  if (!target) {
    return c.json({ success: false, message: "管理员账号不存在" }, 404);
  }

  let sql =
    "UPDATE admin_users SET nickname = ?, phone = ?, role_id = ?, status = ?";
  const params: any[] = [
    nickname || target.username,
    phone || "",
    role_id || target.role_id,
    status !== undefined ? status : target.status,
  ];

  if (password && password.trim()) {
    sql += ", password = ?";
    params.push(password.trim());
  }

  sql += " WHERE id = ?";
  params.push(id);

  await db
    .prepare(sql)
    .bind(...params)
    .run();
  return c.json({ success: true, message: "更新管理员账号成功" });
});

app.delete("/api/admin/users/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const target = await db
    .prepare("SELECT * FROM admin_users WHERE id = ?")
    .bind(id)
    .first<any>();
  if (target && (target.username === "admin" || target.id === "admin_root")) {
    return c.json(
      { success: false, message: "Root 超级管理员主账号禁止删除" },
      400,
    );
  }

  await db.prepare("DELETE FROM admin_users WHERE id = ?").bind(id).run();
  return c.json({ success: true, message: "删除管理员账号成功" });
});

/**
 * 管理端仪表盘统计概览
 * GET /api/admin/stats
 */
app.get("/api/admin/stats", async (c) => {
  const db = c.env.DB;
  const { results: orders } = await db
    .prepare(
      "SELECT id, status, final_amount, created_at, updated_at FROM orders",
    )
    .all<any>();

  let totalOrders = (orders || []).length;
  let pendingReviewCount = 0;
  let producingCount = 0;
  let installingCount = 0;
  let completedCount = 0;
  let totalRevenue = 0;

  (orders || []).forEach((o) => {
    totalRevenue += o.final_amount || 0;
    if (o.status === "pending_review") pendingReviewCount++;
    else if (o.status === "producing") producingCount++;
    else if (o.status === "installing") installingCount++;
    else if (o.status === "completed") completedCount++;
  });

  // 近 7 天订单与交付走势真实数据计算
  const dates: string[] = [];
  const createdCounts: number[] = [];
  const completedCounts: number[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(5, 10);
    const fullDateStr = d.toISOString().slice(0, 10);
    dates.push(dateStr);

    const cCount = (orders || []).filter((o) =>
      (o.created_at || "").startsWith(fullDateStr),
    ).length;
    const fCount = (orders || []).filter(
      (o) =>
        o.status === "completed" &&
        (o.updated_at || "").startsWith(fullDateStr),
    ).length;
    createdCounts.push(cCount);
    completedCounts.push(fCount);
  }

  // 热门门窗系列选购分布真实数据
  let productDistribution: Array<{ name: string; value: number }> = [];
  try {
    const { results: items } = await db
      .prepare("SELECT product_name FROM order_items")
      .all<{ product_name: string }>();
    const prodMap: Record<string, number> = {};
    (items || []).forEach((it) => {
      const pName = it.product_name || "其他系统门窗";
      prodMap[pName] = (prodMap[pName] || 0) + 1;
    });

    productDistribution = Object.keys(prodMap).map((name) => ({
      name,
      value: prodMap[name],
    }));
  } catch (e) {}

  if (productDistribution.length === 0) {
    try {
      const { results: products } = await db
        .prepare("SELECT name FROM products WHERE is_active = 1 LIMIT 5")
        .all<{ name: string }>();
      productDistribution = (products || []).map((p) => ({
        name: p.name,
        value: 0,
      }));
    } catch (e) {}
  }

  return c.json({
    success: true,
    data: {
      totalOrders,
      pendingReviewCount,
      producingCount,
      installingCount,
      completedCount,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      recentTrends: {
        dates,
        createdCounts,
        completedCounts,
      },
      productDistribution,
      statusDistribution: [
        { name: "待复核", count: pendingReviewCount },
        { name: "生产中", count: producingCount },
        { name: "待提货", count: installingCount },
        { name: "已完成", count: completedCount },
      ],
    },
  });
});

/**
 * 管理端 扭转订单状态 & 追加特殊费用
 * PATCH /api/admin/orders/:id/status
 */
app.patch("/api/admin/orders/:id/status", async (c) => {
  const db = c.env.DB;
  const admin = c.get("admin");
  const id = c.req.param("id");
  const body = await c.req.json();
  const { new_status, admin_remark, special_charges_amount } = body;

  const currentOrder = await db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .bind(id)
    .first<Order>();
  if (!currentOrder) {
    return c.json({ success: false, message: "未找到订单记录" }, 404);
  }

  const oldStatus = currentOrder.status;
  let newSpecialCharges = currentOrder.special_charges_amount || 0;
  let newFinalAmount = currentOrder.final_amount;

  if (
    special_charges_amount !== undefined &&
    !isNaN(Number(special_charges_amount))
  ) {
    newSpecialCharges = Number(special_charges_amount);
    newFinalAmount = Number(
      (
        currentOrder.base_amount +
        currentOrder.extra_amount +
        newSpecialCharges
      ).toFixed(2),
    );
  }

  const targetStatus = new_status || oldStatus;
  const validStatuses = new Set(["pending_review", "producing", "installing", "completed", "cancelled"]);
  if (!validStatuses.has(targetStatus)) {
    return c.json({ success: false, message: "订单状态不合法" }, 400);
  }
  const targetRemark = admin_remark || currentOrder.admin_remark || "";

  await db
    .prepare(
      `
    UPDATE orders 
    SET status = ?, admin_remark = ?, special_charges_amount = ?, final_amount = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `,
    )
    .bind(targetStatus, targetRemark, newSpecialCharges, newFinalAmount, id)
    .run();

  // 写入状态扭转日志
  await db
    .prepare(
      `
    INSERT INTO order_status_logs (id, order_id, operator_name, from_status, to_status, remark) 
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    )
    .bind(
      `log_${Date.now()}`,
      id,
      admin.nickname || admin.username,
      oldStatus,
      targetStatus,
      targetRemark || `状态变更: ${oldStatus} -> ${targetStatus}`,
    )
    .run();

  return c.json({
    success: true,
    order_id: id,
    status: targetStatus,
    special_charges_amount: newSpecialCharges,
    final_amount: newFinalAmount,
  });
});

/**
 * 管理端 获取全量分类列表 (包含已禁用的分类)
 * GET /api/admin/categories
 */
app.get("/api/admin/categories", async (c) => {
  const db = c.env.DB;

  const nameQuery = (c.req.query("name") || c.req.query("keyword") || "")
    .trim()
    .toLowerCase();

  const { results } = await db
    .prepare(
      `
    SELECT * FROM categories 
    ORDER BY sort_order ASC, created_at DESC
  `,
    )
    .all<any>();

  let list = results || [];
  if (nameQuery) {
    list = list.filter(
      (cat: any) =>
        (cat.name && cat.name.toLowerCase().includes(nameQuery)) ||
        (cat.sub_title && cat.sub_title.toLowerCase().includes(nameQuery)),
    );
  }

  return c.json({ success: true, data: list, categories: list });
});

/**
 * 管理端 分类管理 CRUD (创建、编辑、物理删除、快捷修改排序)
 * POST /api/admin/categories
 */
app.post("/api/admin/categories", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();

  if (!body.name || !body.name.trim()) {
    return c.json({ success: false, message: "分类名称为必填项" }, 400);
  }

  const id = body.id || `cat_${Date.now()}`;
  const name = body.name.trim();
  const sub_title =
    (body.sub_title && body.sub_title.trim()) || name.slice(0, 5);
  const icon_url = body.icon_url || "";
  const sortOrder =
    body.sort_order !== undefined && body.sort_order !== null
      ? Number(body.sort_order)
      : 0;
  const isActive =
    body.is_active !== undefined && body.is_active !== null
      ? Number(body.is_active)
      : 1;

  // UPSERT: ID 存在即更新原记录，不存在则精准新建
  await db
    .prepare(
      `
    INSERT INTO categories (id, name, sub_title, icon_url, sort_order, is_active) 
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
      name = excluded.name, 
      sub_title = excluded.sub_title, 
      icon_url = excluded.icon_url,
      sort_order = excluded.sort_order,
      is_active = excluded.is_active
  `,
    )
    .bind(id, name, sub_title, icon_url, sortOrder, isActive)
    .run();

  return c.json({ success: true, id, message: "保存成功！" });
});

app.put("/api/admin/categories/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();
  const name = (body.name || "").trim();
  const sub_title =
    (body.sub_title && body.sub_title.trim()) || name.slice(0, 5);
  const icon_url = body.icon_url || "";
  const sortOrder =
    body.sort_order !== undefined && body.sort_order !== null
      ? Number(body.sort_order)
      : 0;
  const isActive =
    body.is_active !== undefined && body.is_active !== null
      ? Number(body.is_active)
      : 1;

  await db
    .prepare(
      `
    INSERT INTO categories (id, name, sub_title, icon_url, sort_order, is_active) 
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
      name = excluded.name, 
      sub_title = excluded.sub_title, 
      icon_url = excluded.icon_url,
      sort_order = excluded.sort_order,
      is_active = excluded.is_active
  `,
    )
    .bind(id, name, sub_title, icon_url, sortOrder, isActive)
    .run();

  return c.json({ success: true, message: "保存成功！" });
});

// 快捷更新排序权重
app.patch("/api/admin/categories/:id/sort", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();
  const sortOrder = Number(body.sort_order || 0);

  await db
    .prepare("UPDATE categories SET sort_order = ? WHERE id = ?")
    .bind(sortOrder, id)
    .run();
  return c.json({ success: true, message: "排序修改成功！" });
});

// 物理删除分类
app.delete("/api/admin/categories/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  await db.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
  return c.json({ success: true, message: "删除成功！" });
});

/**
 * 管理端 获取全量商品列表 (支持名称模糊搜索与分类多选筛选)
 * GET /api/admin/products
 */
app.get("/api/admin/products", async (c) => {
  const db = c.env.DB;
  await initProductHotField(db);

  const nameQuery = (c.req.query("name") || c.req.query("keyword") || "")
    .trim()
    .toLowerCase();
  const categoryParam =
    c.req.query("categories") || c.req.query("category_name") || "";

  const { results } = await db
    .prepare("SELECT * FROM products ORDER BY sort_order ASC, created_at DESC")
    .all<any>();
  let list = results || [];

  if (nameQuery) {
    list = list.filter(
      (p: any) =>
        (p.name && p.name.toLowerCase().includes(nameQuery)) ||
        (p.description && p.description.toLowerCase().includes(nameQuery)),
    );
  }

  if (categoryParam) {
    const selectedCats = categoryParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (selectedCats.length > 0) {
      list = list.filter(
        (p: any) =>
          selectedCats.includes(p.category_name) ||
          selectedCats.includes(p.category_id),
      );
    }
  }

  const optionsGroupMap: Record<string, any[]> = {};
  try {
    const { results: allOptions } = await db
      .prepare("SELECT * FROM product_options ORDER BY sort_order ASC")
      .all<any>();
    (allOptions || []).forEach((o: any) => {
      if (!optionsGroupMap[o.product_id]) optionsGroupMap[o.product_id] = [];
      optionsGroupMap[o.product_id].push(o);
    });
  } catch (e) {}

  for (const prod of list) {
    prod.options = optionsGroupMap[prod.id] || [];
  }

  return c.json({ success: true, data: list });
});

/**
 * 管理端 单独更新商品上下架状态
 * PATCH /api/admin/products/:id/status
 */
app.patch("/api/admin/products/:id/status", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();
  const isActive = Number(body.is_active);

  if (![0, 1].includes(isActive)) {
    return c.json({ success: false, message: "商品状态参数不合法" }, 400);
  }

  const result = await db
    .prepare("UPDATE products SET is_active = ? WHERE id = ?")
    .bind(isActive, id)
    .run();

  if (!result.meta.changes) {
    return c.json({ success: false, message: "未找到商品记录" }, 404);
  }

  return c.json({ success: true, id, is_active: isActive, message: "商品状态更新成功" });
});

/**
 * 管理端 单独更新商品热门推荐状态
 * PATCH /api/admin/products/:id/hot
 */
app.patch("/api/admin/products/:id/hot", async (c) => {
  const db = c.env.DB;
  await initProductHotField(db);
  const id = c.req.param("id");
  const body = await c.req.json();
  const isHot = Number(body.is_hot);

  if (![0, 1].includes(isHot)) {
    return c.json({ success: false, message: "热门推荐参数不合法" }, 400);
  }

  const result = await db
    .prepare("UPDATE products SET is_hot = ? WHERE id = ?")
    .bind(isHot, id)
    .run();

  if (!result.meta.changes) {
    return c.json({ success: false, message: "未找到商品记录" }, 404);
  }

  return c.json({ success: true, id, is_hot: isHot, message: "热门推荐更新成功" });
});

/**
 * 管理端 商品管理 CRUD (支持上下架 is_active 设置)
 * POST /api/admin/products
 */
app.post("/api/admin/products", async (c) => {
  const db = c.env.DB;
  await initProductHotField(db);
  const body = await c.req.json();

  if (!body.name || !body.name.trim()) {
    return c.json({ success: false, message: "商品名称为必填项" }, 400);
  }


  const id = body.id || `prod_${Date.now()}`;
  const name = body.name.trim();
  const isActive =
    body.is_active !== undefined && body.is_active !== null
      ? Number(body.is_active)
      : 1;
  const isHot = Number(body.is_hot) === 1 ? 1 : 0;

  let validCategoryId: string | null = null;
  const rawCatId = (body.category_id || "").trim();
  const rawCatName = (body.category_name || "").trim();

  if (rawCatId || rawCatName) {
    try {
      const existingCat = await db
        .prepare("SELECT id FROM categories WHERE id = ? OR name = ?")
        .bind(rawCatId, rawCatName)
        .first<{ id: string }>();

      if (existingCat) {
        validCategoryId = existingCat.id;
      }
    } catch (e) {}
  }

  // UPSERT: ID 存在即覆盖修改原记录，不存在则新增，绝对零重复
  await db
    .prepare(
      `
    INSERT INTO products (id, category_id, category_name, name, description, cover_image, base_price_sqm, min_area, sort_order, is_active, is_hot, default_width, default_height)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      category_id = excluded.category_id,
      category_name = excluded.category_name,
      name = excluded.name,
      description = excluded.description,
      cover_image = excluded.cover_image,
      base_price_sqm = excluded.base_price_sqm,
      min_area = excluded.min_area,
      is_active = excluded.is_active,
      is_hot = excluded.is_hot,
      default_width = excluded.default_width,
      default_height = excluded.default_height
  `,
    )
    .bind(
      id,
      validCategoryId,
      rawCatName,
      name,
      body.description || "",
      body.cover_image || "",
      body.base_price_sqm || 680,
      body.min_area !== undefined && body.min_area !== null
        ? Number(body.min_area)
        : 1,
      isActive,
      isHot,
      body.default_width ? Number(body.default_width) : null,
      body.default_height ? Number(body.default_height) : null,
    )
    .run();

  // 若新建商品尚未绑定选配规则，自动填充用户指定的 6 大标准化默认分组与细项规则
  try {
    const { results: existingOpts } = await db
      .prepare("SELECT id FROM product_options WHERE product_id = ?")
      .bind(id)
      .all();
    if (!existingOpts || existingOpts.length === 0) {
      const defaultOptions = [
        {
          group_name: "玻璃配置",
          option_name: "双层玻璃",
          price_type: "fixed",
          price: 0,
          is_default: 1,
        },
        {
          group_name: "玻璃配置",
          option_name: "双层钢化玻璃",
          price_type: "fixed",
          price: 50,
          is_default: 0,
        },
        {
          group_name: "门锁配置",
          option_name: "默认门锁",
          price_type: "fixed",
          price: 0,
          is_default: 1,
        },
        {
          group_name: "铝材配置",
          option_name: "默认铝材",
          price_type: "fixed",
          price: 0,
          is_default: 1,
        },
        {
          group_name: "颜色配置",
          option_name: "琉璃白",
          price_type: "fixed",
          price: 0,
          is_default: 1,
        },
        {
          group_name: "颜色配置",
          option_name: "深空灰",
          price_type: "fixed",
          price: 0,
          is_default: 0,
        },
        {
          group_name: "开门方向",
          option_name: "左锁（左合页）",
          price_type: "fixed",
          price: 0,
          is_default: 1,
        },
        {
          group_name: "开门方向",
          option_name: "右锁（左合页）",
          price_type: "fixed",
          price: 0,
          is_default: 0,
        },
        {
          group_name: "开门内外",
          option_name: "内开（朝内打开）",
          price_type: "fixed",
          price: 0,
          is_default: 1,
        },
        {
          group_name: "开门内外",
          option_name: "外开（朝外打开）",
          price_type: "fixed",
          price: 0,
          is_default: 0,
        },
      ];

      for (let i = 0; i < defaultOptions.length; i++) {
        const opt = defaultOptions[i];
        const optId = `opt_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;
        await db
          .prepare(
            `
          INSERT INTO product_options (id, product_id, group_name, option_name, price_type, price, is_default, sort_order, image_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, '')
        `,
          )
          .bind(
            optId,
            id,
            opt.group_name,
            opt.option_name,
            opt.price_type,
            opt.price,
            opt.is_default,
            i,
          )
          .run();
      }
    }
  } catch (e) {}

  return c.json({ success: true, id, message: "保存成功" });
});

app.put("/api/admin/products/:id", async (c) => {
  const db = c.env.DB;
  await initProductHotField(db);
  const id = c.req.param("id");
  const body = await c.req.json();
  const name = (body.name || "").trim();
  const isActive =
    body.is_active !== undefined && body.is_active !== null
      ? Number(body.is_active)
      : 1;
  const isHot = Number(body.is_hot) === 1 ? 1 : 0;

  let validCategoryId: string | null = null;
  const rawCatId = (body.category_id || "").trim();
  const rawCatName = (body.category_name || "").trim();

  if (rawCatId || rawCatName) {
    try {
      const existingCat = await db
        .prepare("SELECT id FROM categories WHERE id = ? OR name = ?")
        .bind(rawCatId, rawCatName)
        .first<{ id: string }>();

      if (existingCat) {
        validCategoryId = existingCat.id;
      }
    } catch (e) {}
  }

  await db
    .prepare(
      `
    INSERT INTO products (id, category_id, category_name, name, description, cover_image, base_price_sqm, min_area, sort_order, is_active, is_hot, default_width, default_height)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      category_id = excluded.category_id,
      category_name = excluded.category_name,
      name = excluded.name,
      description = excluded.description,
      cover_image = excluded.cover_image,
      base_price_sqm = excluded.base_price_sqm,
      min_area = excluded.min_area,
      is_active = excluded.is_active,
      is_hot = excluded.is_hot,
      default_width = excluded.default_width,
      default_height = excluded.default_height
  `,
    )
    .bind(
      id,
      validCategoryId,
      rawCatName,
      name,
      body.description || "",
      body.cover_image || "",
      body.base_price_sqm || 680,
      body.min_area !== undefined && body.min_area !== null
        ? Number(body.min_area)
        : 1,
      isActive,
      isHot,
      body.default_width ? Number(body.default_width) : null,
      body.default_height ? Number(body.default_height) : null,
    )
    .run();

  return c.json({ success: true, message: "保存成功" });
});

app.delete("/api/admin/products/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  await db
    .prepare("UPDATE products SET is_active = 0 WHERE id = ?")
    .bind(id)
    .run();
  return c.json({ success: true, message: "商品已下架" });
});



/**
 * 获取接单员列表 (小程序及管理后台使用)
 * GET /api/receivers
 */
app.get("/api/receivers", async (c) => {
  const db = c.env.DB;

  const { results } = await db
    .prepare(
      "SELECT * FROM receivers WHERE is_active = 1 ORDER BY created_at ASC",
    )
    .all<any>();
  let list = results || [];

  if (!list || list.length === 0) {
    const defaultReceivers = [
      {
        id: "rec_1",
        name: "李师傅 (仙桃店主管)",
        phone: "13545941637",
        qr_code_url: "https://zc-oss.carelife.top/common/qr-li.png",
        is_active: 1,
      },
      {
        id: "rec_2",
        name: "张经理 (客服拓展经理)",
        phone: "13888889999",
        qr_code_url: "https://zc-oss.carelife.top/common/qr-zhang.png",
        is_active: 1,
      },
    ];
    for (const r of defaultReceivers) {
      try {
        await db
          .prepare(
            "INSERT OR IGNORE INTO receivers (id, name, phone, qr_code_url, is_active) VALUES (?, ?, ?, ?, 1)",
          )
          .bind(r.id, r.name, r.phone, r.qr_code_url)
          .run();
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
app.post("/api/admin/receivers", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { id, name, phone, qr_code_url } = body;

  if (!name || !phone) {
    return c.json(
      { success: false, message: "【姓名】与【手机号】为必填项" },
      400,
    );
  }

  if (id) {
    await db
      .prepare(
        `
      UPDATE receivers 
      SET name = ?, phone = ?, qr_code_url = ? 
      WHERE id = ?
    `,
      )
      .bind(name, phone, qr_code_url || "", id)
      .run();

    return c.json({ success: true, id, message: "接单员更新成功" });
  } else {
    const newId = `rec_${Date.now()}`;
    await db
      .prepare(
        `
      INSERT INTO receivers (id, name, phone, qr_code_url, is_active) 
      VALUES (?, ?, ?, ?, 1)
    `,
      )
      .bind(newId, name, phone, qr_code_url || "")
      .run();

    return c.json({ success: true, id: newId, message: "接单员添加成功" });
  }
});

/**
 * 删除 (停用) 接单员
 * DELETE /api/admin/receivers/:id
 */
app.delete("/api/admin/receivers/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  await db
    .prepare("UPDATE receivers SET is_active = 0 WHERE id = ?")
    .bind(id)
    .run();
  return c.json({ success: true, message: "接单员已移出列表" });
});



/**
 * 获取门店配置信息 (小程序及管理后台使用)
 * GET /api/config/store
 */
app.get("/api/config/store", async (c) => {
  const db = c.env.DB;

  const config = await db
    .prepare("SELECT * FROM store_config WHERE id = ?")
    .bind("default")
    .first<any>();
  if (config) {
    return c.json({ success: true, data: config });
  }

  const defaultConfig = {
    id: "default",
    name: "展晨门窗",
    phone: "13545941637",
    address: "湖北省仙桃市恒迪建材市场2期14栋1-107",
    latitude: null,
    longitude: null,
    business_hours: "08:30 - 18:30",
  };
  return c.json({ success: true, data: defaultConfig });
});

/**
 * 修改保存门店配置信息
 * POST /api/admin/config/store
 */
app.post("/api/admin/config/store", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { name, phone, address, latitude, longitude, business_hours } = body;

  if (!name || !phone || !address) {
    return c.json(
      {
        success: false,
        message: "【门店名称】、【客服电话】与【详细地址】为必填项",
      },
      400,
    );
  }


  try {
    await db.prepare("ALTER TABLE store_config ADD COLUMN latitude REAL").run();
  } catch (e) {}
  try {
    await db
      .prepare("ALTER TABLE store_config ADD COLUMN longitude REAL")
      .run();
  } catch (e) {}

  const lat =
    latitude !== undefined && latitude !== null && latitude !== ""
      ? parseFloat(latitude)
      : null;
  const lng =
    longitude !== undefined && longitude !== null && longitude !== ""
      ? parseFloat(longitude)
      : null;

  await db
    .prepare(
      `
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
  `,
    )
    .bind(name, phone, address, lat, lng, business_hours || "08:30 - 18:30")
    .run();

  return c.json({ success: true, message: "门店信息与地图坐标保存成功" });
});

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
        is_hot INTEGER DEFAULT 0,
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
