<template>
  <div class="admins-view">
    <div class="header-bar flex-between mb-4">
      <h2 class="view-title">后端管理员账号管理</h2>
      <a-button type="primary" @click="openCreateModal">
        <template #icon><icon-plus /></template>
        新建管理员账号
      </a-button>
    </div>

    <!-- 管理员账号表格 -->
    <a-table :data="adminList" :loading="tableLoading" border row-key="id" class="mb-4">
      <template #columns>
        <a-table-column title="登录账号" data-index="username" :width="160">
          <template #cell="{ record }">
            <strong>{{ record.username }}</strong>
            <a-tag v-if="record.username === 'admin'" color="gold" size="small" class="ml-2">ROOT</a-tag>
          </template>
        </a-table-column>

        <a-table-column title="管理员姓名/备注" data-index="nickname" :width="180">
          <template #cell="{ record }">
            <span>{{ record.nickname || record.username }}</span>
          </template>
        </a-table-column>

        <a-table-column title="联系电话" data-index="phone" :width="160">
          <template #cell="{ record }">
            <span style="color: #C5A880; font-weight: bold;">{{ record.phone || '暂未绑定' }}</span>
          </template>
        </a-table-column>

        <a-table-column title="所属角色权限" :width="180">
          <template #cell="{ record }">
            <a-tag :color="record.role_code === 'root' ? 'gold' : 'blue'">
              {{ record.role_name || record.role_id }}
            </a-tag>
          </template>
        </a-table-column>

        <a-table-column title="账号状态" :width="140">
          <template #cell="{ record }">
            <a-switch
              v-model="record.status"
              :checked-value="1"
              :unchecked-value="0"
              :disabled="record.username === 'admin' || record.id === 'admin_root'"
              @change="(val) => handleStatusChange(record, val)"
            >
              <template #checked>已启用</template>
              <template #unchecked>已禁用</template>
            </a-switch>
          </template>
        </a-table-column>

        <a-table-column title="创建时间" data-index="created_at" :width="180" />

        <a-table-column title="操作" :width="180">
          <template #cell="{ record }">
            <div style="display: flex; flex-direction: row; align-items: center; white-space: nowrap; gap: 6px;">
              <a-button type="outline" size="small" @click="editAdmin(record)">
                编辑资料
              </a-button>

              <a-popconfirm
                v-if="record.username !== 'admin' && record.id !== 'admin_root'"
                content="确定彻底删除此管理员账号吗？"
                type="warning"
                @ok="deleteAdmin(record.id)"
              >
                <a-button type="outline" status="danger" size="small">
                  删除
                </a-button>
              </a-popconfirm>
              <a-tag v-else color="gray" size="small">主账号保护</a-tag>
            </div>
          </template>
        </a-table-column>
      </template>
    </a-table>

    <!-- 新建/编辑管理员 Modal -->
    <a-modal v-model:visible="modalVisible" :title="isEdit ? '编辑管理员账号' : '新建后端管理员账号'" @ok="handleModalSave">
      <a-form :model="form" layout="vertical">
        <a-form-item label="登录账号" required>
          <a-input v-model="form.username" placeholder="请输入登录用户名" :disabled="isEdit" />
        </a-form-item>

        <a-form-item :label="isEdit ? '登录密码 (留空保持原密码)' : '登录密码'" :required="!isEdit">
          <a-input-password v-model="form.password" placeholder="请输入密码 (如 zhanchen)" />
        </a-form-item>

        <a-form-item label="管理员姓名/备注">
          <a-input v-model="form.nickname" placeholder="如：李经理 / 店长" />
        </a-form-item>

        <a-form-item label="联系电话">
          <a-input v-model="form.phone" placeholder="请输入手机号" />
        </a-form-item>

        <a-form-item label="分配角色权限" required>
          <a-select v-model="form.role_id" placeholder="请选择绑定的角色">
            <a-option v-for="r in roleOptions" :key="r.id" :value="r.id">
              {{ r.name }} ({{ r.code }})
            </a-option>
          </a-select>
        </a-form-item>

        <a-form-item label="账号激活状态">
          <a-switch
            v-model="form.status"
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

const API_BASE = 'https://zc-api.carelife.top';

const adminList = ref([]);
const roleOptions = ref([]);
const tableLoading = ref(false);

const modalVisible = ref(false);
const isEdit = ref(false);
const editId = ref('');

const form = ref({
  username: '',
  password: '',
  nickname: '',
  phone: '',
  role_id: '',
  status: 1
});

const fetchAdmins = async () => {
  tableLoading.value = true;
  try {
    const res = await fetch(`${API_BASE}/api/admin/users`);
    const data = await res.json();
    if (data.success) {
      adminList.value = data.data || [];
    }
  } catch (e) {
    Message.error('获取管理员列表失败');
  } finally {
    tableLoading.value = false;
  }
};

const fetchRoles = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/admin/roles`);
    const data = await res.json();
    if (data.success) {
      roleOptions.value = data.data || [];
    }
  } catch (e) {}
};

const openCreateModal = () => {
  isEdit.value = false;
  editId.value = '';
  form.value = {
    username: '',
    password: '',
    nickname: '',
    phone: '',
    role_id: roleOptions.value.length > 0 ? roleOptions.value[0].id : '',
    status: 1
  };
  modalVisible.value = true;
};

const editAdmin = (record) => {
  isEdit.value = true;
  editId.value = record.id;
  form.value = {
    username: record.username,
    password: '',
    nickname: record.nickname || '',
    phone: record.phone || '',
    role_id: record.role_id,
    status: record.status !== undefined ? record.status : 1
  };
  modalVisible.value = true;
};

const handleModalSave = async () => {
  if (!isEdit.value && (!form.value.username || !form.value.password)) {
    Message.warning('账号与密码为必填项');
    return false;
  }
  if (!form.value.role_id) {
    Message.warning('请选择绑定的角色权限');
    return false;
  }

  const url = isEdit.value 
    ? `${API_BASE}/api/admin/users/${editId.value}`
    : `${API_BASE}/api/admin/users`;
  const method = isEdit.value ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    });
    const data = await res.json();
    if (data.success) {
      Message.success(data.message || '保存成功');
      fetchAdmins();
    } else {
      Message.error(data.message || '保存失败');
    }
  } catch (e) {
    Message.error('网络请求失败');
  }
};

const handleStatusChange = async (record, val) => {
  try {
    const res = await fetch(`${API_BASE}/api/admin/users/${record.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...record, status: val })
    });
    const data = await res.json();
    if (data.success) {
      Message.success(`管理员账号状态已更新为：${val === 1 ? '已启用' : '已禁用'}`);
      fetchAdmins();
    } else {
      Message.error(data.message || '修改状态失败');
      record.status = val === 1 ? 0 : 1;
    }
  } catch (e) {
    Message.error('修改状态失败');
    record.status = val === 1 ? 0 : 1;
  }
};

const deleteAdmin = async (id) => {
  try {
    const res = await fetch(`${API_BASE}/api/admin/users/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      Message.success('管理员账号已彻底删除');
      fetchAdmins();
    } else {
      Message.error(data.message || '删除失败');
    }
  } catch (e) {
    Message.error('删除操作异常');
  }
};

onMounted(() => {
  fetchAdmins();
  fetchRoles();
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
