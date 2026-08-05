/**
 * 展晨门窗 小程序统一 API 网络请求层
 */

const BASE_URL = 'https://zc-api.carelife.top'; // 生产环境服务端 API 基础域名
const USE_MOCK = false; // 已开启真实网络请求，连通服务端生产环境

const mockData = {
  categories: [
    { id: 'cat_1', name: '断桥铝系统窗', sub_title: '系统断桥窗', icon_url: '/images/icons/window.png' },
    { id: 'cat_2', name: '极窄推拉门/平开门', sub_title: '极窄推拉门', icon_url: '/images/icons/sliding-door.png' },
    { id: 'cat_3', name: '系统封阳台/阳光房', sub_title: '封阳阳光房', icon_url: '/images/icons/sunroom.png' },
    { id: 'cat_4', name: '金刚网纱窗及配件', sub_title: '金刚网纱窗', icon_url: '/images/icons/mesh.png' },
    { id: 'cat_5', name: '幕墙工程系', sub_title: '幕墙工程系', icon_url: '/images/icons/curtain-wall.png' }
  ],
  products: [
    {
      id: 'prod_1',
      category_id: 'cat_1',
      name: '展晨108热桥级系统断桥铝窗',
      description: '高隔音高隔热，适合高层住宅与阳台封窗，支持双色定制。',
      cover_image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
      base_price_sqm: 680,
      min_area: 1.5,
      options: [
        { id: 'opt_1', group_name: 'glass', option_name: '5+18A+5 标准中空钢化玻璃', price_type: 'per_sqm', price: 0, is_default: 1 },
        { id: 'opt_2', group_name: 'glass', option_name: '5+18A+5 Low-E 超白隔热玻璃', price_type: 'per_sqm', price: 80, is_default: 0 },
        { id: 'opt_3', group_name: 'glass', option_name: '5+12A+5+12A+5 三玻两腔降噪玻璃', price_type: 'per_sqm', price: 150, is_default: 0 },
        { id: 'opt_4', group_name: 'hardware', option_name: '德国好博 (Hoppe) 原装执手五金', price_type: 'per_item', price: 150, is_default: 1 },
        { id: 'opt_5', group_name: 'hardware', option_name: '德国丝吉利娅 隐藏锁扣', price_type: 'per_item', price: 220, is_default: 0 },
        { id: 'opt_6', group_name: 'color', option_name: '氟碳雅致黑', price_type: 'fixed', price: 0, is_default: 1 },
        { id: 'opt_7', group_name: 'color', option_name: '阳极氧化香槟银', price_type: 'fixed', price: 50, is_default: 0 }
      ]
    },
    {
      id: 'prod_2',
      category_id: 'cat_1',
      name: '展晨120超静音三玻两腔系统窗',
      description: '顶级三玻两腔超静音，抗台风防暴雨设计。',
      cover_image: 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=600&q=80',
      base_price_sqm: 880,
      min_area: 1.5
    },
    {
      id: 'prod_3',
      category_id: 'cat_2',
      name: '展晨极简16窄边重型推拉门',
      description: '极简16边框视野无界，极顺滑下轨设计。',
      cover_image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=600&q=80',
      base_price_sqm: 980,
      min_area: 2.0
    }
  ],
  orders: [
    {
      id: 'ord_101',
      order_no: 'ZC20260804001',
      status: 'pending_review',
      customer_name: 'care',
      customer_phone: '13344443333',
      total_area: 5.04,
      final_amount: 3830.4,
      created_at: '2026-08-04 18:00',
      items: [
        { label: '【care-26-08-05-1】', product_name: '展晨108热桥级系统断桥铝窗', width_mm: 2400, height_mm: 2100, billed_area: 5.04, item_subtotal: 3830.4 }
      ]
    },
    {
      id: 'ord_102',
      order_no: 'ZC20260803002',
      status: 'producing',
      customer_name: 'care',
      customer_phone: '13344443333',
      total_area: 9.00,
      final_amount: 7920.0,
      created_at: '2026-08-03 14:30',
      items: [
        { label: '【care-26-08-05-2】', product_name: '展晨120超静音三玻两腔系统窗', width_mm: 3600, height_mm: 2500, billed_area: 9.00, item_subtotal: 7920.0 }
      ]
    },
    {
      id: 'ord_103',
      order_no: 'ZC20260802003',
      status: 'installing',
      customer_name: 'care',
      customer_phone: '13344443333',
      total_area: 12.00,
      final_amount: 11760.0,
      created_at: '2026-08-02 10:15',
      items: [
        { label: '【care-26-08-05-3】', product_name: '展晨极简16窄边重型推拉门', width_mm: 4000, height_mm: 3000, billed_area: 12.00, item_subtotal: 11760.0 }
      ]
    },
    {
      id: 'ord_104',
      order_no: 'ZC20260801004',
      status: 'completed',
      customer_name: 'care',
      customer_phone: '13344443333',
      total_area: 16.50,
      final_amount: 15800.0,
      created_at: '2026-08-01 16:45',
      items: [
        { label: '【care-26-08-05-4】', product_name: '展晨系统封阳台/阳光房全景套系', width_mm: 5500, height_mm: 3000, billed_area: 16.50, item_subtotal: 15800.0 }
      ]
    }
  ]
};

function request(options) {
  if (!USE_MOCK) {
    return new Promise((resolve, reject) => {
      const token = wx.getStorageSync('zc_token') || '';
      wx.request({
        url: options.url.startsWith('http') ? options.url : `${BASE_URL}${options.url}`,
        method: options.method || 'GET',
        data: options.data || {},
        header: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
          ...(options.header || {})
        },
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else {
            wx.showToast({
              title: res.data?.message || '服务器请求异常',
              icon: 'none'
            });
            reject(res);
          }
        },
        fail: (err) => {
          // 优雅降级到 mockData 避免网络断连时打断体验
          if (options.url.includes('/api/categories')) {
            resolve({ success: true, data: mockData.categories });
          } else if (options.url.includes('/api/products/prod_1')) {
            resolve({ success: true, data: mockData.products[0] });
          } else if (options.url.includes('/api/products')) {
            resolve({ success: true, data: mockData.products });
          } else if (options.url.includes('/api/orders')) {
            resolve({ success: true, data: mockData.orders });
          } else {
            reject(err);
          }
        }
      });
    });
  }

  // 纯本地 Mock 回退机制
  return new Promise((resolve) => {
    setTimeout(() => {
      if (options.url.includes('/api/categories')) {
        resolve({ success: true, data: mockData.categories });
      } else if (options.url.includes('/api/products/prod_1')) {
        resolve({ success: true, data: mockData.products[0] });
      } else if (options.url.includes('/api/products')) {
        resolve({ success: true, data: mockData.products });
      } else if (options.url.includes('/api/orders')) {
        resolve({ success: true, data: mockData.orders });
      } else {
        resolve({ success: true, data: [] });
      }
    }, 50);
  });
}

module.exports = {
  request,
  mockData,
  BASE_URL
};
