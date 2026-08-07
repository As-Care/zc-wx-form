-- 展晨门窗 D1 Database SQLite Schema

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  openid VARCHAR(128) UNIQUE,
  nickname VARCHAR(64),
  avatar_url TEXT,
  phone VARCHAR(20),
  role VARCHAR(20) DEFAULT 'customer',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 门窗分类表 (包含 sub_title 短标题，最多5字)
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  sub_title VARCHAR(20) NOT NULL,
  icon_url TEXT,
  sort_order INT DEFAULT 0,
  is_active INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. 门窗商品表
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(64) PRIMARY KEY,
  category_id VARCHAR(64) REFERENCES categories(id),
  name VARCHAR(128) NOT NULL,
  description TEXT,
  cover_image TEXT,
  base_price_sqm DECIMAL(10,2) NOT NULL,
  min_area DECIMAL(5,2) DEFAULT 1.50,
  is_active INT DEFAULT 1,
  sort_order INT DEFAULT 0,
  default_width INT,
  default_height INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. 门窗选配加价规则表 (玻璃/五金/颜色)
CREATE TABLE IF NOT EXISTS product_options (
  id VARCHAR(64) PRIMARY KEY,
  product_id VARCHAR(64) REFERENCES products(id),
  group_name VARCHAR(32) NOT NULL,
  group_title VARCHAR(64) NOT NULL,
  option_name VARCHAR(128) NOT NULL,
  price_type VARCHAR(20) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_default INT DEFAULT 0,
  sort_order INT DEFAULT 0
);

-- 5. 订单主表
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) PRIMARY KEY,
  order_no VARCHAR(32) UNIQUE NOT NULL,
  user_id VARCHAR(64) REFERENCES users(id),
  customer_name VARCHAR(64) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  total_sets INT NOT NULL DEFAULT 1,
  total_area DECIMAL(8,2) NOT NULL,
  base_amount DECIMAL(10,2) NOT NULL,
  extra_amount DECIMAL(10,2) NOT NULL,
  special_charges_amount DECIMAL(10,2) DEFAULT 0.00,
  final_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(32) DEFAULT 'pending_review',
  creator_type VARCHAR(20) DEFAULT 'customer',
  creator_id VARCHAR(64),
  creator_name VARCHAR(128),
  admin_remark TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. 订单多套定制明细表
CREATE TABLE IF NOT EXISTS order_items (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) REFERENCES orders(id),
  product_id VARCHAR(64) REFERENCES products(id),
  product_name VARCHAR(128) NOT NULL,
  label VARCHAR(128) NOT NULL,
  width_mm INT NOT NULL,
  height_mm INT NOT NULL,
  actual_area DECIMAL(8,2) NOT NULL,
  billed_area DECIMAL(8,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  item_subtotal DECIMAL(10,2) NOT NULL,
  selected_options_json TEXT,
  options_summary_json TEXT
);

-- 7. 订单状态扭转日志表
CREATE TABLE IF NOT EXISTS order_status_logs (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) REFERENCES orders(id),
  operator_name VARCHAR(64),
  from_status VARCHAR(32),
  to_status VARCHAR(32),
  remark TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. 管理后台操作审计日志
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(80) PRIMARY KEY,
  event_type VARCHAR(64) NOT NULL,
  action TEXT NOT NULL,
  actor_id VARCHAR(64),
  actor_username VARCHAR(64),
  actor_name VARCHAR(128),
  target_type VARCHAR(64),
  target_id VARCHAR(128),
  target_name VARCHAR(128),
  user_id VARCHAR(64),
  user_nickname VARCHAR(64),
  user_phone VARCHAR(20),
  details_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. 管理后台会话（Cloudflare Workers + D1）
CREATE TABLE IF NOT EXISTS admin_sessions (
  token VARCHAR(96) PRIMARY KEY,
  admin_id VARCHAR(64) NOT NULL REFERENCES admin_users(id),
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 列表筛选与批量读取的索引
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_expires ON admin_sessions(admin_id, expires_at);
