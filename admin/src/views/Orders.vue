<template>
  <div class="orders-view">
    <div class="header-bar flex-between mb-4">
      <h2 class="view-title">订单管理 (状态扭转与特殊费用核算)</h2>
    </div>

    <!-- 高级搜索筛选卡片 -->
    <a-card class="mb-4" size="small">
      <a-form :model="searchForm" layout="inline" style="flex-wrap: wrap; gap: 12px 16px;">
        <a-form-item label="订单编号" style="margin-right: 0; margin-bottom: 0;">
          <a-input
            v-model="searchForm.order_no"
            placeholder="请输入订单编号"
            allow-clear
            @press-enter="handleSearch"
            style="width: 200px"
          />
        </a-form-item>

        <a-form-item label="客户信息" style="margin-right: 0; margin-bottom: 0;">
          <a-input
            v-model="searchForm.customer"
            placeholder="姓名或手机号"
            allow-clear
            @press-enter="handleSearch"
            style="width: 200px"
          />
        </a-form-item>

        <a-form-item label="商品名称" style="margin-right: 0; margin-bottom: 0;">
          <a-input
            v-model="searchForm.product_name"
            placeholder="请输入商品名称"
            allow-clear
            @press-enter="handleSearch"
            style="width: 200px"
          />
        </a-form-item>

        <a-form-item label="订单状态" style="margin-right: 0; margin-bottom: 0;">
          <a-select
            v-model="searchForm.status"
            placeholder="请选择状态"
            allow-clear
            style="width: 170px"
            @change="handleSearch"
          >
            <a-option value="all">全部订单</a-option>
            <a-option value="pending_review">待复核</a-option>
            <a-option value="producing">生产中</a-option>
            <a-option value="installing">待提货</a-option>
            <a-option value="completed">已完成</a-option>
            <a-option value="cancelled">已取消</a-option>
          </a-select>
        </a-form-item>

        <a-form-item style="margin-right: 0; margin-bottom: 0;">
          <div style="display: flex; gap: 8px;">
            <a-button type="primary" @click="handleSearch">
              <template #icon><icon-search /></template>
              查询
            </a-button>
            <a-button @click="handleReset">
              <template #icon><icon-refresh /></template>
              重置
            </a-button>
          </div>
        </a-form-item>
      </a-form>
    </a-card>

    <!-- 订单数据表格 (服务端真实分页与检索) -->
    <a-table
      :data="orders"
      :pagination="paginationConfig"
      :loading="loading"
      border
      row-key="id"
      @page-change="onPageChange"
      @page-size-change="onPageSizeChange"
    >
      <template #columns>
        <a-table-column title="订单编号" data-index="order_no" :width="160">
          <template #cell="{ record }">
            <strong>{{ record.order_no }}</strong>
          </template>
        </a-table-column>

        <a-table-column title="客户信息" :width="220">
          <template #cell="{ record }">
            <div><strong>{{ record.customer_name }}</strong> ({{ record.customer_phone }})</div>
            <div style="font-size: 12px; color: #86909c;">{{ record.install_address }}</div>
          </template>
        </a-table-column>

        <a-table-column title="定制规格" :width="200">
          <template #cell="{ record }">
            <span v-if="record.items && record.items.length > 0">
              {{ record.items[0].product_name }}<br>
              <small style="color: #C5A880;">{{ record.items[0].width_mm }} × {{ record.items[0].height_mm }} mm ({{ record.items[0].billed_area }} ㎡)</small>
            </span>
            <span v-else>{{ record.spec || '系统配置门窗' }}</span>
          </template>
        </a-table-column>

        <a-table-column title="预估平米费" data-index="base_amount" :width="120">
          <template #cell="{ record }">
            ¥ {{ record.base_amount }}
          </template>
        </a-table-column>

        <a-table-column title="特殊调价/费用" :width="140">
          <template #cell="{ record }">
            <a-tag v-if="record.special_charges_amount > 0" color="orange">+ ¥ {{ record.special_charges_amount }}</a-tag>
            <span v-else style="color: #86909c;">无追加</span>
          </template>
        </a-table-column>

        <a-table-column title="最终总金额" :width="140">
          <template #cell="{ record }">
            <strong style="color: #C5A880; font-size: 16px;">¥ {{ record.final_amount }}</strong>
          </template>
        </a-table-column>

        <a-table-column title="当前状态" :width="120">
          <template #cell="{ record }">
            <div class="status-col">
              <span class="custom-status-tag" :style="getStatusStyle(record.status)">{{ getStatusText(record.status) }}</span>
            </div>
          </template>
        </a-table-column>

        <!-- 左右并排单行按钮样式 -->
        <a-table-column title="操作" :width="240">
          <template #cell="{ record }">
            <div style="display: flex; flex-direction: row; align-items: center; white-space: nowrap; gap: 6px;">
              <a-button type="outline" size="small" @click="viewOrderDetail(record)">
                查看详情
              </a-button>
              <a-button type="outline" status="warning" size="small" @click="openModal(record)">
                修改状态
              </a-button>
              <a-popconfirm content="确定要删除该订单吗？删除后无法恢复！" @ok="deleteOrder(record)">
                <a-button type="outline" status="danger" size="small">
                  删除
                </a-button>
              </a-popconfirm>
            </div>
          </template>
        </a-table-column>
      </template>
    </a-table>

    <OrderDetailDrawer
      v-model:visible="detailDrawerVisible"
      :order="currentOrderDetail"
    />

    <StatusUpdateModal
      v-model:visible="modalVisible"
      :orderRecord="currentRecord"
      @refresh="fetchOrders"
    />

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { Message } from '@arco-design/web-vue';
import OrderDetailDrawer from '../components/OrderDetailDrawer.vue';
import StatusUpdateModal from '../components/StatusUpdateModal.vue';

