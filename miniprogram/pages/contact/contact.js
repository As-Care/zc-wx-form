/** 展晨门窗 联系我们与接单员页面逻辑 **/
const { request } = require('../../utils/request');
const app = getApp();

Page({
  data: {
    storeInfo: app.globalData.storeInfo,
    receivers: []
  },

  onShow() {
    this.fetchStoreConfig();
    this.fetchReceivers();
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

  fetchReceivers() {
    request({ url: '/api/receivers' }).then(res => {
      if (res.success && res.data) {
        this.setData({ receivers: res.data });
      } else {
        this.setData({ receivers: [] });
      }
    }).catch(() => {
      this.setData({ receivers: [] });
    });
  },

  callStore() {
    wx.makePhoneCall({
      phoneNumber: this.data.storeInfo.phone || '13545941637'
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
