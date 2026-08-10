/** 展晨门窗 首页逻辑 **/
const { request } = require('../../utils/request');
const app = getApp();

Page({
  data: {
    bannerIndex: 0,
    banners: [],
    bannersLoaded: false,
    bannersError: '',
    categories: [],
    products: [],
    productsLoading: false,
    productsLoaded: false,
    productsError: '',
    searchKeyword: '',
    storeInfo: app.globalData.storeInfo
  },

  onLoad() {
    this.fetchCategories();
    this.fetchBanners();
    this.fetchProducts();
  },

  onShow() {
    // 页面切换时同步检查订单状态，原生订单 tab 会显示未读红点。
    app.refreshOrderStatusNotices();
  },

  onPullDownRefresh() {
    Promise.all([
      this.fetchCategories(),
      this.fetchBanners(),
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

  fetchBanners() {
    this.setData({ bannersError: '' });
    return request({ url: '/api/banners' }).then(res => {
      if (!res.success || !Array.isArray(res.data)) {
        throw new Error(res.message || 'Banner 加载失败');
      }
      this.setData({ banners: res.data, bannerIndex: 0, bannersLoaded: true });
    }).catch(err => {
      this.setData({ banners: [], bannersLoaded: true, bannersError: err.message || 'Banner 加载失败' });
    });
  },

  onBannerTap(e) {
    const productId = e.currentTarget.dataset.productId;
    if (!productId) return;
    wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${productId}` });
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
    this.setData({ productsLoading: true, productsError: '' });
    return request({ url: '/api/products?hot=1' }).then(res => {
      if (res.success && Array.isArray(res.data)) {
        this.setData({ products: res.data });
      } else {
        this.setData({ products: [] });
        throw new Error(res.message || '热门商品加载失败');
      }
    }).catch(err => {
      this.setData({ products: [] });
      this.setData({ productsError: err.message || '热门商品加载失败，请重试' });
    }).finally(() => {
      this.setData({ productsLoading: false, productsLoaded: true });
    });
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  submitSearch() {
    const keyword = (this.data.searchKeyword || '').trim();
    if (!keyword) {
      wx.showToast({ title: '请输入要搜索的商品', icon: 'none' });
      return;
    }
    wx.setStorageSync('productSearchKeyword', keyword);
    wx.switchTab({ url: '/pages/category/category' });
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
