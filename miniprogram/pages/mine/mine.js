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
  }
});
