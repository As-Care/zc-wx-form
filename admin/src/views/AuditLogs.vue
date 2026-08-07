<template>
  <div class="audit-logs-view">
    <div class="header-bar flex-between mb-4">
      <h2 class="view-title">操作日志</h2>
    </div>

    <a-card class="search-panel mb-4" size="small">
      <a-form :model="searchForm" auto-label-width>
        <a-row :gutter="[12, 16]">
          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item label="事件类型">
              <a-select v-model="searchForm.event_type" allow-clear placeholder="全部事件" style="width: 100%;">
                <a-option v-for="event in eventTypes" :key="event" :value="event">{{ event }}</a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item label="管理员账号">
              <a-input v-model="searchForm.actor_username" allow-clear placeholder="账号或管理员姓名" style="width: 100%;" @press-enter="handleSearch" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item label="用户昵称">
              <a-input v-model="searchForm.user_nickname" allow-clear placeholder="客户昵称/姓名" style="width: 100%;" @press-enter="handleSearch" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12" :md="6">
            <a-form-item label="用户手机号">
              <a-input v-model="searchForm.user_phone" allow-clear placeholder="客户手机号" style="width: 100%;" @press-enter="handleSearch" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="16" :md="11">
            <a-form-item label="日志时间">
              <a-range-picker v-model="searchForm.timeRange" show-time format="YYYY-MM-DD HH:mm:ss" style="width: 100%;" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="8" :md="6">
            <a-form-item>
              <a-space>
                <a-button type="primary" @click="handleSearch"><template #icon><icon-search /></template>查询</a-button>
                <a-button @click="resetSearch"><template #icon><icon-refresh /></template>重置</a-button>
              </a-space>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-card>

    <a-table
      :data="logs"
      :loading="loading"
      :pagination="pagination"
      border
      row-key="id"
      @page-change="pageChange"
      @page-size-change="pageSizeChange"
    >
      <template #columns>
        <a-table-column title="日志时间" data-index="created_at" :width="180" />
        <a-table-column title="事件类型" :width="120">
          <template #cell="{ record }"><a-tag color="arcoblue">{{ record.event_type }}</a-tag></template>
        </a-table-column>
        <a-table-column title="管理员账号" :width="180">
          <template #cell="{ record }">
            <strong>{{ record.actor_name || record.actor_username || '管理员' }}</strong>
            <div class="sub-text">{{ record.actor_username || record.actor_id || '-' }}</div>
          </template>
        </a-table-column>
        <a-table-column title="关联用户" :width="210">
          <template #cell="{ record }">
            <span v-if="record.user_nickname || record.user_phone">{{ record.user_nickname || '-' }}</span>
            <div v-if="record.user_phone" class="sub-text">{{ record.user_phone }}</div>
            <span v-if="!record.user_nickname && !record.user_phone" class="sub-text">-</span>
          </template>
        </a-table-column>
        <a-table-column title="操作内容" data-index="action" :min-width="360" />
        <a-table-column title="目标编号" :width="190">
          <template #cell="{ record }">{{ record.target_id || '-' }}</template>
        </a-table-column>
      </template>
    </a-table>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';

import request from '../utils/request';
const eventTypes = ['订单管理', '订单状态', '客户管理', '客户资料', '客户地址', '门窗商品', '门窗分类', '接单员', '门店配置', '管理员账号', '角色权限', '系统菜单', '系统操作'];
const searchForm = ref({ event_type: '', actor_username: '', user_nickname: '', user_phone: '', timeRange: [] });
const logs = ref([]);
const loading = ref(false);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const pagination = computed(() => ({ current: page.value, pageSize: pageSize.value, total: total.value, showTotal: true, showJumper: true, showPageSize: true }));

const formatTime = value => {
  if (!value) return '';
  if (typeof value.format === 'function') return value.format('YYYY-MM-DD HH:mm:ss');
  return value instanceof Date ? value.toISOString().replace('T', ' ').slice(0, 19) : String(value);
};

const fetchLogs = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize.value) });
    ['event_type', 'actor_username', 'user_nickname', 'user_phone'].forEach(key => {
      if (searchForm.value[key]) params.set(key, searchForm.value[key].trim());
    });
    if (searchForm.value.timeRange && searchForm.value.timeRange.length === 2) {
      params.set('start_time', formatTime(searchForm.value.timeRange[0]));
      params.set('end_time', formatTime(searchForm.value.timeRange[1]));
    }
    const data = await request(`/api/admin/audit-logs?${params.toString()}`);
    logs.value = data.success ? data.data || [] : [];
    total.value = data.pagination?.total || 0;
  } catch (error) {
    logs.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
};

const handleSearch = () => { page.value = 1; fetchLogs(); };
const resetSearch = () => {
  searchForm.value = { event_type: '', actor_username: '', user_nickname: '', user_phone: '', timeRange: [] };
  page.value = 1;
  fetchLogs();
};
const pageChange = value => { page.value = value; fetchLogs(); };
const pageSizeChange = value => { pageSize.value = value; page.value = 1; fetchLogs(); };

onMounted(fetchLogs);
</script>

<style scoped>
.audit-logs-view { display: flex; flex-direction: column; }
.header-bar { display: flex; justify-content: space-between; align-items: center; }
.view-title { margin: 0; font-size: 20px; font-weight: 700; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.mb-4 { margin-bottom: 16px; }
.sub-text { color: #86909c; font-size: 12px; margin-top: 3px; }
.audit-logs-view :deep(.arco-card-body) {
  padding: 12px 16px;
}
.audit-logs-view :deep(.arco-form-item) {
  margin-bottom: 0 !important;
}
</style>
