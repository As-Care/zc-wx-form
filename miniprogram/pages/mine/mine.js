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
            hours: res.data.business_hours || '08:30 - 18:30'
          }
        });
      }
    }).catch(() => {});
  },

  fetchOrderCounts() {
    request({ url: '/api/orders' }).then(res => {
      if (res.success && res.data) {
        const list = res.data;
        const counts = {
          total: list.length,
          pending_review: 0,
          producing: 0,
          installing: 0,
          completed: 0
        };

        list.forEach(o => {
          if (counts[o.status] !== undefined) {
            counts[o.status]++;
          }
        });

        this.setData({ orderCounts: counts });
      }
    });
  },

  makePhoneCall() {
    wx.makePhoneCall({
      phoneNumber: this.data.storeInfo.phone
    });
  },

  navToOrders(e) {
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
