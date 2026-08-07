// 展晨门窗微信小程序 全局 App 逻辑

App({
  globalData: {
    // 指向 Cloudflare Workers 后端（线上地址）
    baseUrl: 'https://zc-api.carelife.top', 
    userInfo: null,
    token: null,
    loginPromise: null,
    // 官方门店品牌信息
    storeInfo: {
      name: '展晨门窗 (ZHANCHEN MENYE)',
      slogan: '专业门窗定制 · 缔造品质生活',
      phone: '13545941637',
      address: '湖北省仙桃市恒迪建材市场2期14栋1-107',
      hours: '8:00 - 18:00',
      experienceYears: '20+',
      caseCount: '50000+',
      isoCertification: 'ISO9001 质量管理体系认证'
    }
  },

  onLaunch() {
    console.log('展晨门窗小程序已启动...');
    this.checkLoginStatus();
    this.globalData.loginPromise = this.silentLogin();
  },

  checkLoginStatus() {
    const token = wx.getStorageSync('zc_token');
    const userInfo = wx.getStorageSync('zc_user_info');
    if (token && userInfo) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
    }
  },

  silentLogin() {
    return new Promise((resolve) => {
      wx.login({
        success: ({ code }) => {
          if (!code) {
            console.warn('微信静默登录未返回 code');
            resolve(null);
            return;
          }

          wx.request({
            url: `${this.globalData.baseUrl}/api/auth/wx-login`,
            method: 'POST',
            data: { code },
            header: { 'Content-Type': 'application/json', 'X-Client': 'miniprogram' },
            success: (res) => {
              const data = res.data || {};
              if (!data.success || !data.user || !data.token) {
                console.warn('微信静默登录失败', data.message || res.statusCode);
                resolve(null);
                return;
              }

              const cachedUser = wx.getStorageSync('zc_user_info') || {};
              const isSameUser = cachedUser.id === data.user.id;
              const serverPhone = data.user.phone === '13344443333' ? '' : data.user.phone;
              const userInfo = {
                ...(isSameUser ? cachedUser : {}),
                id: data.user.id,
                nickname: data.user.nickname || (isSameUser ? cachedUser.nickname : '') || '',
                avatarUrl: data.user.avatar_url || (isSameUser ? cachedUser.avatarUrl : '') || '',
                phone: serverPhone || (isSameUser ? cachedUser.phone : '') || ''
              };
              wx.setStorageSync('zc_user_info', userInfo);
              wx.setStorageSync('zc_token', data.token);
              this.globalData.userInfo = userInfo;
              this.globalData.token = data.token;
              resolve(userInfo);
            },
            fail: (err) => {
              console.warn('微信静默登录请求失败', err);
              resolve(null);
            }
          });
        },
        fail: (err) => {
          console.warn('调用 wx.login 失败', err);
          resolve(null);
        }
      });
    });
  }
});
