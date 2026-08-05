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
    optionGroups: [
      {
        group_name: 'glass',
        groupTitle: '玻璃配置',
        options: [
          { id: 'opt_1', option_name: '5+18A+5 标准中空钢化玻璃', price: 0, price_type: 'per_sqm', priceText: '包含在基础价内' },
          { id: 'opt_2', option_name: '5+18A+5 Low-E 超白隔热玻璃', price: 80, price_type: 'per_sqm', priceText: '+¥ 80 / ㎡' },
          { id: 'opt_3', option_name: '5+12A+5+12A+5 三玻两腔降噪玻璃', price: 150, price_type: 'per_sqm', priceText: '+¥ 150 / ㎡' }
        ]
      },
      {
        group_name: 'hardware',
        groupTitle: '五金配件品牌',
        options: [
          { id: 'opt_4', option_name: '德国好博 (Hoppe) 原装执手', price: 150, price_type: 'per_item', priceText: '+¥ 150 / 套' },
          { id: 'opt_5', option_name: '德国丝吉利娅 (SIEGEMIA) 隐藏锁扣', price: 220, price_type: 'per_item', priceText: '+¥ 220 / 套' }
        ]
      },
      {
        group_name: 'color',
        groupTitle: '铝材表面喷涂颜色',
        options: [
          { id: 'opt_6', option_name: '氟碳雅致黑', price: 0, price_type: 'fixed', priceText: '标准配色' },
          { id: 'opt_7', option_name: '阳极氧化香槟银', price: 50, price_type: 'fixed', priceText: '+¥ 50' }
        ]
      }
    ],
    totalSummary: {
      totalSets: 1,
      totalActualArea: 0,
      totalBilledArea: 0,
      totalPrice: 0
    },
    showPreviewModal: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ productId: options.id });
      this.fetchProductDetail(options.id);
    } else {
      this.initDefaultSets();
    }
  },

  fetchProductDetail(id) {
    request({ url: `/api/products/${id}` }).then(res => {
      if (res.success && res.data) {
        this.setData({ product: res.data });
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
    const defaultLabel = `【${nickname}-${dateStr}-${indexNumber}】`;

    return {
      id: 'set_' + Date.now() + '_' + indexNumber,
      label: defaultLabel,
      width_mm: 2400,
      height_mm: 2100,
      selected_options: {
        glass: 'opt_1',
        hardware: 'opt_4',
        color: 'opt_6'
      },
      calcResult: {}
    };
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
          priceText: targetOpt.priceText
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

  openPreviewModal() {
    this.recalculateAll();
    this.setData({ showPreviewModal: true });
  },

  closePreviewModal() {
    this.setData({ showPreviewModal: false });
  },

  preventBubble() {},

  confirmOrder() {
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
