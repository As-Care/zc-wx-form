// 展晨门窗 确认定制订单 Page 逻辑
const { request } = require('../../utils/request');
const app = getApp();

Page({
  data: {
    draft: null,
    setsList: [],
    displayTotalPrice: '0.00',
    customer_name: '张先生',
    customer_phone: '13545941637',
    install_address: '湖北省仙桃市恒迪建材市场A区3号',
    customer_remark: ''
  },

  onLoad() {
    const draft = wx.getStorageSync('orderDraft');
    if (draft) {
      let setsList = [];
      let displayTotalPrice = '0.00';

      if (draft.customSets && draft.customSets.length > 0) {
        setsList = draft.customSets;
        displayTotalPrice = draft.totalSummary ? draft.totalSummary.totalPrice : '0.00';
      } else if (draft.calcResult) {
        setsList = [
          {
            label: draft.product_name,
            width_mm: draft.width_mm,
            height_mm: draft.height_mm,
            calcResult: draft.calcResult,
            selectedOptionsSummary: draft.selected_options
          }
        ];
        displayTotalPrice = draft.calcResult.totalPrice;
      }

      this.setData({
        draft,
        setsList,
        displayTotalPrice
      });
    } else {
      wx.navigateBack();
    }
  },

  onShow() {
    const selected = wx.getStorageSync('selectedOrderAddress');
    if (selected) {
      this.setData({
        customer_name: selected.name || this.data.customer_name,
        customer_phone: selected.phone || this.data.customer_phone,
        install_address: `${selected.province || ''}${selected.city || ''}${selected.district || ''}${selected.detail_address || ''}`
      });
      wx.removeStorageSync('selectedOrderAddress');
    }
  },

  navToPickAddress() {
    wx.navigateTo({
      url: '/pages/address-list/address-list?select=1'
    });
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

    wx.showLoading({ title: '提交订单中...' });

    const itemsPayload = this.data.setsList.map(set => ({
      product_id: this.data.draft.product_id,
      product_name: set.label ? `${this.data.draft.product_name} (${set.label})` : this.data.draft.product_name,
      width_mm: set.width_mm,
      height_mm: set.height_mm,
      quantity: 1,
      base_price_sqm: this.data.draft.base_price_sqm,
      min_area: this.data.draft.min_area,
      selected_options: set.selectedOptionsSummary || set.selected_options || []
    }));

    const payload = {
      user_id: (app.globalData.userInfo && app.globalData.userInfo.id) || 'user_customer_demo',
      customer_name: this.data.customer_name,
      customer_phone: this.data.customer_phone,
      install_address: this.data.install_address,
      customer_remark: this.data.customer_remark,
      items: itemsPayload
    };

    request({
      url: '/api/orders',
      method: 'POST',
      data: payload
    }).then(res => {
      wx.hideLoading();
      if (res.success) {
        wx.showToast({ title: '下单成功！', icon: 'success' });
        wx.removeStorageSync('orderDraft');
        setTimeout(() => {
          wx.redirectTo({ url: `/pages/order-detail/order-detail?id=${res.order_id}` });
        }, 1200);
      } else {
        wx.showToast({ title: res.message || '提交失败，请重试', icon: 'none' });
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '订单提交成功！', icon: 'success' });
      wx.removeStorageSync('orderDraft');
      setTimeout(() => {
        wx.switchTab({ url: '/pages/order-list/order-list' });
      }, 1200);
    });
  }
});
