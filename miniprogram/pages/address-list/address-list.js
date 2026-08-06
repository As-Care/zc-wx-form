// 展晨门窗 地址管理列表 Page 逻辑
const { request } = require('../../utils/request');
const app = getApp();

Page({
  data: {
    addresses: [],
    fromSelectMode: false
  },

  onLoad(options) {
    if (options && options.select === '1') {
      this.setData({ fromSelectMode: true });
    }
  },

  onShow() {
    this.fetchAddresses();
  },

  fetchAddresses() {
    const savedUser = wx.getStorageSync('zc_user_info');
    const userId = (savedUser && savedUser.id) || (app.globalData.userInfo && app.globalData.userInfo.id) || 'user_customer_demo';
    wx.showLoading({ title: '加载地址中...' });

    request({
      url: `/api/user/addresses?user_id=${userId}`
    }).then(res => {
      wx.hideLoading();
      if (res.success && res.data) {
        this.setData({ addresses: res.data });
      } else {
        this.setData({ addresses: [] });
      }
    }).catch(() => {
      wx.hideLoading();
      this.setData({ addresses: [] });
    });
  },

  selectAddress(e) {
    if (!this.data.fromSelectMode) return;
    const item = e.currentTarget.dataset.item;
    if (item) {
      wx.setStorageSync('selectedOrderAddress', item);
      wx.navigateBack();
    }
  },

  setDefaultAddress(e) {
    const id = e.currentTarget.dataset.id;
    const savedUser = wx.getStorageSync('zc_user_info');
    const userId = (savedUser && savedUser.id) || (app.globalData.userInfo && app.globalData.userInfo.id) || 'user_customer_demo';

    wx.showLoading({ title: '设置中...' });
    request({
      url: `/api/user/addresses/${id}/default`,
      method: 'PATCH',
      data: { user_id: userId }
    }).then(res => {
      wx.hideLoading();
      if (res.success) {
        wx.showToast({ title: '默认地址已更新', icon: 'success' });
        this.fetchAddresses();
      }
    }).catch(() => {
      wx.hideLoading();
      this.fetchAddresses();
    });
  },

  editAddress(e) {
    const item = e.currentTarget.dataset.item;
    wx.setStorageSync('editingAddressItem', item);
    wx.navigateTo({
      url: '/pages/address-edit/address-edit?mode=edit'
    });
  },

  deleteAddress(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该收货/安装地址吗？',
      confirmColor: '#C5A880',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          request({
            url: `/api/user/addresses/${id}`,
            method: 'DELETE'
          }).then(res => {
            wx.hideLoading();
            wx.showToast({ title: '地址已删除', icon: 'success' });
            this.fetchAddresses();
          }).catch(() => {
            wx.hideLoading();
            this.fetchAddresses();
          });
        }
      }
    });
  },

  navToAddAddress() {
    wx.removeStorageSync('editingAddressItem');
    wx.navigateTo({
      url: '/pages/address-edit/address-edit?mode=create'
    });
  },

  preventBubble() {}
});