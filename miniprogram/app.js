// 展晨门窗微信小程序 全局 App 逻辑

App({
  globalData: {
    // 指向 Cloudflare Workers 后端（线上地址）
    baseUrl: 'https://zc-api.carelife.top', 
    userInfo: null,
    token: null,
    loginPromise: null,
    orderNoticeRefreshPromise: null,
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
    this.globalData.loginPromise = this.silentLogin().then((user) => {
      if (user) this.refreshOrderStatusNotices();
      return user;
    });
  },

  onShow() {
    // 只在小程序重新回到前台时检查一次；无需订阅消息或常驻轮询。
    this.refreshOrderStatusNotices();
  },

  checkLoginStatus() {
    const token = wx.getStorageSync('zc_token');
    const userInfo = wx.getStorageSync('zc_user_info');
    if (token && userInfo) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
    }
  },

  getOrderNoticeStorageKey() {
    const user = this.globalData.userInfo || wx.getStorageSync('zc_user_info') || {};
    return user.id ? `zc_order_status_notice_${user.id}` : '';
  },

  refreshOrderStatusNotices() {
    if (this.globalData.orderNoticeRefreshPromise) {
      return this.globalData.orderNoticeRefreshPromise;
    }

    const storageKey = this.getOrderNoticeStorageKey();
    const token = wx.getStorageSync('zc_token') || '';
    if (!storageKey || !token) return Promise.resolve();

    const saved = wx.getStorageSync(storageKey) || {};
    const hasCursor = Boolean(saved.cursor);
    const query = hasCursor
      ? `since=${encodeURIComponent(saved.cursor)}`
      : 'baseline=1';

    this.globalData.orderNoticeRefreshPromise = new Promise((resolve) => {
      wx.request({
        url: `${this.globalData.baseUrl}/api/orders/status-notices?${query}`,
        header: {
          'Content-Type': 'application/json',
          'X-Client': 'miniprogram',
          'Authorization': `Bearer ${token}`
        },
        success: (res) => {
          const data = res.data || {};
          if (!data.success) {
            resolve();
            return;
          }

          const previousUnread = Array.isArray(saved.unread) ? saved.unread : [];
          const unreadMap = new Map(previousUnread.map((item) => [item.order_id, item]));
          (Array.isArray(data.data) ? data.data : []).forEach((item) => {
            if (item && item.order_id) unreadMap.set(item.order_id, item);
          });
          const unread = Array.from(unreadMap.values());
          wx.setStorageSync(storageKey, {
            cursor: data.cursor || saved.cursor || '',
            unread
          });

          if (unread.length > 0) {
            wx.showTabBarRedDot({ index: 2 });
          } else {
            wx.hideTabBarRedDot({ index: 2 });
          }
          resolve();
        },
        fail: () => resolve()
      });
    }).finally(() => {
      this.globalData.orderNoticeRefreshPromise = null;
    });

    return this.globalData.orderNoticeRefreshPromise;
  },

  consumeOrderStatusNotices() {
    const storageKey = this.getOrderNoticeStorageKey();
    if (!storageKey) return [];
    const saved = wx.getStorageSync(storageKey) || {};
    const unread = Array.isArray(saved.unread) ? saved.unread : [];
    wx.setStorageSync(storageKey, { ...saved, unread: [] });
    wx.hideTabBarRedDot({ index: 2 });
    return unread;
  },

  silentLogin() {
    const cachedUser = wx.getStorageSync('zc_user_info') || {};
    const cachedPhone = cachedUser.phone === '13344443333' ? '' : String(cachedUser.phone || '').trim();
    const phone = /^1[3-9]\d{9}$/.test(cachedPhone) ? cachedPhone : '';

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
            data: { code, phone },
            header: { 'Content-Type': 'application/json', 'X-Client': 'miniprogram' },
            success: (res) => {
              const data = res.data || {};
              if (!data.success || !data.user || !data.token) {
                console.warn('微信静默登录失败', data.message || res.statusCode);
                resolve(null);
                return;
              }

              const isSameUser = cachedUser.id === data.user.id;
              const serverPhone = data.user.phone === '13344443333' ? '' : data.user.phone;
              const userInfo = {
                ...(isSameUser ? cachedUser : {}),
                id: data.user.id,
                nickname: data.user.nickname || (isSameUser ? cachedUser.nickname : '') || '',
                avatarUrl: data.user.avatar_url || (isSameUser ? cachedUser.avatarUrl : '') || '',
                phone: serverPhone || (isSameUser ? cachedPhone : '') || ''
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
