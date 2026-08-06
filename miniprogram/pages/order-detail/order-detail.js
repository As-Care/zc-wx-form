// 展晨门窗 订单详情与流转时间轴 Page 逻辑
const { request } = require('../../utils/request');

const STATUS_INFO_MAP = {
  'pending_review': {
    text: '待复核',
    desc: '正在等待接单员复核'
  },
  'producing': {
    text: '生产中',
    desc: '您的门窗方案已通过复核，工厂正全力进行高精度切割与备料排产'
  },
  'installing': {
    text: '待提货',
    desc: '您的门窗成品已通过ISO9001质检，正在安排仓储与自提/物流送达'
  },
  'completed': {
    text: '已完成',
    desc: '门窗已顺利提货交付，感谢您选择展晨门窗！'
  }
};

const ALL_STEPS = [
  { key: 'pending_review', name: '待复核' },
  { key: 'producing', name: '生产备料' },
  { key: 'installing', name: '待提货' },
  { key: 'completed', name: '已完成' }
];

Page({
  data: {
    orderId: '',
    order: {
      order_no: 'ZC20260804001',
      status: 'pending_review',
      statusText: '待复核',
      statusDesc: '正在等待接单员复核',
      base_amount: 3427.2,
      extra_amount: 403.2,
      special_charges_amount: 0,
      final_amount: 3830.4,
      items: [
        {
          label: '【care-26-08-05-1】',
          product_name: '展晨108热桥级系统断桥铝窗',
          width_mm: 2400,
          height_mm: 2100,
          actual_area: 5.04,
    order: null,
    steps: []
  },

  onLoad(options) {
    if (options && options.id) {
      this.setData({ orderId: options.id });
      this.fetchDetail(options.id);
    } else {
      this.updateSteps('pending_review');
    }
  },

  fetchDetail(id) {
    if (!id) return;
    request({ url: `/api/orders/${id}` }).then(res => {
      if (res.success && res.data) {
        const target = res.data;
        const statusInfo = STATUS_INFO_MAP[target.status] || {
          text: '待复核',
          desc: '正在等待接单员复核'
        };

        const items = (target.items || []).map((it, idx) => ({
          ...it,
          label: it.label || `【套系-${idx + 1}】`,
          actual_area: it.actual_area || it.billed_area || 0,
          options_summary: it.options_summary || []
        }));

        this.setData({
          order: {
            ...target,
            statusText: statusInfo.text,
            statusDesc: statusInfo.desc,
            items
          }
        });
        this.updateSteps(target.status);
      }
    });
  },

  updateSteps(currentStatus) {
    const statusOrder = ['pending_review', 'producing', 'installing', 'completed'];
    const currentIndex = statusOrder.indexOf(currentStatus);

    const steps = ALL_STEPS.map((step, idx) => ({
      ...step,
      active: idx <= (currentIndex >= 0 ? currentIndex : 0)
    }));

    this.setData({ steps });
  },

  makePhoneCall() {
    const phoneNumber = (this.data.order && this.data.order.store_phone) || '13545941637';
    wx.showActionSheet({
      itemList: [`拨打电话 (${phoneNumber})`, `复制号码 (${phoneNumber})`],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.makePhoneCall({
            phoneNumber,
            fail: (err) => {
              console.warn('拨号取消/失败', err);
            }
          });
        } else if (res.tapIndex === 1) {
          wx.setClipboardData({
            data: phoneNumber,
            success: () => {
              wx.showToast({ title: '已复制手机号', icon: 'success', duration: 1500 });
            }
          });
        }
      }
    });
  },

  navBackOrders() {
    wx.switchTab({ url: '/pages/order-list/order-list' });
  }
});
