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

        <a-table-column title="当前状态" :width="120">
          <template #cell="{ record }">
            <a-tag :color="getStatusColor(record.status)">{{ getStatusText(record.status) }}</a-tag>
          </template>
        </a-table-column>

        <!-- 左右并排单行按钮样式 -->
        <a-table-column title="操作" :width="230">
          <template #cell="{ record }">
            <div style="display: flex; gap: 8px; align-items: center;">
              <a-button type="outline" size="small" @click="viewOrderDetail(record)">
                <template #icon><icon-eye /></template>
                订单详情
              </a-button>
              <a-button type="outline" status="warning" size="small" @click="openModal(record)">
                <template #icon><icon-edit /></template>
                修改状态/改价
              </a-button>
            </div>
          </template>
        </a-table-column>
      </template>
    </a-table>

    <!-- 侧滑抽屉：小程序全量订单详情预览 -->
    <a-drawer
      v-model:visible="detailDrawerVisible"
      title="小程序订单全量规格与核算详情"
      :width="780"
      :footer="false"
    >
      <div v-if="currentOrderDetail">
        <!-- 头部状态 banner -->
        <div class="status-banner mb-4">
          <div class="flex-between">
            <div>
              <span style="font-size: 12px; color: #86909c;">订单编号：</span>
              <strong style="font-size: 16px; color: #1d2129;">{{ currentOrderDetail.order_no }}</strong>
            </div>
            <a-tag :color="getStatusColor(currentOrderDetail.status)" size="large">
              {{ getStatusText(currentOrderDetail.status) }}
            </a-tag>
          </div>
          <div style="font-size: 12px; color: #86909c; margin-top: 6px;">
            下单时间：{{ currentOrderDetail.created_at || '2026-08-04 18:00' }}
          </div>
        </div>

        <!-- 👤 客户基本信息 -->
        <a-card title="👤 客户基本信息" class="mb-4" size="small">
          <a-descriptions :column="2" border size="small">
            <a-descriptions-item label="客户姓名">{{ currentOrderDetail.customer_name }}</a-descriptions-item>
            <a-descriptions-item label="联系电话">{{ currentOrderDetail.customer_phone }}</a-descriptions-item>
            <a-descriptions-item label="安装详细地址" :span="2">{{ currentOrderDetail.install_address }}</a-descriptions-item>
          </a-descriptions>
        </a-card>

        <!-- 📐 门窗多套定制规格明细拆解 -->
        <a-card title="📐 门窗多套定制规格明细拆解" class="mb-4" size="small">
          <div
            v-for="(item, idx) in currentOrderDetail.items"
            :key="idx"
            class="item-spec-box mb-3"
          >
            <div class="flex-between mb-2">
              <a-tag color="arcoblue" style="font-weight: 600;">{{ item.label || `套系 ${idx + 1}` }}</a-tag>
              <strong style="color: #b89768; font-size: 16px;">小计：¥ {{ item.item_subtotal || item.billed_area * item.base_price_sqm }}</strong>
            </div>

            <h4 style="margin: 4px 0 8px 0; font-size: 15px; color: #1d2129;">{{ item.product_name }}</h4>
            <div style="font-size: 13px; color: #4e5969; margin-bottom: 8px;">
              规格尺寸：<strong>{{ item.width_mm }} × {{ item.height_mm }} mm</strong>
              &nbsp;|&nbsp;
              实际面积：<strong>{{ item.area_sqm || ((item.width_mm * item.height_mm) / 1000000).toFixed(2) }} ㎡</strong>
              &nbsp;|&nbsp;
              计费起步面积：<strong>{{ item.billed_area }} ㎡</strong>
            </div>

            <!-- 选配明细卡片 -->
            <div class="options-detail-panel" v-if="item.selected_options && item.selected_options.length > 0">
              <div class="panel-title">选配升级配置明细：</div>
              <div v-for="(opt, oIdx) in item.selected_options" :key="oIdx" class="option-row">
                <span class="dot">•</span>
                <span class="group-label">{{ opt.group }}：</span>
                <span class="opt-name">{{ opt.name }}</span>
                <span class="opt-price" v-if="opt.priceText">{{ opt.priceText }}</span>
              </div>
            </div>
          </div>
        </a-card>

        <!-- 💰 订单核算金额明细汇总 -->
        <a-card title="💰 订单核算金额明细拆解" class="mb-4" size="small">
          <div class="price-summary-box">
            <div class="price-row flex-between">
              <span>基础平米总费用：</span>
              <span>¥ {{ currentOrderDetail.base_amount }}</span>
            </div>
            <div class="price-row flex-between">
              <span>选配升级加价：</span>
              <span>¥ {{ currentOrderDetail.extra_amount || 0 }}</span>
            </div>
            <div class="price-row flex-between" v-if="currentOrderDetail.special_charges_amount > 0">
              <span style="color: #ff7d00;">商家追加特殊费用 (如吊装/旧窗拆除)：</span>
              <span style="color: #ff7d00; font-weight: bold;">+ ¥ {{ currentOrderDetail.special_charges_amount }}</span>
            </div>
            <a-divider style="margin: 10px 0;" />
            <div class="price-row flex-between" style="font-size: 18px;">
              <strong>订单核算最终总金额：</strong>
              <strong style="color: #C5A880; font-size: 20px;">¥ {{ currentOrderDetail.final_amount }}</strong>
            </div>
          </div>
        </a-card>

        <!-- 📝 商家备注 -->
        <a-card title="📝 商家备注" size="small" v-if="currentOrderDetail.admin_remark">
          <div style="font-size: 13px; color: #4e5969; background: rgba(0,0,0,0.02); padding: 12px; border-radius: 8px; border: 1px dashed #e5e6eb;">
            {{ currentOrderDetail.admin_remark }}
          </div>
        </a-card>

        <div style="margin-top: 24px; display: flex; justify-content: flex-end;">
          <a-button type="primary" size="large" @click="detailDrawerVisible = false">关闭详情</a-button>
        </div>
      </div>
    </a-drawer>

    <!-- 修改状态及调价 Modal 弹窗 -->
    <a-modal v-model:visible="modalVisible" title="展晨门窗 - 订单状态与特殊费用修改" @ok="handleSaveOrder" @cancel="modalVisible = false">
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

        <a-form-item label="商家订单备注">
          <a-textarea v-model="editForm.admin_remark" placeholder="填写订单备注、现场测量或客户特殊要求说明" />
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
const detailDrawerVisible = ref(false);
const currentOrderDetail = ref(null);

