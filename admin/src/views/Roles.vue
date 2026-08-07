<template>
  <div class="roles-view">
    <div class="header-bar flex-between mb-4">
      <h2 class="view-title">角色与权限管理</h2>
      <a-button type="primary" @click="openCreateModal">
        <template #icon><icon-plus /></template>
        新建角色
      </a-button>
    </div>

    <!-- 角色列表表格 -->
    <a-table
      :data="roleList"
      :loading="tableLoading"
      border
      row-key="id"
      class="mb-4"
    >
      <template #columns>
        <a-table-column title="角色名称" data-index="name" :width="180">
          <template #cell="{ record }">
            <strong>{{ record.name }}</strong>
            <a-tag v-if="record.code === 'root'" color="gold" size="small"
              >SUPER ROOT</a-tag
            >
          </template>
        </a-table-column>

        <a-table-column title="角色标识 (Code)" data-index="code" :width="160">
          <template #cell="{ record }">
            <code style="color: #c5a880">{{ record.code }}</code>
          </template>
        </a-table-column>

        <a-table-column title="角色说明/职责描述" data-index="description" />

        <a-table-column title="已授权菜单数量" :width="160">
          <template #cell="{ record }">
            <a-tag color="blue">
              <template #icon><icon-menu /></template>
              {{ record.menu_keys ? record.menu_keys.length : 0 }} 项菜单
            </a-tag>
          </template>
        </a-table-column>

        <a-table-column title="创建时间" data-index="created_at" :width="180" />

        <a-table-column title="操作" :width="220">
          <template #cell="{ record }">
            <div
              style="
                display: flex;
                flex-direction: row;
                align-items: center;
                white-space: nowrap;
                gap: 6px;
              "
            >
              <a-button
                type="outline"
                size="small"
                @click="editRolePermission(record)"
              >
                <template #icon><icon-safe /></template>
                分配菜单权限
              </a-button>

              <a-popconfirm
                v-if="record.code !== 'root'"
                content="确定彻底删除此角色吗？绑定的管理员将失去该角色"
                type="warning"
                @ok="deleteRole(record.id)"
              >
                <a-button type="outline" status="danger" size="small">
                  删除
                </a-button>
              </a-popconfirm>
              <a-tag v-else color="gray" size="small">Root主角色</a-tag>
            </div>
          </template>
        </a-table-column>
      </template>
    </a-table>

    <!-- 角色与权限分配 Drawer 抽屉 (加宽至 640px，强效单行防换行) -->
    <a-drawer
      v-model:visible="drawerVisible"
      width="640px"
      :title="isEdit ? '编辑角色与菜单授权' : '新建角色并分配权限'"
      unmount-on-close
      @ok="handleSaveRole"
    >
      <a-form :model="form" layout="vertical">
        <a-form-item label="角色名称" required>
          <a-input
            v-model="form.name"
            placeholder="如：店长经理 / 客服接单员"
          />
        </a-form-item>

        <a-form-item label="角色唯一标识 (Code)" required>
          <a-input
            v-model="form.code"
            placeholder="如：manager / clerk"
            :disabled="isEdit && form.code === 'root'"
          />
        </a-form-item>

        <a-form-item label="角色说明描述">
          <a-textarea
            v-model="form.description"
            placeholder="请输入该角色的管理范围与职责说明"
            row="2"
          />
        </a-form-item>

        <a-divider>勾选授权可见菜单 (后台侧边栏)</a-divider>

        <div
          style="
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            white-space: nowrap;
          "
        >
          <span style="font-size: 13px; color: #86909c"
            >按需勾选给该角色开放的后台导航菜单：</span
          >
          <a-space size="small">
            <a-button size="mini" type="text" @click="selectAllMenus"
              >全选</a-button
            >
            <a-button
              size="mini"
              type="text"
              status="danger"
              @click="clearAllMenus"
              :disabled="form.code === 'root'"
              >清空</a-button
            >
          </a-space>
        </div>

        <div class="menu-checkbox-container">
          <a-checkbox-group
            v-model="form.menu_keys"
            direction="vertical"
            style="width: 100%"
          >
            <div
              v-for="menu in allSysMenus"
              :key="menu.key"
              class="menu-item-row"
            >
              <a-checkbox
                :value="menu.key"
                :disabled="form.code === 'root'"
                style="white-space: nowrap"
              >
                <div
                  style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    white-space: nowrap;
                  "
                >
                  <strong style="white-space: nowrap">{{ menu.name }}</strong>
                  <code
                    style="color: #86909c; font-size: 12px; white-space: nowrap"
                    >({{ menu.key }})</code
                  >
                </div>
              </a-checkbox>
              <span
                style="
                  color: #c5a880;
                  font-size: 12px;
                  font-family: monospace;
                  white-space: nowrap;
                "
                >{{ menu.path }}</span
              >
            </div>
          </a-checkbox-group>
        </div>
      </a-form>
    </a-drawer>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { Message } from "@arco-design/web-vue";

