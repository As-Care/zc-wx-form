/** 关于展晨门窗 页面逻辑 **/
const app = getApp();

Page({
  data: {
    storeInfo: app.globalData.storeInfo
  },

  callStore() {
    wx.makePhoneCall({
      phoneNumber: this.data.storeInfo.phone
    });
  }
});
