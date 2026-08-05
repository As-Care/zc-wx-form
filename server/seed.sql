-- 展晨门窗 D1 数据库 种子初始数据

-- 1. 分类初始数据
INSERT OR REPLACE INTO categories (id, name, sub_title, icon_url, sort_order) VALUES
('cat_1', '断桥铝系统窗', '系统断桥窗', '/images/icons/window.png', 1),
('cat_2', '极窄推拉门/平开门', '极窄推拉门', '/images/icons/sliding-door.png', 2),
('cat_3', '系统封阳台/阳光房', '封阳阳光房', '/images/icons/sunroom.png', 3),
('cat_4', '金刚网纱窗及配件', '金刚网纱窗', '/images/icons/mesh.png', 4),
('cat_5', '幕墙工程系', '幕墙工程系', '/images/icons/curtain-wall.png', 5);

-- 2. 商品初始数据
INSERT OR REPLACE INTO products (id, category_id, name, description, cover_image, base_price_sqm, min_area, is_active, sort_order) VALUES
('prod_1', 'cat_1', '展晨108热桥级系统断桥铝窗', '高隔音高隔热，适合高层住宅与阳台封窗，支持双色定制。', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80', 680.00, 1.50, 1, 1),
('prod_2', 'cat_1', '展晨120超静音三玻两腔系统窗', '顶级三玻两腔超静音，抗台风防暴雨设计。', 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=600&q=80', 880.00, 1.50, 1, 2),
('prod_3', 'cat_2', '展晨极简16窄边重型推拉门', '极简16边框视野无界，极顺滑下轨设计。', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=600&q=80', 980.00, 2.00, 1, 3);

-- 3. 商品选配加价规则数据
INSERT OR REPLACE INTO product_options (id, product_id, group_name, group_title, option_name, price_type, price, is_default, sort_order) VALUES
-- prod_1 玻璃
('opt_1', 'prod_1', 'glass', '玻璃配置', '5+18A+5 标准中空钢化玻璃', 'per_sqm', 0.00, 1, 1),
('opt_2', 'prod_1', 'glass', '玻璃配置', '5+18A+5 Low-E 超白隔热玻璃', 'per_sqm', 80.00, 0, 2),
('opt_3', 'prod_1', 'glass', '玻璃配置', '5+12A+5+12A+5 三玻两腔降噪玻璃', 'per_sqm', 150.00, 0, 3),
-- prod_1 五金
('opt_4', 'prod_1', 'hardware', '五金配件品牌', '德国好博 (Hoppe) 原装执手', 'per_item', 150.00, 1, 1),
('opt_5', 'prod_1', 'hardware', '五金配件品牌', '德国丝吉利娅 隐藏锁扣', 'per_item', 220.00, 0, 2),
-- prod_1 颜色
('opt_6', 'prod_1', 'color', '铝材表面喷涂颜色', '氟碳雅致黑', 'fixed', 0.00, 1, 1),
('opt_7', 'prod_1', 'color', '铝材表面喷涂颜色', '阳极氧化香槟银', 'fixed', 50.00, 0, 2),

-- prod_2 选配
('opt_8', 'prod_2', 'glass', '玻璃配置', '5+12A+5+12A+5 三玻两腔降噪玻璃', 'per_sqm', 0.00, 1, 1),
('opt_9', 'prod_2', 'glass', '玻璃配置', '5+12A+5+12A+5 Low-E 超白降噪', 'per_sqm', 100.00, 0, 2),
('opt_10', 'prod_2', 'hardware', '五金配件品牌', '德国好博 (Hoppe) 原装执手', 'per_item', 0.00, 1, 1),
('opt_11', 'prod_2', 'color', '铝材表面喷涂颜色', '氟碳雅致黑', 'fixed', 0.00, 1, 1),

-- prod_3 选配
('opt_12', 'prod_3', 'glass', '玻璃配置', '8mm 强化单玻', 'per_sqm', 0.00, 1, 1),
('opt_13', 'prod_3', 'hardware', '五金配件品牌', '重型极窄下轨轴承滑轮', 'per_item', 0.00, 1, 1),
('opt_14', 'prod_3', 'color', '铝材表面喷涂颜色', '极简黑色', 'fixed', 0.00, 1, 1);

-- 4. 示例用户数据
INSERT OR REPLACE INTO users (id, openid, nickname, avatar_url, phone, role) VALUES
('user_demo_1', 'wx_openid_demo_care', 'care', 'https://zc-oss.carelife.top/common/zc-logo.jpg', '13344443333', 'customer');

-- 5. 示例订单数据 (包含多套明细与 4 种状态)
INSERT OR REPLACE INTO orders (id, order_no, user_id, customer_name, customer_phone, total_sets, total_area, base_amount, extra_amount, special_charges_amount, final_amount, status, admin_remark) VALUES
('ord_101', 'ZC20260804001', 'user_demo_1', 'care', '13344443333', 1, 5.04, 3427.20, 403.20, 0.00, 3830.40, 'pending_review', '等待接单员核对尺寸'),
('ord_102', 'ZC20260803002', 'user_demo_1', 'care', '13344443333', 1, 9.00, 7920.00, 0.00, 0.00, 7920.00, 'producing', '正安排工厂高精度切割'),
('ord_103', 'ZC20260802003', 'user_demo_1', 'care', '13344443333', 2, 8.50, 5780.00, 300.00, 0.00, 6080.00, 'installing', '成品已质检完备，等待自提/发货'),
('ord_104', 'ZC20260801004', 'user_demo_1', 'care', '13344443333', 1, 6.00, 4080.00, 200.00, 0.00, 4280.00, 'completed', '订单已顺利交货交付');

-- 6. 订单明细数据
INSERT OR REPLACE INTO order_items (id, order_id, product_id, product_name, label, width_mm, height_mm, actual_area, billed_area, unit_price, item_subtotal, selected_options_json, options_summary_json) VALUES
('item_101_1', 'ord_101', 'prod_1', '展晨108热桥级系统断桥铝窗', '【care-26-08-05-1】', 2400, 2100, 5.04, 5.04, 680.00, 3830.40, '["opt_1","opt_4","opt_6"]', '[{"groupTitle":"玻璃配置","option_name":"5+18A+5 标准中空钢化玻璃","priceText":"包含在基础单价内"},{"groupTitle":"五金配件品牌","option_name":"德国好博 (Hoppe) 原装执手","priceText":"+¥ 150 / 套"},{"groupTitle":"铝材表面喷涂颜色","option_name":"氟碳雅致黑","priceText":"标准配色"}]'),
('item_102_1', 'ord_102', 'prod_2', '展晨120超静音三玻两腔系统窗', '【care-26-08-05-2】', 3600, 2500, 9.00, 9.00, 880.00, 7920.00, '["opt_8","opt_10","opt_11"]', '[{"groupTitle":"玻璃配置","option_name":"5+12A+5+12A+5 三玻两腔降噪玻璃","priceText":"包含在基础单价内"}]');
