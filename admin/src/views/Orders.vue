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
            <a-tag :color="getStatusColor(record.status)">{{ getStatusText(record.status) }}</a-tag>
          </template>
        </a-table-column>

        <!-- 左右并排单行按钮样式 -->
        <a-table-column title="操作" :width="180">
          <template #cell="{ record }">
            <div style="display: flex; flex-direction: row; align-items: center; white-space: nowrap; gap: 6px;">
              <a-button type="outline" size="small" @click="viewOrderDetail(record)">
                查看详情
              </a-button>
              <a-button type="outline" status="warning" size="small" @click="openModal(record)">
                修改状态
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
            下单时间：{{ currentOrderDetail.created_at || '暂无时间' }}
          </div>
        </div>

        <!-- 👤 客户基本信息 -->
        <a-card title="👤 客户基本信息与现场照片" class="mb-4" size="small">
          <a-descriptions :column="2" border size="small">
            <a-descriptions-item label="客户姓名">{{ currentOrderDetail.customer_name }}</a-descriptions-item>
            <a-descriptions-item label="联系电话">{{ currentOrderDetail.customer_phone }}</a-descriptions-item>
            <a-descriptions-item label="安装详细地址" :span="2">{{ currentOrderDetail.install_address }}</a-descriptions-item>
            <a-descriptions-item label="客户现场备注" :span="2">
              <span v-if="currentOrderDetail.customer_remark">{{ currentOrderDetail.customer_remark }}</span>
              <span v-else style="color: #c9cdd4;">暂无现场备注</span>
            </a-descriptions-item>
            <a-descriptions-item label="现场环境照片" :span="2">
              <div v-if="getSceneImages(currentOrderDetail).length > 0" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;">
                <a-image
                  v-for="(imgUrl, imgIdx) in getSceneImages(currentOrderDetail)"
                  :key="imgIdx"
                  :src="imgUrl"
                  width="90"
                  height="90"
                  style="object-fit: cover; border-radius: 6px; border: 1px solid #e5e6eb;"
                />
              </div>
              <span v-else style="color: #c9cdd4;">暂无现场照片</span>
            </a-descriptions-item>
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
            <div class="options-detail-panel" v-if="getItemOptions(item).length > 0">
              <div class="panel-title">选配升级配置明细：</div>
              <div v-for="(opt, oIdx) in getItemOptions(item)" :key="oIdx" class="option-row" style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                <span class="dot">•</span>
                <span class="group-label">{{ opt.groupTitle || opt.group || opt.group_name || '选配' }}：</span>
                <img v-if="opt.image_url" :src="opt.image_url" style="width: 20px; height: 20px; object-fit: cover; border-radius: 3px; border: 1px solid #e5e6eb;" />
                <span class="opt-name">{{ opt.option_name || opt.name || opt.id }}</span>
                <span class="opt-price" v-if="opt.priceText" style="color: #ff7d00; margin-left: 4px;">{{ opt.priceText }}</span>
              </div>
            </div>
            <div v-else class="options-detail-panel" style="color: #86909c; font-size: 12px; font-style: italic;">
              暂无特殊选配升级项 (使用基础标配)
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
    <a-modal v-model:visible="modalVisible" title="展晨门窗 - 订单状态与特殊费用修改" :on-before-ok="handleBeforeSaveOrder">
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

const editForm = ref({
  id: '',
  order_no: '',
  status: 'pending_review',
  special_charges_amount: 0,
  admin_remark: ''
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
    'pending_review': '#cbd5e1',
    'producing': '#f97316',
    'installing': '#eab308',
    'completed': '#10b981',
    'cancelled': '#94a3b8'
  };
  return map[status] || '#cbd5e1';
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

const getSceneImages = (order) => {
  if (!order || !order.scene_images) return [];
  if (Array.isArray(order.scene_images)) return order.scene_images;
  if (typeof order.scene_images === 'string') {
    try {
      const parsed = JSON.parse(order.scene_images);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
    return order.scene_images.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
};

const getItemOptions = (item) => {
  if (!item) return [];
  if (item.options_summary && Array.isArray(item.options_summary) && item.options_summary.length > 0) {
    return item.options_summary;
  }
  let summary = [];
  if (item.options_summary_json) {
    try {
      summary = JSON.parse(item.options_summary_json);
      if (Array.isArray(summary) && summary.length > 0) return summary;
    } catch (e) {}
  }
  let selMap = {};
  if (item.selected_options_json) {
    try { selMap = JSON.parse(item.selected_options_json); } catch (e) {}
  } else if (item.selected_options) {
    selMap = typeof item.selected_options === 'string' ? JSON.parse(item.selected_options) : item.selected_options;
  }
  if (selMap && typeof selMap === 'object') {
    const DEFAULT_OPT_MAP = {
      'opt_1': { group: '玻璃配置', name: '双层玻璃' },
      'opt_2': { group: '玻璃配置', name: '双层钢化玻璃' },
      'opt_3': { group: '门锁配置', name: '默认门锁' },
      'opt_4': { group: '铝材配置', name: '默认铝材' },
      'opt_5': { group: '颜色配置', name: '琉璃白' },
      'opt_6': { group: '颜色配置', name: '深空灰' },
      'opt_7': { group: '开门方向', name: '左锁（左合页）' },
      'opt_8': { group: '开门方向', name: '右锁（左合页）' },
      'opt_9': { group: '开门内外', name: '内开（朝内打开）' },
      'opt_10': { group: '开门内外', name: '外开（朝外打开）' }
    };
    return Object.keys(selMap).map(grp => {
      const rawVal = selMap[grp];
      const optId = typeof rawVal === 'string' ? rawVal : (rawVal && (rawVal.id || rawVal.option_name));
      const def = optId ? DEFAULT_OPT_MAP[optId] : null;
      return {
        groupTitle: def ? def.group : grp,
        option_name: def ? def.name : (optId || ''),
        priceText: ''
      };
    }).filter(o => o.option_name);
  }
  return [];
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

const handleBeforeSaveOrder = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/admin/orders/${editForm.value.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        new_status: editForm.value.status,
        special_charges_amount: editForm.value.special_charges_amount,
        admin_remark: editForm.value.admin_remark,
        operator_name: '展晨总管理'
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      Message.success('保存成功！');
      await fetchOrders();
      return true;
    } else {
      Message.error(data.message || `订单状态修改失败 (HTTP ${res.status})`);
      return false;
    }
  } catch (e) {
    Message.error('无法连接后端服务，更新失败');
    return false;
  }
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
