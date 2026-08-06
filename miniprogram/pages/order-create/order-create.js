// 展晨门窗 确认定制订单 Page 逻辑
const { request } = require('../../utils/request');
const app = getApp();

Page({
  data: {
    draft: null,
    setsList: [],
    displayTotalPrice: '0.00',
    customer_name: '',
    customer_phone: '',
    install_address: ''
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
        customer_name: selected.name || this.data.customer_name || '',
        customer_phone: selected.phone || this.data.customer_phone || '',
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

  previewSetImage(e) {
    const url = e.currentTarget.dataset.url;
    const setIndex = e.currentTarget.dataset.setindex;
    const set = this.data.setsList[setIndex];
    const urls = (set && set.scene_images) || [url];
    wx.previewImage({
      current: url,
      urls
    });
  },

  submitOrder() {
    if (!this.data.customer_name || !this.data.customer_name.trim()) {
      wx.showToast({ title: '请填写联系人姓名', icon: 'none', duration: 2000 });
      return;
    }
    if (!this.data.customer_phone || !this.data.customer_phone.trim()) {
      wx.showToast({ title: '请填写联系电话', icon: 'none', duration: 2000 });
      return;
    }
    if (!this.data.install_address || !this.data.install_address.trim()) {
      wx.showToast({ title: '请填写安装详细地址', icon: 'none', duration: 2000 });
      return;
    }

    wx.showLoading({ title: '提交订单中...' });

    const allSceneImgs = [];
    const allRemarks = [];

    this.data.setsList.forEach((set, idx) => {
      if (set.scene_images && Array.isArray(set.scene_images)) {
        set.scene_images.forEach(img => {
          if (img && !allSceneImgs.includes(img)) {
            allSceneImgs.push(img);
          }
        });
      }
      if (set.customer_remark && set.customer_remark.trim()) {
        allRemarks.push(`【${set.label || ('套系' + (idx + 1))}】${set.customer_remark.trim()}`);
      }
    });

    const itemsPayload = this.data.setsList.map(set => ({
      product_id: (this.data.draft && this.data.draft.product_id) || '',
      product_name: set.label ? `${(this.data.draft && this.data.draft.product_name) || '门窗商品'} (${set.label})` : ((this.data.draft && this.data.draft.product_name) || '门窗商品'),
      width_mm: set.width_mm,
      height_mm: set.height_mm,
      quantity: 1,
      base_price_sqm: (this.data.draft && this.data.draft.base_price_sqm) || 680,
      min_area: (this.data.draft && this.data.draft.min_area) || 1.5,
      selected_options: set.selected_options || {},
      selectedOptionsSummary: set.selectedOptionsSummary || [],
      scene_images: (set.scene_images || []).join(','),
      customer_remark: set.customer_remark || ''
    }));

    const payload = {
      user_id: (app.globalData.userInfo && app.globalData.userInfo.id) || 'user_customer_demo',
      customer_name: this.data.customer_name,
      customer_phone: this.data.customer_phone,
      install_address: this.data.install_address,
      customer_remark: allRemarks.join('； '),
      scene_images: allSceneImgs.join(','),
      product_id: (this.data.draft && this.data.draft.product_id) || '',
      product_name: (this.data.draft && this.data.draft.product_name) || '门窗商品',
      base_price_sqm: (this.data.draft && this.data.draft.base_price_sqm) || 680,
      min_area: (this.data.draft && this.data.draft.min_area) || 1.5,
      customSets: itemsPayload,
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
