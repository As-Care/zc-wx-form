// 展晨门窗 多套独立定制与算价器 Page 逻辑
const { request } = require('../../utils/request');
const { calculatePrice } = require('../../utils/calculator');

function getFormattedDate() {
  const date = new Date();
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function getDefaultNickname() {
  const saved = wx.getStorageSync('zc_user_info');
  return (saved && saved.nickname) ? saved.nickname : '未登录';
}

Page({
  data: {
    productId: '',
    product: {
      id: 'prod_1',
      name: '展晨108热桥级系统断桥铝窗',
      description: '高隔音高隔热，适合高层住宅与阳台封窗，支持双色定制。',
      cover_image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
      base_price_sqm: 680,
      min_area: 1.5
    },
    activeSetIndex: 0,
    customSets: [],
    optionGroups: [],
    totalSummary: {
      totalSets: 1,
      totalActualArea: 0,
      totalBilledArea: 0,
      totalPrice: 0
    },
    showPreviewModal: false
  },

  parseOptionGroups(rawOptions) {
    const opts = (rawOptions && rawOptions.length > 0) ? rawOptions : [
      { id: 'opt_1', group_name: '玻璃配置', option_name: '双层玻璃', price: 0, price_type: 'fixed', is_default: 1, image_url: '' },
      { id: 'opt_2', group_name: '玻璃配置', option_name: '双层钢化玻璃', price: 50, price_type: 'fixed', is_default: 0, image_url: '' },
      { id: 'opt_3', group_name: '门锁配置', option_name: '默认门锁', price: 0, price_type: 'fixed', is_default: 1, image_url: '' },
      { id: 'opt_4', group_name: '铝材配置', option_name: '默认铝材', price: 0, price_type: 'fixed', is_default: 1, image_url: '' },
      { id: 'opt_5', group_name: '颜色配置', option_name: '琉璃白', price: 0, price_type: 'fixed', is_default: 1, image_url: '' },
      { id: 'opt_6', group_name: '颜色配置', option_name: '深空灰', price: 0, price_type: 'fixed', is_default: 0, image_url: '' },
      { id: 'opt_7', group_name: '开门方向', option_name: '左锁（左合页）', price: 0, price_type: 'fixed', is_default: 1, image_url: '' },
      { id: 'opt_8', group_name: '开门方向', option_name: '右锁（左合页）', price: 0, price_type: 'fixed', is_default: 0, image_url: '' },
      { id: 'opt_9', group_name: '开门内外', option_name: '内开（朝内打开）', price: 0, price_type: 'fixed', is_default: 1, image_url: '' },
      { id: 'opt_10', group_name: '开门内外', option_name: '外开（朝外打开）', price: 0, price_type: 'fixed', is_default: 0, image_url: '' }
    ];

    const groupMap = {};
    opts.forEach(item => {
      const gName = (item.group_name || '玻璃配置').trim();
      if (!groupMap[gName]) {
        groupMap[gName] = {
          group_name: gName,
          groupTitle: gName,
          options: []
        };
      }

      let priceText = '包含在基础价内';
      if (Number(item.price || 0) > 0) {
        if (item.price_type === 'per_sqm') {
          priceText = `+¥ ${item.price} / ㎡`;
        } else if (item.price_type === 'per_item') {
          priceText = `+¥ ${item.price} / 套`;
        } else {
          priceText = `+¥ ${item.price}`;
        }
      } else {
        priceText = '包含在基础价内';
      }

      groupMap[gName].options.push({
        id: item.id || `opt_${Math.random()}`,
        option_name: item.option_name || item.name || '',
        price_type: item.price_type || 'fixed',
        price: Number(item.price || 0),
        is_default: item.is_default ? 1 : 0,
        image_url: item.image_url || '',
        priceText
      });
    });

    return Object.values(groupMap);
  },

  onLoad(options) {
    if (options && options.id) {
      this.setData({ productId: options.id });
      this.fetchProductDetail(options.id);
    } else {
      const defaultGroups = this.parseOptionGroups([]);
      this.setData({ optionGroups: defaultGroups });
      this.initDefaultSets();
    }
  },

  fetchProductDetail(id) {
    request({ url: `/api/products/${id}` }).then(res => {
      if (res.success && res.data) {
        const prod = res.data;
        const groups = this.parseOptionGroups(prod.options);
        this.setData({
          product: prod,
          optionGroups: groups
        });
        this.initDefaultSets();
      }
    });
  },

  initDefaultSets() {
    const firstSet = this.createDefaultSet(1);
    this.setData({
      customSets: [firstSet],
      activeSetIndex: 0
    });
    this.recalculateAll();
  },

  createDefaultSet(indexNumber) {
    const nickname = getDefaultNickname();
    const dateStr = getFormattedDate();
    const defaultLabel = `${nickname}-${dateStr}-${indexNumber}`;

    const selected_options = {};
    (this.data.optionGroups || []).forEach(grp => {
      const defaultOpt = (grp.options || []).find(o => o.is_default === 1) || (grp.options || [])[0];
      if (defaultOpt) {
        selected_options[grp.group_name] = defaultOpt.id;
      }
    });

    return {
      id: 'set_' + Date.now() + '_' + indexNumber,
      label: defaultLabel,
      width_mm: 2400,
      height_mm: 2100,
      selected_options,
      scene_images: [],
      customer_remark: '',
      calcResult: {}
    };
  },

  onSetRemarkInput(e) {
    const value = e.detail.value;
    const updatedSets = [...this.data.customSets];
    const set = updatedSets[this.data.activeSetIndex];
    if (set) {
      set.customer_remark = value;
      this.setData({ customSets: updatedSets });
    }
  },

  chooseSetSceneImg() {
    const activeSet = this.data.customSets[this.data.activeSetIndex];
    if (!activeSet) return;
    const currentImgs = activeSet.scene_images || [];
    if (currentImgs.length >= 6) return;

    wx.chooseMedia({
      count: 6 - currentImgs.length,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFiles = res.tempFiles || [];
        tempFiles.forEach(file => {
          wx.showLoading({ title: '上传现场图片...' });
          wx.uploadFile({
            url: 'https://zc-api.carelife.top/api/upload',
            filePath: file.tempFilePath,
            name: 'file',
            success: (uploadRes) => {
              wx.hideLoading();
              try {
                const data = JSON.parse(uploadRes.data);
                if (data.success && data.url) {
                  const updatedSets = [...this.data.customSets];
                  const set = updatedSets[this.data.activeSetIndex];
                  if (!set.scene_images) set.scene_images = [];
                  set.scene_images.push(data.url);
                  this.setData({ customSets: updatedSets });
                  wx.showToast({ title: '上传成功', icon: 'success' });
                } else {
                  wx.showToast({ title: '上传失败', icon: 'none' });
                }
              } catch (e) {
                wx.showToast({ title: '上传失败', icon: 'none' });
              }
            },
            fail: () => {
              wx.hideLoading();
              wx.showToast({ title: '网络失败', icon: 'none' });
            }
          });
        });
      }
    });
  },

  deleteSetSceneImg(e) {
    const index = e.currentTarget.dataset.index;
    const updatedSets = [...this.data.customSets];
    const set = updatedSets[this.data.activeSetIndex];
    if (set && set.scene_images) {
      set.scene_images.splice(index, 1);
      this.setData({ customSets: updatedSets });
    }
  },

  previewSetSceneImg(e) {
    const url = e.currentTarget.dataset.url;
    const activeSet = this.data.customSets[this.data.activeSetIndex];
    const urls = (activeSet && activeSet.scene_images) || [url];
    wx.previewImage({
      current: url,
      urls
    });
  },

  addNewSet() {
    const nextIndex = this.data.customSets.length + 1;
    const newSet = this.createDefaultSet(nextIndex);
    const updatedSets = [...this.data.customSets, newSet];
    this.setData({
      customSets: updatedSets,
      activeSetIndex: updatedSets.length - 1
    });
    this.recalculateAll();
    wx.showToast({
      title: `新增配置 ${nextIndex}`,
      icon: 'none'
    });
  },

  deleteSet(e) {
    const index = e.currentTarget.dataset.index;
    if (this.data.customSets.length <= 1) {
      wx.showToast({ title: '至少保留一套配置', icon: 'none' });
      return;
    }

    const updatedSets = this.data.customSets.filter((_, idx) => idx !== index);
    let nextActiveIndex = this.data.activeSetIndex;
    if (nextActiveIndex >= updatedSets.length) {
      nextActiveIndex = updatedSets.length - 1;
    }

    this.setData({
      customSets: updatedSets,
      activeSetIndex: nextActiveIndex
    });
    this.recalculateAll();
  },

  switchSet(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ activeSetIndex: index });
  },

  onLabelInput(e) {
    const val = e.detail.value;
    const idx = this.data.activeSetIndex;
    const key = `customSets[${idx}].label`;
    this.setData({ [key]: val });
  },

  onWidthInput(e) {
    const val = Number(e.detail.value) || 0;
    const idx = this.data.activeSetIndex;
    const key = `customSets[${idx}].width_mm`;
    this.setData({ [key]: val });
    this.recalculateAll();
  },

  onHeightInput(e) {
    const val = Number(e.detail.value) || 0;
    const idx = this.data.activeSetIndex;
    const key = `customSets[${idx}].height_mm`;
    this.setData({ [key]: val });
    this.recalculateAll();
  },

  toggleOption(e) {
    const groupName = e.currentTarget.dataset.group;
    const optionId = e.currentTarget.dataset.id;
    const idx = this.data.activeSetIndex;

    const key = `customSets[${idx}].selected_options.${groupName}`;
    this.setData({ [key]: optionId });
    this.recalculateAll();
  },

  recalculateAll() {
    const { customSets, product, optionGroups } = this.data;
    if (!customSets.length) return;

    let totalActualArea = 0;
    let totalBilledArea = 0;
    let totalPrice = 0;

    const updatedSets = customSets.map(set => {
      // 组装 selectedOptions 格式供 calculatePrice 使用
      const selectedOptionsArr = [];
      optionGroups.forEach(grp => {
        const selectedId = set.selected_options[grp.group_name];
        const targetOpt = grp.options.find(o => o.id === selectedId) || grp.options[0];
        selectedOptionsArr.push({
          id: targetOpt.id,
          group_name: grp.group_name,
          groupTitle: grp.groupTitle,
          option_name: targetOpt.option_name,
          price_type: targetOpt.price_type,
          price: targetOpt.price,
          priceText: targetOpt.priceText,
          image_url: targetOpt.image_url || ''
        });
      });

      const calc = calculatePrice({
        width_mm: set.width_mm,
        height_mm: set.height_mm,
        quantity: 1,
        base_price_sqm: product.base_price_sqm,
        min_area: product.min_area,
        selected_options: selectedOptionsArr
      });

      totalActualArea += Number(calc.actualArea);
      totalBilledArea += Number(calc.billedArea);
      totalPrice += Number(calc.totalPrice);

      return {
        ...set,
        calcResult: calc,
        selectedOptionsSummary: selectedOptionsArr
      };
    });

    this.setData({
      customSets: updatedSets,
      totalSummary: {
        totalSets: updatedSets.length,
        totalActualArea: totalActualArea.toFixed(2),
        totalBilledArea: totalBilledArea.toFixed(2),
        totalPrice: totalPrice.toFixed(2)
      }
    });
  },

  validateSets() {
    const sets = this.data.customSets || [];
    const usedLabels = new Map();

    for (let i = 0; i < sets.length; i++) {
      const set = sets[i];
      const setLabel = set.label ? set.label.trim() : '';
      if (!setLabel) {
        this.setData({ activeSetIndex: i });
        wx.showToast({ title: `请填写套系 ${i + 1} 的备注名`, icon: 'none', duration: 2000 });
        return false;
      }

      if (usedLabels.has(setLabel)) {
        this.setData({ activeSetIndex: i });
        wx.showToast({ title: `套系 ${i + 1} 备注名"${setLabel}"重复，请修改`, icon: 'none', duration: 2200 });
        return false;
      }
      usedLabels.set(setLabel, i);

      const w = Number(set.width_mm || 0);
      if (!w || w <= 0) {
        this.setData({ activeSetIndex: i });
        wx.showToast({ title: `请填写套系 ${i + 1} 的宽度 (mm)`, icon: 'none', duration: 2000 });
        return false;
      }

      const h = Number(set.height_mm || 0);
      if (!h || h <= 0) {
        this.setData({ activeSetIndex: i });
        wx.showToast({ title: `请填写套系 ${i + 1} 的高度 (mm)`, icon: 'none', duration: 2000 });
        return false;
      }
    }
    return true;
  },

  openPreviewModal() {
    if (!this.validateSets()) return;
    this.recalculateAll();
    this.setData({ showPreviewModal: true });
  },

  closePreviewModal() {
    this.setData({ showPreviewModal: false });
  },

  preventBubble() {},

  confirmOrder() {
    const savedUser = wx.getStorageSync('zc_user_info');
    if (!savedUser || !savedUser.phone) {
      wx.showToast({ title: '请先登录绑定手机号', icon: 'none', duration: 1500 });
      setTimeout(() => {
        wx.navigateTo({ url: '/pages/login/login' });
      }, 1000);
      return;
    }

    if (!this.validateSets()) {
      this.setData({ showPreviewModal: false });
      return;
    }
    this.setData({ showPreviewModal: false });
    const orderDraft = {
      product_id: this.data.product.id,
      product_name: this.data.product.name,
      base_price_sqm: this.data.product.base_price_sqm,
      min_area: this.data.product.min_area,
      customSets: this.data.customSets,
      totalSummary: this.data.totalSummary
    };

    wx.setStorageSync('orderDraft', orderDraft);
    wx.navigateTo({ url: '/pages/order-create/order-create' });
  }
});