const orders = ref([
  {
    id: 'ord_101',
    order_no: 'ZC20260804001',
    customer_name: '张先生',
    customer_phone: '13545941637',
    install_address: '湖北省仙桃市恒迪建材市场A区3号',
    created_at: '2026-08-04 18:00',
    spec: '2400 × 2100 mm (5.04 ㎡)',
    base_amount: 3427.2,
    extra_amount: 403.2,
    special_charges_amount: 0,
    final_amount: 3830.4,
    status: 'pending_review',
    admin_remark: '窗口尺寸测量正常，已与客户确认生产细节',
    items: [
      {
        label: '【care-26-08-05-1】',
        product_name: '展晨108热桥级系统断桥铝窗',
        width_mm: 2400,
        height_mm: 2100,
        area_sqm: 5.04,
        billed_area: 5.04,
        base_price_sqm: 680,
        item_subtotal: 3830.4,
        selected_options: [
          { group: '玻璃配置', name: '5+18A+5 标准中空钢化玻璃', priceText: '+¥ 0/㎡' },
          { group: '五金配件品牌', name: '德国好博 (Hoppe) 原装执手五金', priceText: '+¥ 150/件' },
          { group: '铝材表面喷涂颜色', name: '氟碳雅致黑', priceText: '+¥ 0' }
        ]
      }
    ]
  },
  {
    id: 'ord_102',
    order_no: 'ZC20260803009',
    customer_name: '李女士',
    customer_phone: '13971234567',
    install_address: '湖北省仙桃市新天地小区8栋1202',
    created_at: '2026-08-03 14:30',
    spec: '3600 × 2400 mm (12.5 ㎡)',
    base_amount: 8500,
    extra_amount: 1200,
    special_charges_amount: 500,
    final_amount: 10200,
    status: 'producing',
    admin_remark: '包含500元高楼吊装与旧窗拆除费，型材已发往车间生产中',
    items: [
      {
        label: '【care-26-08-05-2】',
        product_name: '展晨120超静音三玻两腔系统窗',
        width_mm: 3600,
        height_mm: 2400,
        area_sqm: 8.64,
        billed_area: 12.5,
        base_price_sqm: 880,
        item_subtotal: 9700,
        selected_options: [
          { group: '玻璃配置', name: '5+12A+5+12A+5 三玻两腔降噪玻璃', priceText: '+¥ 150/㎡' },
          { group: '五金配件品牌', name: '德国丝吉利娅 隐藏锁扣', priceText: '+¥ 220/件' },
          { group: '铝材表面喷涂颜色', name: '阳极氧化香槟银', priceText: '+¥ 50' }
        ]
      }
    ]
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
  // 静默刷新数据，不弹窗打扰用户
};

const viewOrderDetail = (record) => {
  currentOrderDetail.value = record;
  detailDrawerVisible.value = true;
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
  Message.success('订单状态及备注更新成功！');
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

.mb-3 {
  margin-bottom: 12px;
}

.mb-2 {
  margin-bottom: 8px;
}

.status-banner {
  background: rgba(197, 168, 128, 0.08);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid rgba(197, 168, 128, 0.2);
}

.item-spec-box {
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid #e5e6eb;
  border-radius: 10px;
  padding: 16px;
}

body[arco-theme='dark'] .item-spec-box {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
}

.options-detail-panel {
  background: rgba(197, 168, 128, 0.06);
  border-radius: 8px;
  padding: 10px 14px;
  margin-top: 10px;
}

.panel-title {
  font-size: 12px;
  font-weight: 600;
  color: #b89768;
  margin-bottom: 6px;
}

.option-row {
  font-size: 13px;
  line-height: 1.8;
  color: #4e5969;
}

body[arco-theme='dark'] .option-row {
  color: #cbd5e1;
}

.option-row .dot {
  color: #b89768;
  margin-right: 6px;
}

.option-row .opt-price {
  color: #b89768;
  margin-left: 8px;
  font-weight: 500;
}

.price-summary-box .price-row {
  font-size: 14px;
  margin-bottom: 8px;
  color: #4e5969;
}

body[arco-theme='dark'] .price-summary-box .price-row {
  color: #cbd5e1;
}
</style>
