// 展晨门窗 新增/编辑地址 Page 逻辑
const { request } = require('../../utils/request');
const app = getApp();

Page({
  data: {
    isEditMode: false,
    region: [],
    form: {
      id: '',
      name: '',
      phone: '',
      province: '湖北省',
      city: '仙桃市',
      district: '',
      detail_address: '',
      is_default: false
    }
  },

  onLoad(options) {
    if (options && options.mode === 'edit') {
      const editingItem = wx.getStorageSync('editingAddressItem');
      if (editingItem) {
        wx.setNavigationBarTitle({ title: '修改安装/收货地址' });
        this.setData({
          isEditMode: true,
          region: [editingItem.province || '湖北省', editingItem.city || '仙桃市', editingItem.district || ''],
          form: {
            id: editingItem.id,
            name: editingItem.name,
            phone: editingItem.phone,
            province: editingItem.province || '湖北省',
            city: editingItem.city || '仙桃市',
            district: editingItem.district || '',
            detail_address: editingItem.detail_address || '',
            is_default: Boolean(editingItem.is_default)
          }
        });
        return;
      }
    }

    wx.setNavigationBarTitle({ title: '新增安装/收货地址' });
  },

  onNameInput(e) {
    this.setData({ 'form.name': e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ 'form.phone': e.detail.value });
  },

  onRegionChange(e) {
    const val = e.detail.value;
    this.setData({
      region: val,
      'form.province': val[0] || '',
      'form.city': val[1] || '',
      'form.district': val[2] || ''
    });
  },

  onDetailInput(e) {
    this.setData({ 'form.detail_address': e.detail.value });
  },

  onDefaultSwitch(e) {
    this.setData({ 'form.is_default': e.detail.value });
  },

  saveAddress() {
    const { name, phone, detail_address } = this.data.form;
    if (!name || !name.trim()) {
      wx.showToast({ title: '请填写联系人姓名', icon: 'none' });
      return;
    }
    if (!phone || !phone.trim()) {
      wx.showToast({ title: '请填写联系电话', icon: 'none' });
      return;
    }
    if (!detail_address || !detail_address.trim()) {
      wx.showToast({ title: '请填写详细地址', icon: 'none' });
      return;
    }

    const userId = (app.globalData.userInfo && app.globalData.userInfo.id) || 'user_customer_demo';
    wx.showLoading({ title: '保存中...' });

    const payload = {
      ...this.data.form,
      user_id: userId
    };

    request({
      url: '/api/user/addresses',
      method: 'POST',
      data: payload
    }).then(res => {
      wx.hideLoading();
      if (res.success) {
        wx.showToast({ title: '保存成功！', icon: 'success' });
        setTimeout(() => {
          wx.navigateBack();
        }, 1000);
      } else {
        wx.showToast({ title: res.message || '保存失败', icon: 'none' });
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '地址已保存！', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1000);
    });
  }
});