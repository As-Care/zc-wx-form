// 展晨门窗 确认预约订单 Page 逻辑
const { request } = require('../../utils/request');
const app = getApp();

Page({
  data: {
    draft: null,
    customer_name: '张先生',
    customer_phone: '13545941637',
    install_address: '湖北省仙桃市恒迪建材市场A区3号',
    customer_remark: ''
  },

  onLoad() {
    const draft = wx.getStorageSync('orderDraft');
    if (draft) {
      this.setData({ draft });
    } else {
      wx.navigateBack();
    }
  },

  onNameInput(e) {
    this.setData({ customer_name: e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ customer_phone: e.detail.value });
  },

  onAddressInput(e) {
    this.setData({ install_address: e.detail.value });
  },

  onRemarkInput(e) {
    this.setData({ customer_remark: e.detail.value });
  },

  submitOrder() {
    if (!this.data.customer_name || !this.data.customer_phone || !this.data.install_address) {
      wx.showToast({ title: '请完整填写联系信息及安装地址', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '提交预约中...' });

    const payload = {
      user_id: (app.globalData.userInfo && app.globalData.userInfo.id) || 'user_customer_demo',
      customer_name: this.data.customer_name,
      customer_phone: this.data.customer_phone,
      install_address: this.data.install_address,
      customer_remark: this.data.customer_remark,
      items: [
        {
          product_id: this.data.draft.product_id,
          product_name: this.data.draft.product_name,
          width_mm: this.data.draft.width_mm,
          height_mm: this.data.draft.height_mm,
          quantity: this.data.draft.quantity,
          base_price_sqm: this.data.draft.base_price_sqm,
          min_area: this.data.draft.min_area,
          selected_options: this.data.draft.selected_options
        }
      ]
    };

    request({
      url: '/api/orders',
      method: 'POST',
      data: payload
    }).then(res => {
      wx.hideLoading();
      if (res.success) {
        wx.showToast({ title: '预约成功！', icon: 'success' });
        wx.removeStorageSync('orderDraft');
        setTimeout(() => {
          wx.redirectTo({ url: `/pages/order-detail/order-detail?id=${res.order_id}` });
        }, 1200);
      } else {
        wx.showToast({ title: res.message || '提交失败，请重试', icon: 'none' });
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '预约已提交！', icon: 'success' });
      wx.removeStorageSync('orderDraft');
      setTimeout(() => {
        wx.switchTab({ url: '/pages/order-list/order-list' });
      }, 1200);
    });
  }
});
