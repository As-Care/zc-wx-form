/** 展晨门窗 个人中心逻辑 **/
const app = getApp();
const { request } = require('../../utils/request');

Page({
  data: {
    userInfo: {
      nickname: '',
      avatarUrl: '',
      phone: ''
    },
    storeInfo: app.globalData.storeInfo,
    orderCounts: {
      total: 1,
      pending_review: 1,
      producing: 0,
      installing: 0,
      completed: 0
    }
  },

  onShow() {
    // 读取已保存的个人信息
    const saved = wx.getStorageSync('zc_user_info');
    if (saved && (saved.nickname || saved.phone)) {
      this.setData({
        'userInfo.nickname': saved.nickname || '未登录',
        'userInfo.avatarUrl': saved.avatarUrl || '',
        'userInfo.phone': saved.phone || ''
      });
    } else {
      this.setData({
        'userInfo.nickname': '未登录',
        'userInfo.avatarUrl': '',
        'userInfo.phone': ''
      });
    }

    this.fetchOrderCounts();
    this.fetchStoreConfig();
  },

  fetchStoreConfig() {
    request({ url: '/api/config/store' }).then(res => {
      if (res.success && res.data) {
        this.setData({
          storeInfo: {
            name: res.data.name || '展晨门窗',
            phone: res.data.phone || '13545941637',
            address: res.data.address || '湖北省仙桃市恒迪建材市场2期14栋1-107',
            latitude: res.data.latitude,
            longitude: res.data.longitude,
            business_hours: res.data.business_hours || '08:30 - 18:30',
            hours: res.data.business_hours || '08:30 - 18:30'
          }
        });
      }
    }).catch(() => {});
  },

  fetchOrderCounts() {
    request({ url: '/api/orders?page=1&pageSize=1' }).then(res => {
      if (res.success) {
        const counts = res.status_counts || {};
        this.setData({
          orderCounts: {
            total: Number((res.pagination && res.pagination.total) || 0),
            pending_review: Number(counts.pending_review || 0),
            producing: Number(counts.producing || 0),
            installing: Number(counts.installing || 0),
            completed: Number(counts.completed || 0)
          }
        });
      }
    });
  },

  makePhoneCall() {
    const phoneNumber = (this.data.storeInfo && this.data.storeInfo.phone) ? this.data.storeInfo.phone : '13545941637';
    wx.showActionSheet({
      itemList: [`直接拨打 (${phoneNumber})`, `复制手机号 (${phoneNumber})`],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.makePhoneCall({
            phoneNumber,
            fail: (err) => { console.warn('拨号取消/失败', err); }
          });
        } else if (res.tapIndex === 1) {
          wx.setClipboardData({
            data: phoneNumber,
            success: () => {
              wx.showToast({ title: '已复制手机号', icon: 'success', duration: 1500 });
            }
          });
        }
      }
    });
  },

  openStoreLocation() {
    const lat = (this.data.storeInfo && this.data.storeInfo.latitude) ? Number(this.data.storeInfo.latitude) : null;
    const lng = (this.data.storeInfo && this.data.storeInfo.longitude) ? Number(this.data.storeInfo.longitude) : null;

    if (!lat || !lng) {
      wx.showToast({
        title: '商家暂未在后台配置定位坐标',
        icon: 'none',
        duration: 2500
      });
      return;
    }

    const name = this.data.storeInfo.name || '展晨门窗官方旗舰店';
    const address = this.data.storeInfo.address || '湖北省仙桃市恒迪建材市场2期14栋1-107';

    wx.openLocation({
      latitude: lat,
      longitude: lng,
      name,
      address,
      scale: 16,
      fail: (err) => {
        console.warn('调起地图失败 (模拟器环境提示):', err);
        wx.showToast({
          title: '请在手机端微信扫码预览地图导航',
          icon: 'none',
          duration: 2500
        });
      }
    });
  },

  navToOrders(e) {
    // switchTab 不支持携带 query 参数，使用一次性的全局状态把目标筛选传给订单页。
    const status = (e && e.currentTarget && e.currentTarget.dataset.status) || 'all';
    app.globalData.orderListInitialStatus = status;
    wx.switchTab({
      url: '/pages/order-list/order-list'
    });
  },

  navToAbout() {
    wx.navigateTo({
      url: '/pages/about/about'
    });
  },

  navToContact() {
    wx.navigateTo({
      url: '/pages/contact/contact'
    });
  },

  navToLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  navToAddressList() {
    wx.navigateTo({
      url: '/pages/address-list/address-list'
    });
  }
});
