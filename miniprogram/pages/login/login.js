/** 展晨门窗 完善个人资料与登录 Page 逻辑 **/

Page({
  data: {
    avatarUrl: '',
    nickname: '',
    phone: '',
    isEditMode: false
  },

  onLoad() {
    // 读取本地已存数据，判断是否为编辑模式
    const saved = wx.getStorageSync('zc_user_info');
    if (saved && (saved.nickname || saved.phone)) {
      this.setData({
        avatarUrl: saved.avatarUrl || '',
        nickname: saved.nickname || '',
        phone: saved.phone || '',
        isEditMode: true
      });
    }
  },

  // 手机号输入回调
  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  // 主界面选择头像回调
  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl;
    if (avatarUrl) {
      this.setData({ avatarUrl: avatarUrl });
      wx.showToast({ title: '头像已选定', icon: 'success' });
    }
  },

  // 姓名输入回调
  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },

  onNicknameBlur(e) {
    if (e.detail.value !== undefined) {
      this.setData({ nickname: e.detail.value });
    }
  },

  // 保存个人资料并返回 (姓名与11位手机号必填校验)
  saveProfile() {
    const name = (this.data.nickname || '').trim();
    const phone = (this.data.phone || '').trim();

    if (!name) {
      wx.showToast({
        title: '请填写姓名！',
        icon: 'none'
      });
      return;
    }

    if (!phone || !/^1\d{10}$/.test(phone)) {
      wx.showToast({
        title: '请填写有效11位手机号！',
        icon: 'none'
      });
      return;
    }

    const saved = wx.getStorageSync('zc_user_info') || {};
    const info = {
      ...saved,
      avatarUrl: this.data.avatarUrl,
      nickname: name,
      phone: phone
    };
    wx.setStorageSync('zc_user_info', info);

    wx.showToast({
      title: '资料更新成功',
      icon: 'success',
      duration: 1500
    });

    setTimeout(() => {
      wx.navigateBack({
        fail() {
          wx.switchTab({ url: '/pages/mine/mine' });
        }
      });
    }, 1200);
  }
});
