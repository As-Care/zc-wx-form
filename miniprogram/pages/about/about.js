/** 关于展晨门窗 页面逻辑 **/
const { request } = require('../../utils/request');
const app = getApp();

Page({
  data: {
    storeInfo: app.globalData.storeInfo
  },

  onShow() {
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
            business_hours: res.data.business_hours || '08:30 - 18:30'
          }
        });
      }
    }).catch(() => {});
  },

  callStore() {
    wx.makePhoneCall({
      phoneNumber: this.data.storeInfo.phone || '13545941637'
    });
  }
});
