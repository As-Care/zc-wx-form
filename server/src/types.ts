export interface Env {
  DB: D1Database;
  BUCKET?: R2Bucket;     // Cloudflare R2 对象存储绑定 (可选)
  JWT_SECRET: string;
  WX_APP_ID: string;      // 微信小程序 AppID
  WX_APP_SECRET: string;  // 微信小程序 AppSecret 密钥
  ENVIRONMENT: string;
}

export interface User {
  id: string;
  openid: string;
  nickname: string;
  avatar_url: string;
  phone: string;
  role: 'customer' | 'admin' | 'admin_created';
  created_at?: string;
}

export interface Category {
  id: string;
  name: string;
  sub_title: string;
  icon_url: string;
  sort_order: number;
  is_active: number;
  created_at?: string;
}

export interface ProductOption {
  id: string;
  product_id: string;
  group_name: string;
  group_title?: string;
  option_name: string;
  price_type: 'per_sqm' | 'per_item' | 'fixed';
  price: number;
  is_default: number;
  sort_order: number;
  image_url?: string;
  priceText?: string;
}

export interface Product {
  id: string;
  category_id: string;
  category_name?: string;
  name: string;
  description: string;
  cover_image: string;
  base_price_sqm: number;
  min_area: number;
  sort_order: number;
  is_active: number;
  options?: ProductOption[];
  optionGroups?: Array<{
    group_name: string;
    groupTitle: string;
    options: ProductOption[];
  }>;
  created_at?: string;
}

export interface OrderItemInput {
  product_id: string;
  product_name: string;
  label: string;
  width_mm: number;
  height_mm: number;
  selected_options: Record<string, string>;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  label: string;
  width_mm: number;
  height_mm: number;
  actual_area: number;
  billed_area: number;
  unit_price: number;
  item_subtotal: number;
  selected_options_json: string;
  options_summary_json: string;
  options_summary?: Array<{
    groupTitle: string;
    option_name: string;
    priceText: string;
  }>;
}

export interface Order {
  id: string;
  order_no: string;
  user_id: string;
  customer_name: string;
  customer_phone: string;
  total_sets: number;
  total_area: number;
  base_amount: number;
  extra_amount: number;
  special_charges_amount: number;
  final_amount: number;
  status: 'pending_review' | 'producing' | 'installing' | 'completed' | 'cancelled';
  creator_type?: 'customer' | 'admin';
  creator_id?: string;
  creator_name?: string;
  admin_remark: string;
  items?: OrderItem[];
  created_at?: string;
  updated_at?: string;
}

export interface OrderStatusLog {
  id: string;
  order_id: string;
  operator_name: string;
  from_status: string;
  to_status: string;
  remark: string;
  created_at?: string;
}
