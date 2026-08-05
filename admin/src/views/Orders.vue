<template>
  <div class="orders-view">
    <div class="header-bar flex-between mb-4">
      <h2 class="view-title">订单管理 (状态扭转与特殊费用核算)</h2>
      <a-button type="primary" @click="fetchOrders">
        <template #icon><icon-refresh /></template>
        刷新订单数据
      </a-button>
    </div>

    <!-- 筛选 Radio Pills -->
    <a-radio-group v-model="statusFilter" type="button" class="mb-4" @change="handleFilterChange">
      <a-radio value="all">全部订单</a-radio>
      <a-radio value="pending_review">待复核</a-radio>
      <a-radio value="producing">生产中</a-radio>
      <a-radio value="installing">待提货</a-radio>
      <a-radio value="completed">已完成</a-radio>
    </a-radio-group>

    <!-- 订单数据表格 -->
    <a-table :data="filteredOrders" :pagination="{ pageSize: 10 }" border>
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

        <a-table-column title="当前状态" :width="140">
          <template #cell="{ record }">
            <a-tag :color="getStatusColor(record.status)">{{ getStatusText(record.status) }}</a-tag>
          </template>
        </a-table-column>

        <a-table-column title="操作" :width="160">
          <template #cell="{ record }">
            <a-button type="outline" size="small" @click="openModal(record)">
              <template #icon><icon-edit /></template>
              复核/改价状态
            </a-button>
          </template>
        </a-table-column>
      </template>
    </a-table>

    <!-- 复核及调价 Modal 弹窗 -->
    <a-modal v-model:visible="modalVisible" title="展晨门窗 - 订单复核与特殊费用调整" @ok="handleSaveOrder" @cancel="modalVisible = false">
      <a-form :model="editForm" layout="vertical">
        <a-form-item label="订单编号">
          <a-input v-model="editForm.order_no" readonly />
        </a-form-item>

        <a-form-item label="一键扭转订单状态">
          <a-select v-model="editForm.status">
            <a-option value="pending_review">待复核</a-option>
            <a-option value="producing">生产中</a-option>
            <a-option value="installing">待提货</a-option>
            <a-option value="completed">已完成</a-option>
            <a-option value="cancelled">已取消</a-option>
          </a-select>
        </a-form-item>

        <a-form-item label="商家补充特殊费用 (元)">
          <a-input-number v-model="editForm.special_charges_amount" placeholder="如高楼吊装费500元、旧窗拆除费300元" />
        </a-form-item>

        <a-form-item label="商家复核备注说明">
          <a-textarea v-model="editForm.admin_remark" placeholder="填写现场勘测复核备注、吊装说明等" />
        </a-form-item>
      </a-form>
    </a-modal>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';

const statusFilter = ref('all');
const modalVisible = ref(false);

const orders = ref([
  {
    id: 'ord_101',
    order_no: 'ZC20260804001',
    customer_name: '张先生',
    customer_phone: '13545941637',
    install_address: '湖北省仙桃市恒迪建材市场A区3号',
    spec: '2400 × 2100 mm (5.04 ㎡)',
    base_amount: 3427.2,
    extra_amount: 403.2,
    special_charges_amount: 0,
    final_amount: 3830.4,
    status: 'pending_review',
    admin_remark: ''
  },
  {
    id: 'ord_102',
    order_no: 'ZC20260803009',
    customer_name: '李女士',
    customer_phone: '13971234567',
    install_address: '湖北省仙桃市新天地小区8栋1202',
    spec: '3600 × 2400 mm (12.5 ㎡)',
    base_amount: 8500,
    extra_amount: 1200,
    special_charges_amount: 500,
    final_amount: 10200,
    status: 'producing',
    admin_remark: '包含500元高楼吊装与异形开孔费'
  }
]);

const editForm = ref({
  id: '',
  order_no: '',
  status: 'pending_review',
  special_charges_amount: 0,
  admin_remark: ''
});

const filteredOrders = computed(() => {
  if (statusFilter.value === 'all') return orders.value;
  return orders.value.filter(o => o.status === statusFilter.value);
});

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

const getStatusColor = (status) => {
  const map = {
    'pending_review': 'gray',
    'producing': 'orange',
    'installing': 'gold',
    'completed': 'green',
    'cancelled': 'gray'
  };
  return map[status] || 'gray';
};

const fetchOrders = () => {
  Message.success('订单列表已刷新');
};

const openModal = (record) => {
  editForm.value = {
    id: record.id,
    order_no: record.order_no,
    status: record.status,
    special_charges_amount: record.special_charges_amount || 0,
    admin_remark: record.admin_remark || ''
  };
  modalVisible.value = true;
};

const handleSaveOrder = () => {
  const target = orders.value.find(o => o.id === editForm.value.id);
  if (target) {
    target.status = editForm.value.status;
    target.special_charges_amount = editForm.value.special_charges_amount;
    target.final_amount = target.base_amount + (target.extra_amount || 0) + editForm.value.special_charges_amount;
    target.admin_remark = editForm.value.admin_remark;
  }
  Message.success('订单复核及状态更新成功！');
  modalVisible.value = false;
};

onMounted(() => {
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
</style>