import request from "../utils/request";

const roleList = ref([]);
const allSysMenus = ref([]);
const tableLoading = ref(false);

const drawerVisible = ref(false);
const isEdit = ref(false);
const editId = ref("");

const form = ref({
  name: "",
  code: "",
  description: "",
  menu_keys: [],
});

const fetchRoles = async () => {
  tableLoading.value = true;
  try {
    const data = await request(`/api/admin/roles`);
    if (data.success) {
      roleList.value = data.data || [];
    }
  } catch (e) {
    Message.error("获取角色列表失败");
  } finally {
    tableLoading.value = false;
  }
};

const fetchSysMenus = async () => {
  try {
    const data = await request(`/api/admin/sys-menus`);
    if (data.success) {
      allSysMenus.value = data.data || [];
    }
  } catch (e) {}
};

const openCreateModal = () => {
  isEdit.value = false;
  editId.value = "";
  form.value = {
    name: "",
    code: "",
    description: "",
    menu_keys: allSysMenus.value.map((m) => m.key),
  };
  drawerVisible.value = true;
};

const editRolePermission = (record) => {
  isEdit.value = true;
  editId.value = record.id;
  form.value = {
    name: record.name,
    code: record.code,
    description: record.description || "",
    menu_keys: Array.isArray(record.menu_keys) ? [...record.menu_keys] : [],
  };
  drawerVisible.value = true;
};

const selectAllMenus = () => {
  form.value.menu_keys = allSysMenus.value.map((m) => m.key);
};

const clearAllMenus = () => {
  if (form.value.code === "root") return;
  form.value.menu_keys = [];
};

const handleSaveRole = async () => {
  if (!form.value.name || !form.value.code) {
    Message.warning("角色名称与标识为必填项");
    return false;
  }

  const url = isEdit.value
    ? `/api/admin/roles/${editId.value}`
    : `/api/admin/roles`;
  const method = isEdit.value ? "PUT" : "POST";

  try {
    const data = await request(url, {
      method,
      body: JSON.stringify(form.value),
    });
    if (data.success) {
      Message.success(data.message || "角色权限保存成功");
      fetchRoles();
    } else {
      Message.error(data.message || "保存失败");
    }
  } catch (e) {
    Message.error("网络请求失败");
  }
};

const deleteRole = async (id) => {
  try {
    const data = await request(`/api/admin/roles/${id}`, { method: "DELETE" });
    if (data.success) {
      Message.success("角色记录已彻底删除");
      fetchRoles();
    } else {
      Message.error(data.message || "删除失败");
    }
  } catch (e) {
    Message.error("删除操作异常");
  }
};

onMounted(() => {
  fetchRoles();
  fetchSysMenus();
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
.menu-checkbox-container {
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  padding: 12px;
  background: #fafafa;
  max-height: 380px;
  overflow-y: auto;
}
.menu-item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 6px;
  border-bottom: 1px dashed #e5e6eb;
  white-space: nowrap !important;
}
.menu-item-row:last-child {
  border-bottom: none;
}
:deep(.arco-checkbox-label) {
  white-space: nowrap !important;
}
</style>
