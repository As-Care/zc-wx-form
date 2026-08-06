/** 展晨门窗 首页逻辑 **/
const { request } = require('../../utils/request');
const app = getApp();

Page({
  data: {
    bannerIndex: 0,
    banners: [
      {
        id: 1,
        title: '展晨108热桥级系统窗',
        subtitle: '尊享静谧生活 · 高端门窗定制',
        image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80'
      },
      {
        id: 2,
        title: '展晨极简16窄边推拉门',
        subtitle: '视野无界 · 顺滑重型下轨',
        image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80'
      },
      {
        id: 3,
        title: '展晨尊享系统封阳台/阳光房',
        subtitle: '全气候级隔热 · 抗风暴结构',
        image: 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=800&q=80'
      }
    ],
    categories: [],
    products: [],
    storeInfo: app.globalData.storeInfo
  },

  onLoad() {
    this.fetchCategories();
    this.fetchProducts();
  },

  onPullDownRefresh() {
    Promise.all([
      this.fetchCategories(),
      this.fetchProducts()
    ]).finally(() => {
      wx.stopPullDownRefresh();
      wx.showToast({ title: '已刷新数据', icon: 'success', duration: 1000 });
    });
  },

  onBannerChange(e) {
    this.setData({
      bannerIndex: e.detail.current
    });
  },

  fetchCategories() {
    return request({ url: '/api/categories' }).then(res => {
      if (res.success && Array.isArray(res.data)) {
        this.setData({ categories: res.data });
      } else {
        this.setData({ categories: [] });
      }
    }).catch(() => {
      this.setData({ categories: [] });
    });
  },

  fetchProducts() {
    return request({ url: '/api/products' }).then(res => {
      if (res.success && Array.isArray(res.data)) {
        this.setData({ products: res.data });
      } else {
        this.setData({ products: [] });
      }
    }).catch(() => {
      this.setData({ products: [] });
    });
  },

  // 跳转到产品页并透传 ID / Name 选择目标分类
  navToCategory(e) {
    const dataset = e.currentTarget ? e.currentTarget.dataset : {};
    const catId = dataset.id || null;
    const catName = dataset.name || null;
    
    if (catId || catName) {
      wx.setStorageSync('selectedCategory', catId || catName);
      if (getApp().globalData) {
        getApp().globalData.selectedCatId = catId || catName;
        getApp().globalData.selectedCatName = catName;
      }
    }
    wx.switchTab({
      url: '/pages/category/category'
    });
  },

  navToDetail(e) {
    const prodId = e.currentTarget.dataset.id || 'prod_1';
    wx.navigateTo({
      url: `/pages/product-detail/product-detail?id=${prodId}`
    });
  },

  navToContact() {
    wx.navigateTo({
      url: '/pages/contact/contact'
    });
  }
});
