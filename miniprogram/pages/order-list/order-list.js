// 展晨门窗 订单列表 Page 逻辑
const { request } = require('../../utils/request');

const STATUS_MAP = {
  'pending_review': { label: '待复核', class: 'status-pending' },
  'producing': { label: '生产中', class: 'status-producing' },
  'installing': { label: '待提货', class: 'status-installing' },
  'completed': { label: '已完成', class: 'status-completed' },
  'cancelled': { label: '已取消', class: 'status-cancelled' }
};

const STATUS_ALIASES = {
  '待复核': 'pending_review',
  '生产中': 'producing',
  '待提货': 'installing',
  '已完成': 'completed',
  '已取消': 'cancelled'
};

const PAGE_SIZE = 10;

Page({
  data: {
    statusTabs: [
      { key: 'all', title: '全部', count: 0 },
      { key: 'pending_review', title: '待复核', count: 0 },
      { key: 'producing', title: '生产中', count: 0 },
      { key: 'installing', title: '待提货', count: 0 },
      { key: 'completed', title: '已完成', count: 0 },
      { key: 'cancelled', title: '已取消', count: 0 }
    ],
    activeStatus: 'all',
    orderList: [],
    filteredOrders: [],
    page: 0,
    totalPages: 0,
    hasMore: true,
    loading: false,
    loaded: false,
    loadError: '',
    requiresLogin: false,
    statusNotices: []
  },

  onShow() {
    const app = getApp();
    this.setData({ statusNotices: [] });
    app.refreshOrderStatusNotices().then(() => {
      const notices = app.consumeOrderStatusNotices();
      if (notices.length > 0) {
        const formattedNotices = notices.map(item => {
          const rawStatus = item.status || item.to_status || item.order_status || '';
          const statusKey = STATUS_ALIASES[rawStatus] || rawStatus;
          const info = STATUS_MAP[statusKey] || STATUS_MAP.pending_review;
          return {
            ...item,
            status: statusKey,
            statusText: info.label,
            statusClass: info.class
          };
        });
        this.setData({ statusNotices: formattedNotices });
      }
    });
    const requestedStatus = app.globalData.orderListInitialStatus;
    // 该值只用于个人中心这一次跳转，避免用户以后打开订单页时仍被旧状态限制。
    delete app.globalData.orderListInitialStatus;

    if (requestedStatus && this.data.statusTabs.some(tab => tab.key === requestedStatus)) {
      this.setActiveStatus(requestedStatus);
      return;
    }
    this.fetchOrders({ reset: true });
  },

  onPullDownRefresh() {
    this.fetchOrders({ reset: true }).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    this.fetchOrders();
  },

  switchTab(e) {
    const status = e.currentTarget.dataset.status;
    if (!status || status === this.data.activeStatus) return;
    this.setActiveStatus(status);
  },

  setActiveStatus(status) {
    this.setData({
      activeStatus: status,
      orderList: [],
      filteredOrders: [],
      page: 0,
      totalPages: 0,
      hasMore: true,
      loaded: false,
      loadError: ''
    });
    this.fetchOrders({ reset: true });
  },

  fetchOrders({ reset = false } = {}) {
    if (this.data.loading || (!reset && !this.data.hasMore)) return Promise.resolve();

    const nextPage = reset ? 1 : this.data.page + 1;
    const query = [
      `page=${nextPage}`,
      `pageSize=${PAGE_SIZE}`
    ];
    if (this.data.activeStatus !== 'all') {
      query.push(`status=${encodeURIComponent(this.data.activeStatus)}`);
    }

    this.setData({ loading: true, loadError: '', requiresLogin: false });
    return request({ url: `/api/orders?${query.join('&')}` }).then(res => {
      if (!res.success || !Array.isArray(res.data)) {
        throw new Error(res.message || '订单加载失败');
      }

      const formatted = res.data.map(item => {
        const info = STATUS_MAP[item.status] || { label: '待复核', class: 'status-pending' };
        return {
          ...item,
          statusText: info.label,
          statusClass: info.class
        };
      });
      const orders = reset ? formatted : this.data.orderList.concat(formatted);
      const statusCounts = res.status_counts || {};
      const allCount = Object.keys(statusCounts).reduce((total, key) => total + Number(statusCounts[key] || 0), 0);
      const updatedTabs = this.data.statusTabs.map(tab => ({
        ...tab,
        count: tab.key === 'all' ? allCount : Number(statusCounts[tab.key] || 0)
      }));
      const pagination = res.pagination || {};
      const totalPages = Number(pagination.totalPages || 0);

      this.setData({
        orderList: orders,
        filteredOrders: orders,
        statusTabs: updatedTabs,
        page: nextPage,
        totalPages,
        hasMore: nextPage < totalPages,
        loaded: true
      });
    }).catch(err => {
      const message = err.message || '订单加载失败，请重试';
      this.setData({
        loaded: true,
        loadError: message,
        requiresLogin: /登录|401|Unauthorized/i.test(message)
      });
    }).finally(() => {
      this.setData({ loading: false });
    });
  },

  retryOrders() {
    this.fetchOrders({ reset: this.data.orderList.length === 0 });
  },

  goToLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
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