const route = useRoute();

const API_BASE = 'https://zc-api.carelife.top';

const searchForm = ref({
  order_no: '',
  customer: '',
  product_name: '',
  status: 'all'
});

const loading = ref(false);
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);

const modalVisible = ref(false);
const detailDrawerVisible = ref(false);
const currentOrderDetail = ref(null);

const paginationConfig = computed(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: total.value,
  showTotal: true,
  showJumper: true,
  showPageSize: true
}));

// 清空所有静态 Mock 数据，全部从 API 动态获取
const orders = ref([]);

const currentRecord = ref(null);

const getStatusText = (status) => {
  const map = {
    'pending_review': '待复核',
    'producing': '生产中',
    'installing': '待提货',
    'completed': '已完成',
    'cancelled': '已取消'
  };
  return map[status] || status;
};

const getStatusStyle = (status) => {
  const map = {
    'pending_review': { backgroundColor: '#e2e8f0', color: '#64748b', borderColor: '#94a3b8' },
    'producing': { backgroundColor: '#f97316', color: '#ffffff', borderColor: '#f97316' },
    'installing': { backgroundColor: '#eab308', color: '#ffffff', borderColor: '#eab308' },
    'completed': { backgroundColor: '#10b981', color: '#ffffff', borderColor: '#10b981' },
    'cancelled': { backgroundColor: '#f1f5f9', color: '#94a3b8', borderColor: '#cbd5e1' }
  };
  return map[status] || map['pending_review'];
};

const handleSearch = () => {
  page.value = 1;
  fetchOrders();
};

const handleReset = () => {
  searchForm.value = {
    order_no: '',
    customer: '',
    product_name: '',
    status: 'all'
  };
  page.value = 1;
  fetchOrders();
};

const onPageChange = (current) => {
  page.value = current;
  fetchOrders();
};

const onPageSizeChange = (size) => {
  pageSize.value = size;
  page.value = 1;
  fetchOrders();
};

const fetchOrders = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    params.append('page', page.value);
    params.append('pageSize', pageSize.value);
    if (searchForm.value.status && searchForm.value.status !== 'all') {
      params.append('status', searchForm.value.status);
    }
    if (searchForm.value.order_no.trim()) {
      params.append('order_no', searchForm.value.order_no.trim());
    }
    if (searchForm.value.customer.trim()) {
      params.append('customer', searchForm.value.customer.trim());
    }
    if (searchForm.value.product_name.trim()) {
      params.append('product_name', searchForm.value.product_name.trim());
    }
    const url = `${API_BASE}/api/orders?${params.toString()}`;

    const res = await fetch(url);
    const data = await res.json();
    if (data.success && data.data) {
      orders.value = data.data.map(o => ({
        id: o.id,
        order_no: o.order_no,
        customer_name: o.customer_name || '客户',
        customer_phone: o.customer_phone || '',
        install_address: o.install_address || '',
        customer_remark: o.customer_remark || '',
        scene_images: o.scene_images || '',
        created_at: o.created_at || '',
        spec: o.items && o.items[0] ? `${o.items[0].width_mm} × ${o.items[0].height_mm} mm (${o.items[0].billed_area} ㎡)` : '',
        base_amount: o.base_amount || 0,
        extra_amount: o.extra_amount || 0,
        special_charges_amount: o.special_charges_amount || 0,
        final_amount: o.final_amount || 0,
        status: o.status || 'pending_review',
        admin_remark: o.admin_remark || '',
        items: o.items || []
      }));
      total.value = data.pagination ? data.pagination.total : orders.value.length;
    } else {
      orders.value = [];
      total.value = 0;
    }
  } catch (e) {
    orders.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
};

const viewOrderDetail = async (record) => {
  currentOrderDetail.value = { ...record };
  detailDrawerVisible.value = true;
  try {
    const res = await fetch(`${API_BASE}/api/orders/${record.id}`);
    const data = await res.json();
    if (data.success && data.data && data.data.order) {
      currentOrderDetail.value = {
        ...data.data.order,
        customer_remark: data.data.order.customer_remark || record.customer_remark || '',
        scene_images: data.data.order.scene_images || record.scene_images || '',
        items: data.data.order.items || record.items || []
      };
    }
  } catch (e) {}
};

const openModal = (record) => {
  currentRecord.value = { ...record };
  modalVisible.value = true;
};

const deleteOrder = async (record) => {
  try {
    const res = await fetch(`${API_BASE}/api/orders/${record.id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      Message.success('订单已成功删除');
      fetchOrders();
    } else {
      Message.error(data.message || '删除失败');
    }
  } catch (error) {
    Message.error('网络请求异常，删除失败');
  }
};

onMounted(() => {
  if (route.query.customer) {
    searchForm.value.customer = route.query.customer;
  }
  fetchOrders();
});
</script>

<style scoped>
.orders-view {
  display: flex;
  flex-direction: column;
}

.view-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mb-4 {
  margin-bottom: 16px;
}

.custom-status-tag {
  display: inline-block;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 24px;
  font-weight: 500;
  text-align: center;
}
</style>
