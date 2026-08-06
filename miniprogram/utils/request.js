/**
 * 展晨门窗 小程序统一 API 网络请求层
 */

const BASE_URL = 'https://zc-api.carelife.top'; // 生产环境服务端 API 基础域名

function request(options) {
  const showLoading = options.showLoading === true;
  if (showLoading) {
    wx.showLoading({
      title: options.loadingText || '正在加载...',
      mask: true
    });
  }

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
        if (showLoading) wx.hideLoading();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          resolve({ success: false, message: res.data?.message || `服务错误 (HTTP ${res.statusCode})` });
        }
      },
      fail: (err) => {
        if (showLoading) wx.hideLoading();
        reject(err);
      }
    });
  });
}

module.exports = {
  request,
  BASE_URL
};
