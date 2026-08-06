// 展晨门窗微信小程序 全局 App 逻辑

App({
  globalData: {
    // 指向 Cloudflare Workers 后端（线上地址）
    baseUrl: 'https://zc-api.carelife.top', 
    userInfo: null,
    token: null,
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
  },

  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    if (token && userInfo) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
    }
  }
});
