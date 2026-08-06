// 展晨门窗 双栏分类页 Page 逻辑
const { request } = require('../../utils/request');

Page({
  data: {
    categories: [],
    activeCatId: '',
    activeCatName: '门窗分类',
    allProducts: [],
    productList: [],
    loading: false
  },

  onShow() {
    this.fetchData();
  },

  fetchData() {
    request({ url: '/api/categories' }).then(res => {
      let categories = (res.success && Array.isArray(res.data)) ? res.data : [];
      this.initSelectedCategory(categories);
    }).catch(() => {
      this.initSelectedCategory([]);
    });
  },

  initSelectedCategory(categories) {
    if (!categories || categories.length === 0) {
      this.setData({ categories: [], productList: [] });
      return;
    }

    const app = getApp();
    const globalCatId = app && app.globalData ? app.globalData.selectedCatId : null;
    const globalCatName = app && app.globalData ? app.globalData.selectedCatName : null;
    const storedCat = globalCatId || wx.getStorageSync('selectedCategory');
    
    let activeCat = null;
    if (storedCat) {
      activeCat = categories.find(c => c.id === storedCat || c.name === storedCat || c.sub_title === storedCat);
    }
    if (!activeCat && globalCatName) {
      activeCat = categories.find(c => c.name === globalCatName || c.sub_title === globalCatName);
    }
    if (!activeCat) {
      activeCat = categories[0];
    }

    this.setData({
      categories,
      activeCatId: activeCat ? activeCat.id : '',
      activeCatName: activeCat ? (activeCat.name || activeCat.sub_title) : '门窗商品'
    });
    
    wx.removeStorageSync('selectedCategory');
    if (app && app.globalData) {
      app.globalData.selectedCatId = null;
      app.globalData.selectedCatName = null;
    }

    if (activeCat) {
      this.fetchProducts(activeCat.id, activeCat.name);
    }
  },

  fetchProducts(catId, catName) {
    this.setData({ loading: true });
    const queryParam = catId || catName || '';
    request({ url: `/api/products?category_id=${encodeURIComponent(queryParam)}` }).then(res => {
      if (res.success && Array.isArray(res.data)) {
        this.setData({ productList: res.data });
      } else {
        this.setData({ productList: [] });
      }
    }).catch(() => {
      this.setData({ productList: [] });
    }).finally(() => {
      this.setData({ loading: false });
    });
  },

  selectCategory(e) {
    const catId = e.currentTarget.dataset.id;
    const cat = this.data.categories.find(c => c.id === catId);
    const catName = cat ? (cat.name || cat.sub_title) : '';
    this.setData({
      activeCatId: catId,
      activeCatName: catName || '门窗分类'
    });
    this.fetchProducts(catId, catName);
  },

  navToDetail(e) {
    const prodId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${prodId}` });
  }
});
