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

function formatOptionsSummary(it) {
  let opts = it.options_summary || [];
  if (typeof opts === 'string') {
    try { opts = JSON.parse(opts); } catch (e) { opts = []; }
  }
  if ((!opts || opts.length === 0) && typeof it.options_summary_json === 'string') {
    try { opts = JSON.parse(it.options_summary_json); } catch (e) { opts = []; }
  }

  if ((!opts || opts.length === 0) && it.selected_options_json) {
    try {
      const selMap = JSON.parse(it.selected_options_json);
      if (selMap && typeof selMap === 'object') {
        opts = Object.keys(selMap).map(g => {
          const raw = selMap[g];
          return { groupTitle: g, option_name: typeof raw === 'string' ? raw : (raw?.option_name || raw?.name || ''), priceText: '' };
        });
      }
    } catch (e) {}
  }

  return (opts || []).map(o => ({
    ...o,
    groupTitle: o.groupTitle || o.group_name || '选配',
    option_name: o.option_name || o.name || ''
  })).filter(o => o.option_name);
}

Page({
  data: {
    orderId: '',
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
        const target = res.data.order || res.data;
        const statusInfo = STATUS_INFO_MAP[target.status] || {
          text: '待复核',
          desc: '正在等待接单员复核'
        };

        const items = (target.items || []).map((it, idx) => {
          const optsSum = formatOptionsSummary(it);

          let itemSceneImgs = [];
          if (typeof it.scene_images === 'string') {
            itemSceneImgs = it.scene_images.split(',').map(s => s.trim()).filter(Boolean);
          } else if (Array.isArray(it.scene_images)) {
            itemSceneImgs = it.scene_images;
          }
          if ((!itemSceneImgs || itemSceneImgs.length === 0) && target.scene_images) {
            itemSceneImgs = typeof target.scene_images === 'string'
              ? target.scene_images.split(',').map(s => s.trim()).filter(Boolean)
              : (Array.isArray(target.scene_images) ? target.scene_images : []);
          }

          const itemRemark = it.remark || '';
          
          let cleanLabel = it.label || '';
          if (cleanLabel.startsWith('【') && cleanLabel.endsWith('】')) {
            cleanLabel = cleanLabel.substring(1, cleanLabel.length - 1);
          }

          return {
            ...it,
            label: cleanLabel || `套系-${idx + 1}`,
            actual_area: it.actual_area || it.billed_area || 0,
            options_summary: optsSum,
            scene_images_list: itemSceneImgs,
            customer_remark: itemRemark
          };
        });

        const scene_images_list = typeof target.scene_images === 'string'
          ? target.scene_images.split(',').map(s => s.trim()).filter(Boolean)
          : (Array.isArray(target.scene_images) ? target.scene_images : []);

        this.setData({
          order: {
            ...target,
            statusText: statusInfo.text,
            statusDesc: statusInfo.desc,
            scene_images_list,
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

  previewSceneImg(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      current: url,
      urls: (this.data.order && this.data.order.scene_images_list) || [url]
    });
  },

  previewItemSceneImg(e) {
    const url = e.currentTarget.dataset.url;
    const idx = e.currentTarget.dataset.idx;
    const item = this.data.order && this.data.order.items && this.data.order.items[idx];
    const urls = (item && item.scene_images_list) || [url];
    wx.previewImage({
      current: url,
      urls
    });
  },

  navBackOrders() {
    wx.switchTab({ url: '/pages/order-list/order-list' });
  }
});
