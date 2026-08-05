/** 展晨门窗 联系我们与接单员页面逻辑 **/
const { request } = require('../../utils/request');
const app = getApp();

Page({
  data: {
    storeInfo: app.globalData.storeInfo,
    receivers: []
  },

  onLoad() {
    this.fetchReceivers();
  },

  fetchReceivers() {
    request({ url: '/api/receivers' }).then(res => {
      if (res.success && res.data) {
        this.setData({ receivers: res.data });
      }
    });
  },

  callStore() {
    wx.makePhoneCall({
      phoneNumber: this.data.storeInfo.phone
    });
  },

  callReceiver(e) {
    const phone = e.currentTarget.dataset.phone;
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone });
    }
  },

  previewQR(e) {
    const url = e.currentTarget.dataset.url;
    if (url) {
      wx.previewImage({
        current: url,
        urls: [url]
      });
    }
  }
});
