// 展晨门窗 订单列表 Page 逻辑
const { request } = require('../../utils/request');

const STATUS_MAP = {
  'pending_review': { label: '待复核', class: 'status-pending' },
  'producing': { label: '生产中', class: 'status-producing' },
  'installing': { label: '待提货', class: 'status-installing' },
  'completed': { label: '已完成', class: 'status-completed' },
  'cancelled': { label: '已取消', class: 'status-pending' }
};

Page({
  data: {
    statusTabs: [
      { key: 'all', title: '全部', count: 0 },
      { key: 'pending_review', title: '待复核', count: 0 },
      { key: 'producing', title: '生产中', count: 0 },
      { key: 'installing', title: '待提货', count: 0 },
      { key: 'completed', title: '已完成', count: 0 }
    ],
    activeStatus: 'all',
    orderList: [],
    filteredOrders: []
  },

  onShow() {
    this.fetchOrders();
  },

  onPullDownRefresh() {
    wx.showToast({
      title: '正在刷新',
      icon: 'loading',
      duration: 1000
    });
    this.fetchOrders().then(() => {
      wx.stopPullDownRefresh();
    }).catch(() => {
      wx.stopPullDownRefresh();
    });
  },

  switchTab(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({ activeStatus: status });
    this.filterOrders(status);
  },

  fetchOrders() {
    return request({ url: '/api/orders' }).then(res => {
      if (res.success && res.data) {
        const formatted = res.data.map(item => {
          const info = STATUS_MAP[item.status] || { label: '待复核', class: 'status-pending' };
          return {
            ...item,
            statusText: info.label,
            statusClass: info.class
          };
        });

        // 统计各个 Tab 的订单数量
        const counts = {
          all: formatted.length,
          pending_review: 0,
          producing: 0,
          installing: 0,
          completed: 0
        };

        formatted.forEach(o => {
          if (counts[o.status] !== undefined) {
            counts[o.status]++;
          }
        });

        const updatedTabs = this.data.statusTabs.map(tab => ({
          ...tab,
          count: counts[tab.key] || 0
        }));

        this.setData({
          orderList: formatted,
          statusTabs: updatedTabs
        });

        this.filterOrders(this.data.activeStatus);
      }
    });
  },

  filterOrders(status) {
    if (status === 'all') {
      this.setData({ filteredOrders: this.data.orderList });
    } else {
      const filtered = this.data.orderList.filter(o => o.status === status);
      this.setData({ filteredOrders: filtered });
    }
  },

  copyOrderNo(e) {
    const orderNo = e.currentTarget.dataset.no;
    if (orderNo) {
      wx.setClipboardData({
        data: orderNo,
        success() {
          wx.showToast({
            title: '订单号已复制',
            icon: 'success'
          });
        }
      });
    }
  },

  makePhoneCall() {
    wx.makePhoneCall({
      phoneNumber: '13545941637'
    });
  },

  navToOrderDetail(e) {
    const orderId = e.currentTarget.dataset.id || 'ord_101';
    wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${orderId}` });
  }
});
