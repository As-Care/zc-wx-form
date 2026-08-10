// 展晨门窗 双栏分类页 Page 逻辑
const { request } = require('../../utils/request');

Page({
  data: {
    categories: [],
    activeCatId: '',
    activeCatName: '门窗分类',
    allProducts: [],
    productList: [],
    loading: false,
    loadError: '',
    searchKeyword: ''
  },

  onShow() {
    getApp().refreshOrderStatusNotices();
    this.fetchData();
  },

  fetchData() {
    const storedKeyword = wx.getStorageSync('productSearchKeyword');
    if (storedKeyword) {
      this.setData({ searchKeyword: String(storedKeyword).trim() });
      wx.removeStorageSync('productSearchKeyword');
    }
    request({ url: '/api/categories' }).then(res => {
      let categories = (res.success && Array.isArray(res.data)) ? res.data : [];
      categories.unshift({ id: 'all', name: '全部' });
      this.initSelectedCategory(categories);
    }).catch(() => {
      this.initSelectedCategory([{ id: 'all', name: '全部' }]);
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
    this.setData({ loading: true, loadError: '' });
    let queryParam = catId || catName || '';
    if (catId === 'all') {
      queryParam = '';
    }
    const query = [];
    if (queryParam) query.push(`category_id=${encodeURIComponent(queryParam)}`);
    if (this.data.searchKeyword) query.push(`keyword=${encodeURIComponent(this.data.searchKeyword.trim())}`);
    const url = `/api/products${query.length ? `?${query.join('&')}` : ''}`;
    request({ url }).then(res => {
      if (res.success && Array.isArray(res.data)) {
        this.setData({ productList: res.data });
      } else {
        this.setData({ productList: [] });
        throw new Error(res.message || '商品加载失败');
      }
    }).catch(err => {
      this.setData({ productList: [], loadError: err.message || '商品加载失败，请重试' });
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
      activeCatName: catName || '门窗分类',
      searchKeyword: ''
    });
    this.fetchProducts(catId, catName);
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  onSearchConfirm() {
    this.fetchProducts(this.data.activeCatId, this.data.activeCatName);
  },

  clearSearch() {
    this.setData({ searchKeyword: '' });
    this.fetchProducts(this.data.activeCatId, this.data.activeCatName);
  },

  retryProducts() {
    this.fetchProducts(this.data.activeCatId, this.data.activeCatName);
  },

  navToDetail(e) {
    const prodId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${prodId}` });
  }
});
