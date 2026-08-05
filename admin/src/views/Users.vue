<template>
  <div class="users-view">
    <div class="header-bar flex-between mb-4">
      <h2 class="view-title">小程序注册客户列表</h2>
      <a-button type="primary" @click="fetchUsers">
        <template #icon><icon-refresh /></template>
        刷新客户列表
      </a-button>
    </div>

    <!-- 客户数据表格 (仅展示客户，过滤管理员) -->
    <a-table :data="customerList" :pagination="{ pageSize: 10 }" border row-key="id">
      <template #columns>
        <a-table-column title="客户头像" :width="100">
          <template #cell="{ record }">
            <a-avatar :size="42" style="border: 1px solid #C5A880; background: #C5A880;">
              <img v-if="record.avatar_url" :src="record.avatar_url" />
              <span v-else>{{ record.nickname ? record.nickname.charAt(0) : '客' }}</span>
            </a-avatar>
          </template>
        </a-table-column>

        <a-table-column title="客户姓名/昵称" data-index="nickname" :width="180">
          <template #cell="{ record }">
            <strong>{{ record.nickname }}</strong>
          </template>
        </a-table-column>

        <a-table-column title="联系电话" data-index="phone" :width="160">
          <template #cell="{ record }">
            <span style="color: #C5A880; font-weight: bold;">{{ record.phone }}</span>
          </template>
        </a-table-column>

        <a-table-column title="下单数量" :width="130">
          <template #cell="{ record }">
            <a-tag color="gold" style="font-weight: 600;">
              <template #icon><icon-history /></template>
              {{ record.order_count || 0 }} 单
            </a-tag>
          </template>
        </a-table-column>

        <a-table-column title="微信 OpenID" data-index="openid" :width="200">
          <template #cell="{ record }">
            <small style="color: #86909c;">{{ record.openid }}</small>
          </template>
        </a-table-column>

        <a-table-column title="默认收货/安装地址" :width="260">
          <template #cell="{ record }">
            <div v-if="record.address && record.address !== '暂无保存地址'">
              <icon-location style="color: #C5A880; margin-right: 4px;" />
              <span>{{ record.address }}</span>
            </div>
            <span v-else style="color: #86909c;">暂无保存地址</span>
          </template>
        </a-table-column>

        <a-table-column title="角色身份" :width="120">
          <template #cell="{ record }">
            <a-tag color="blue">微信客户</a-tag>
          </template>
        </a-table-column>

        <a-table-column title="注册时间" data-index="created_at" :width="180" />

        <a-table-column title="操作" :width="160">
          <template #cell="{ record }">
            <a-button type="outline" size="small" @click="editUser(record)">
              <template #icon><icon-edit /></template>
              修改姓名/头像
            </a-button>
          </template>
        </a-table-column>
      </template>
    </a-table>

    <!-- 修改客户资料 Modal 弹窗 -->
    <a-modal v-model:visible="modalVisible" title="修改小程序客户个人资料" @ok="handleSaveUser">
      <a-form :model="editForm" layout="vertical">
        <a-form-item label="客户姓名/昵称" required>
          <a-input v-model="editForm.nickname" placeholder="请输入客户姓名或备注" />
        </a-form-item>

        <a-form-item label="联系电话">
          <a-input v-model="editForm.phone" placeholder="请输入手机号" />
        </a-form-item>

        <!-- 客户微信头像上传 (直存 Cloudflare R2) -->
        <a-form-item label="客户微信头像 (直存 Cloudflare R2)">
          <div class="luxury-upload-card">
            <a-spin :loading="uploading" tip="正在上传中">
              <a-upload
                action="https://zc-api.carelife.top/api/upload"
                :show-file-list="false"
                @before-upload="onBeforeUpload"
                @success="onAvatarUploadSuccess"
                @error="onAvatarUploadError"
              >
                <template #upload-button>
                  <div v-if="editForm.avatar_url" class="avatar-preview-box">
                    <img :src="editForm.avatar_url" class="avatar-img" />
                    <div class="avatar-hover-mask">
                      <icon-camera style="font-size: 20px; color: #ffffff;" />
                    </div>
                  </div>
                  <div v-else class="upload-dropzone">
                    <icon-plus style="font-size: 20px; color: #C5A880;" />
                    <span class="upload-title">上传头像</span>
                  </div>
                </template>
              </a-upload>
            </a-spin>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';

const API_BASE = 'https://zc-api.carelife.top';

const users = ref([]);

const modalVisible = ref(false);
const uploading = ref(false);

const editForm = ref({
  id: '',
  nickname: '',
  avatar_url: '',
  phone: ''
});

// 严格过滤掉管理员 (role !== 'admin')
const customerList = computed(() => {
  return users.value.filter(u => u.role !== 'admin');
});

const fetchUsers = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/users`);
    const data = await res.json();
    if (data.success && data.data) {
      users.value = data.data;
    } else {
      users.value = [];
    }
  } catch (e) {
    users.value = [];
  }
};

const editUser = (record) => {
  editForm.value = {
    id: record.id,
    nickname: record.nickname,
    avatar_url: record.avatar_url || '',
    phone: record.phone || ''
  };
  uploading.value = false;
  modalVisible.value = true;
};

const onBeforeUpload = () => {
  uploading.value = true;
  return true;
};

const onAvatarUploadSuccess = (fileItem) => {
  uploading.value = false;
  if (fileItem && fileItem.response && fileItem.response.url) {
    editForm.value.avatar_url = fileItem.response.url;
  } else if (fileItem && fileItem.url) {
    editForm.value.avatar_url = fileItem.url;
  }
};

const onAvatarUploadError = () => {
  uploading.value = false;
  Message.error('客户头像上传至 Cloudflare R2 失败！');
};

const handleSaveUser = async () => {
  if (!editForm.value.nickname || !editForm.value.nickname.trim()) {
    Message.warning('【客户姓名/昵称】不能为空！');
    return;
  }

  const idx = users.value.findIndex(u => u.id === editForm.value.id);
  if (idx !== -1) {
    users.value[idx] = {
      ...users.value[idx],
      nickname: editForm.value.nickname,
      avatar_url: editForm.value.avatar_url,
      phone: editForm.value.phone
    };
    users.value = [...users.value];
  }

  try {
    const res = await fetch(`${API_BASE}/api/user/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: editForm.value.id,
        nickname: editForm.value.nickname,
        avatar_url: editForm.value.avatar_url,
        phone: editForm.value.phone
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      Message.success('保存成功！');
      modalVisible.value = false;
      await fetchUsers();
    } else {
      Message.error(data.message || `保存失败 (HTTP ${res.status})`);
    }
  } catch (e) {
    Message.error('无法连接后端服务');
  }
};

onMounted(() => {
  fetchUsers();
});
</script>

<style scoped>
.users-view { display: flex; flex-direction: column; }
.view-title { font-size: 20px; font-weight: 700; margin: 0; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.mb-4 { margin-bottom: 16px; }

.upload-dropzone {
  width: 76px;
  height: 76px;
  border: 1.5px dashed rgba(197, 168, 128, 0.6);
  background: rgba(197, 168, 128, 0.04);
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.upload-title {
  font-size: 10px;
  color: #86909c;
  margin-top: 2px;
}

.avatar-preview-box {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  border: 1.5px solid #C5A880;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-hover-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.avatar-preview-box:hover .avatar-hover-mask {
  opacity: 1;
}
</style>
