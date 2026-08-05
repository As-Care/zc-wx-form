// 展晨门窗 双栏分类页 Page 逻辑
const { request } = require('../../utils/request');

Page({
  data: {
    categories: [],
    activeCatId: '',
    activeCatName: '断桥铝系统窗',
    allProducts: [],
    productList: []
  },

  onShow() {
    this.fetchData();
  },

  fetchData() {
    request({ url: '/api/categories' }).then(res => {
      if (res.success && res.data.length > 0) {
        const categories = res.data;
        const app = getApp();
        const globalCatId = app && app.globalData ? app.globalData.selectedCatId : null;
        const storedCat = globalCatId || wx.getStorageSync('selectedCategory');
        
        // 如果有由首页透传进来的 target catId，优先使用它
        const activeCatId = storedCat || this.data.activeCatId || categories[0].id;
        const activeCat = categories.find(c => c.id === activeCatId) || categories[0];

        this.setData({
          categories,
          activeCatId: activeCat.id,
          activeCatName: activeCat.name
        });
        
        // 消费完毕后立即清空透传标志
        wx.removeStorageSync('selectedCategory');
        if (app && app.globalData) {
          app.globalData.selectedCatId = null;
        }

        this.fetchProducts(activeCat.id);
      }
    });
  },

  fetchProducts(catId) {
    request({ url: `/api/products?category_id=${catId}` }).then(res => {
      if (res.success) {
        this.setData({ productList: res.data || [] });
      }
    });
  },

  selectCategory(e) {
    const catId = e.currentTarget.dataset.id;
    const cat = this.data.categories.find(c => c.id === catId);
    this.setData({
      activeCatId: catId,
      activeCatName: cat ? cat.name : ''
    });
    this.fetchProducts(catId);
  },

  navToDetail(e) {
    const prodId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/product-detail/product-detail?id=${prodId}` });
  }
});
