<template>
  <div class="menus-view">
    <div class="header-bar flex-between mb-4">
      <h2 class="view-title">系统菜单管理 (CRUD)</h2>
      <a-button type="primary" @click="openCreateModal">
        <template #icon><icon-plus /></template>
        新增系统菜单
      </a-button>
    </div>

    <!-- 菜单管理表格 -->
    <a-table :data="menuList" :loading="tableLoading" border row-key="id" class="mb-4">
      <template #columns>
        <a-table-column title="排序号" data-index="sort_order" :width="90">
          <template #cell="{ record }">
            <a-tag color="gold" size="small">{{ record.sort_order }}</a-tag>
          </template>
        </a-table-column>

        <a-table-column title="菜单名称" data-index="name" :width="160">
          <template #cell="{ record }">
            <strong>{{ record.name }}</strong>
          </template>
        </a-table-column>

        <a-table-column title="菜单唯一标识 (Key)" data-index="key" :width="160">
          <template #cell="{ record }">
            <code style="color: #C5A880;">{{ record.key }}</code>
          </template>
        </a-table-column>

        <a-table-column title="前端路由 Path" data-index="path" :width="200" />

        <a-table-column title="图标 Icon" data-index="icon" :width="150">
          <template #cell="{ record }">
            <span style="color: #86909c;">{{ record.icon || 'IconMenu' }}</span>
          </template>
        </a-table-column>

        <a-table-column title="是否启用可见" :width="130">
          <template #cell="{ record }">
            <a-switch
              :model-value="record.is_visible === 1"
              :loading="visibilityLoadingIds.has(record.id)"
              @change="(val) => toggleVisibility(record, val)"
            />
          </template>
        </a-table-column>

        <a-table-column title="操作" :width="140">
          <template #cell="{ record }">
            <div style="display: flex; flex-direction: row; align-items: center; white-space: nowrap; gap: 6px;">
              <a-button type="outline" size="small" @click="editMenu(record)">
                编辑
              </a-button>

              <a-popconfirm content="确定彻底删除此菜单项吗？" type="warning" @ok="deleteMenu(record.id)">
                <a-button type="outline" status="danger" size="small">
                  删除
                </a-button>
              </a-popconfirm>
            </div>
          </template>
        </a-table-column>
      </template>
    </a-table>

    <!-- 新建/编辑菜单 Modal -->
    <a-modal
      v-model:visible="modalVisible"
      :title="isEdit ? '编辑系统菜单' : '新建系统菜单项'"
      :ok-loading="saveLoading"
      :on-before-ok="handleModalSave"
    >
      <a-form :model="form" layout="vertical">
        <a-form-item label="菜单显示名称" required>
          <a-input v-model="form.name" placeholder="如：财务报表 / 规则引擎" />
        </a-form-item>

        <a-form-item label="菜单唯一标识 (Key)" required>
          <a-input v-model="form.key" placeholder="如：FinanceReports / RuleEngine" />
        </a-form-item>

        <a-form-item label="前端路由路径 (Path)" required>
          <a-input v-model="form.path" placeholder="如：/dashboard/finance" />
        </a-form-item>

        <a-form-item label="Arco 图标 Component 名称">
          <a-input v-model="form.icon" placeholder="如：IconDashboard / IconFile / IconSettings" />
        </a-form-item>

        <a-form-item label="菜单显示排序 (数字越小越靠前)">
          <a-input-number v-model="form.sort_order" :min="1" :max="999" placeholder="排序号" />
        </a-form-item>

        <a-form-item label="全局是否可见">
          <a-switch
            v-model="form.is_visible"
            :checked-value="1"
            :unchecked-value="0"
          >
            <template #checked>已启用</template>
            <template #unchecked>已禁用</template>
          </a-switch>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import request from '../utils/request';

const menuList = ref([]);
const tableLoading = ref(false);
const visibilityLoadingIds = ref(new Set());

const modalVisible = ref(false);
const saveLoading = ref(false);
const isEdit = ref(false);
const editId = ref('');

const form = ref({
  name: '',
  key: '',
  path: '',
  icon: 'IconMenu',
  sort_order: 10,
  is_visible: 1
});

const fetchMenus = async () => {
  tableLoading.value = true;
  try {
    const data = await request(`/api/admin/sys-menus`);
    if (data.success) {
      menuList.value = data.data || [];
    } else {
      throw new Error(data.message || `接口请求失败`);
    }
  } catch (e) {
    console.error('获取系统菜单列表失败', e);
  } finally {
    tableLoading.value = false;
  }
};

const openCreateModal = () => {
  isEdit.value = false;
  editId.value = '';
  form.value = {
    name: '',
    key: '',
    path: '',
    icon: 'IconMenu',
    sort_order: (menuList.value.length + 1) * 2,
    is_visible: 1
  };
  modalVisible.value = true;
};

const editMenu = (record) => {
  isEdit.value = true;
  editId.value = record.id;
  form.value = {
    name: record.name,
    key: record.key,
    path: record.path,
    icon: record.icon || 'IconMenu',
    sort_order: record.sort_order || 0,
    is_visible: record.is_visible !== undefined ? record.is_visible : 1
  };
  modalVisible.value = true;
};

const toggleVisibility = async (record, val) => {
  if (visibilityLoadingIds.value.has(record.id)) return;
  visibilityLoadingIds.value = new Set(visibilityLoadingIds.value).add(record.id);
  try {
    const data = await request(`/api/admin/sys-menus/${record.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...record,
        is_visible: val ? 1 : 0
      })
    });
    if (data.success) {
      Message.success('菜单状态已更新');
      await fetchMenus();
    } else {
      Message.error(data.message || `菜单状态更新失败`);
    }
  } catch (e) {
  } finally {
    const loadingIds = new Set(visibilityLoadingIds.value);
    loadingIds.delete(record.id);
    visibilityLoadingIds.value = loadingIds;
  }
};

const handleModalSave = async () => {
  if (saveLoading.value) return false;
  if (!form.value.name || !form.value.key || !form.value.path) {
    Message.warning('菜单名称、Key与Path为必填项');
    return false;
  }

  const url = isEdit.value 
    ? `/api/admin/sys-menus/${editId.value}`
    : `/api/admin/sys-menus`;
  const method = isEdit.value ? 'PUT' : 'POST';

  saveLoading.value = true;
  try {
    const data = await request(url, {
      method,
      body: JSON.stringify(form.value)
    });

    if (data.success) {
      Message.success(data.message || '保存成功');
      fetchMenus();
      return true;
    } else {
      Message.error(data.message || `保存失败`);
      return false;
    }
  } catch (e) {
    return false;
  } finally {
    saveLoading.value = false;
  }
};

const deleteMenu = async (id) => {
  try {
    const data = await request(`/api/admin/sys-menus/${id}`, { method: 'DELETE' });
    if (data.success) {
      Message.success('菜单记录已彻底删除');
      fetchMenus();
    } else {
      Message.error(data.message || '删除失败');
    }
  } catch (e) {
  }
};

onMounted(() => {
  fetchMenus();
});
</script>

<style scoped>
.header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.view-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}
</style>
