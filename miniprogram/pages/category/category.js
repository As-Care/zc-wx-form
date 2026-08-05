// 展晨门窗 双栏分类页 Page 逻辑
const { request, mockData } = require('../../utils/request');

Page({
  data: {
    categories: [],
    activeCatId: '',
    activeCatName: '断桥铝系统窗',
    allProducts: [],
    productList: [],
    loading: false
  },

  onShow() {
    this.fetchData();
  },

  fetchData() {
    request({ url: '/api/categories' }).then(res => {
      let categories = (res.success && res.data && res.data.length > 0) ? res.data : mockData.categories;
      this.initSelectedCategory(categories);
    }).catch(() => {
      this.initSelectedCategory(mockData.categories);
    });
  },

  initSelectedCategory(categories) {
    const app = getApp();
    const globalCatId = app && app.globalData ? app.globalData.selectedCatId : null;
    const globalCatName = app && app.globalData ? app.globalData.selectedCatName : null;
    const storedCat = globalCatId || wx.getStorageSync('selectedCategory');
    
    // 如果有首页透传进来的 target catId / catName，优先使用它
    let activeCat = null;
    if (storedCat) {
      activeCat = categories.find(c => c.id === storedCat || c.name === storedCat || c.sub_title === storedCat);
    }
    if (!activeCat && globalCatName) {
      activeCat = categories.find(c => c.name === globalCatName || c.sub_title === globalCatName);
    }
    if (!activeCat) {
      activeCat = categories[0] || { id: 'cat_1', name: '断桥铝系统窗' };
    }

    this.setData({
      categories,
      activeCatId: activeCat.id,
      activeCatName: activeCat.name || activeCat.sub_title || '门窗商品'
    });
    
    // 消费完毕后清空透传标志
    wx.removeStorageSync('selectedCategory');
    if (app && app.globalData) {
      app.globalData.selectedCatId = null;
      app.globalData.selectedCatName = null;
    }

    this.fetchProducts(activeCat.id, activeCat.name);
  },

  fetchProducts(catId, catName) {
    this.setData({ loading: true });
    const queryParam = catId || catName || '';
    request({ url: `/api/products?category_id=${encodeURIComponent(queryParam)}` }).then(res => {
      if (res.success && Array.isArray(res.data)) {
        this.setData({ productList: res.data });
      } else {
        const allMock = mockData.products || [];
        const filtered = allMock.filter(p => p.category_id === catId || p.category_name === catName || (p.name && catName && p.name.includes(catName)));
        this.setData({ productList: filtered });
      }
    }).catch(() => {
      const allMock = mockData.products || [];
      const filtered = allMock.filter(p => p.category_id === catId || p.category_name === catName || (p.name && catName && p.name.includes(catName)));
      this.setData({ productList: filtered });
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
