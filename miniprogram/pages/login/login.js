/** 展晨门窗 完善个人资料与登录 Page 逻辑 **/
const { request, BASE_URL } = require('../../utils/request');

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

  // 主界面选择头像回调 (联动后端图片上传 API)
  onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl;
    if (avatarUrl) {
      wx.showLoading({ title: '正在上传头像...' });

      // 上传图片至服务端 /api/upload 接口
      wx.uploadFile({
        url: `${BASE_URL}/api/upload`,
        filePath: avatarUrl,
        name: 'file',
        success: (res) => {
          wx.hideLoading();
          try {
            const data = JSON.parse(res.data);
            if (data.success && data.url) {
              this.setData({ avatarUrl: data.url });
              wx.showToast({ title: '头像已就绪', icon: 'success' });
            } else {
              this.setData({ avatarUrl: avatarUrl });
            }
          } catch (err) {
            this.setData({ avatarUrl: avatarUrl });
          }
        },
        fail: () => {
          wx.hideLoading();
          this.setData({ avatarUrl: avatarUrl });
          wx.showToast({ title: '头像已就绪', icon: 'success' });
        }
      });
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
    const userId = saved.id || `user_${Date.now()}`;
    const info = {
      ...saved,
      id: userId,
      avatarUrl: this.data.avatarUrl,
      nickname: name,
      phone: phone
    };

    // 同步发送更新请求到服务端 API
    request({
      url: '/api/user/profile',
      method: 'POST',
      data: {
        user_id: userId,
        nickname: name,
        avatar_url: this.data.avatarUrl,
        phone: phone
      }
    }).then((res) => {
      // The server may return the pre-created customer's canonical ID after
      // merging by phone. Persist that ID so subsequent order queries remain
      // attached to the merged customer record.
      if (res && res.success && res.user) {
        const serverUser = res.user;
        const canonicalInfo = {
          ...info,
          id: serverUser.id || info.id,
          nickname: serverUser.nickname || info.nickname,
          phone: serverUser.phone || info.phone,
          avatarUrl: serverUser.avatar_url || info.avatarUrl
        };
        wx.setStorageSync('zc_user_info', canonicalInfo);
        wx.setStorageSync('zc_token', `zc_token_${canonicalInfo.id}`);
      }
    }).catch(() => {});

    wx.setStorageSync('zc_user_info', info);
    wx.setStorageSync('zc_token', `zc_token_${userId}`);

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
