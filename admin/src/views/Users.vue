<template>
  <div class="users-view">
    <div class="header-bar flex-between mb-4">
      <h2 class="view-title">小程序注册客户列表</h2>
      <a-button class="btn-champagne-primary" @click="fetchUsers">
        <template #icon><icon-refresh /></template>
        刷新客户列表
      </a-button>
    </div>

    <!-- 客户数据表格 (仅展示客户，过滤管理员) -->
    <a-table :data="customerList" :loading="tableLoading" :pagination="{ pageSize: 10 }" border row-key="id">
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
            <span class="champagne-tag count-badge">
              <icon-history style="margin-right: 4px;" />
              {{ record.order_count || 0 }} 单
            </span>
          </template>
        </a-table-column>

        <a-table-column title="微信 OpenID" data-index="openid" :width="220">
          <template #cell="{ record }">
            <small style="color: #86909c;">{{ record.openid }}</small>
          </template>
        </a-table-column>

        <a-table-column title="角色身份" :width="120">
          <template #cell="{ record }">
            <span class="champagne-tag role-badge">微信客户</span>
          </template>
        </a-table-column>

        <a-table-column title="注册时间" data-index="created_at" :width="180" />

        <a-table-column title="操作" :width="230">
          <template #cell="{ record }">
            <div style="display: flex; flex-direction: row; align-items: center; white-space: nowrap; gap: 6px;">
              <a-button class="btn-champagne-outline" size="small" @click="viewCustomerDetails(record)">
                查看详情
              </a-button>
              <a-button type="outline" size="small" status="warning" @click="editUser(record)">
                修改资料
              </a-button>
              <a-popconfirm content="确定彻底删除此客户档案吗？" type="warning" @ok="deleteUser(record.id)">
                <a-button type="outline" status="danger" size="small">
                  删除
                </a-button>
              </a-popconfirm>
            </div>
          </template>
        </a-table-column>
      </template>
    </a-table>

    <!-- 客户详细档案与地址列表 Drawer 抽屉 -->
    <a-drawer v-model:visible="detailDrawerVisible" width="40vw" title="👤 客户详细档案与全部地址" unmount-on-close>
      <div v-if="selectedUser" class="user-detail-container">
        <!-- 头部个人名片 -->
        <div class="user-card-header flex-row mb-4">
          <a-avatar :size="60" style="border: 2px solid #C5A880; background: #C5A880; flex-shrink: 0;">
            <img v-if="selectedUser.avatar_url" :src="selectedUser.avatar_url" />
            <span v-else style="font-size: 22px;">{{ selectedUser.nickname ? selectedUser.nickname.charAt(0) : '客' }}</span>
          </a-avatar>
          <div class="header-info flex-column ml-3">
            <h3 class="user-detail-name">{{ selectedUser.nickname || '微信用户' }}</h3>
            <span class="user-detail-phone">📞 手机号: {{ selectedUser.phone || '暂未绑定' }}</span>
            <span class="user-detail-time">🕒 注册时间: {{ selectedUser.created_at || '最近注册' }}</span>
          </div>
        </div>

        <a-descriptions :column="1" border title="📋 基础账号档案" class="mb-4">
          <a-descriptions-item label="客户 ID">{{ selectedUser.id }}</a-descriptions-item>
          <a-descriptions-item label="微信 OpenID">{{ selectedUser.openid || '暂无记录' }}</a-descriptions-item>
          <a-descriptions-item label="角色身份">微信小程序客户 (Customer)</a-descriptions-item>
          <a-descriptions-item label="累计下单数量">{{ selectedUser.order_count || 0 }} 笔定制订单</a-descriptions-item>
        </a-descriptions>

        <!-- 关联的收货 / 安装地址列表 -->
        <a-card title="📍 已保存的收货与安装地址" :loading="addressLoading">
          <div v-if="userAddresses && userAddresses.length > 0">
            <div
              v-for="addr in userAddresses"
              :key="addr.id"
              class="address-item-box mb-3"
            >
              <div class="addr-header flex-between mb-1">
                <span class="addr-name"><strong>{{ addr.name }}</strong> ({{ addr.phone }})</span>
                <a-tag v-if="addr.is_default" color="gold" size="small">默认地址</a-tag>
              </div>
              <div class="addr-detail">
                📍 {{ addr.province || '' }}{{ addr.city || '' }}{{ addr.district || '' }} {{ addr.detail_address }}
              </div>
            </div>
          </div>
          <div v-else class="empty-address-tip flex-column flex-center">
            <icon-location style="font-size: 24px; color: #86909c;" />
            <span style="margin-top: 8px; color: #86909c; font-size: 13px;">客户暂未在小程序中提交过详细收货地址</span>
          </div>
        </a-card>
      </div>
    </a-drawer>

    <!-- 修改客户资料 Modal 弹窗 -->
    <a-modal v-model:visible="modalVisible" title="修改小程序客户个人资料" :on-before-ok="handleBeforeSaveUser">
      <a-form :model="editForm" layout="vertical">
        <!-- 客户微信头像上传 (挪至最上方) -->
        <a-form-item label="客户微信头像">
          <div class="luxury-upload-card">
            <a-spin :loading="uploading" tip="正在上传中">
              <div v-if="editForm.avatar_url" class="avatar-preview-box">
                <img :src="editForm.avatar_url" class="avatar-img" />
                <div class="avatar-hover-mask">
                  <a-upload
                    action="https://zc-api.carelife.top/api/upload"
                    :show-file-list="false"
                    @before-upload="onBeforeUpload"
                    @success="onAvatarUploadSuccess"
                    @error="onAvatarUploadError"
                    style="display: inline-block;"
                  >
                    <template #upload-button>
                      <span class="mask-icon" title="更换头像">
                        <icon-camera />
                      </span>
                    </template>
                  </a-upload>
                  <span class="mask-icon mask-icon-delete ml-2" title="删除头像" @click.stop="editForm.avatar_url = ''">
                    <icon-delete />
                  </span>
                </div>
              </div>
              <a-upload
                v-else
                action="https://zc-api.carelife.top/api/upload"
                :show-file-list="false"
                @before-upload="onBeforeUpload"
                @success="onAvatarUploadSuccess"
                @error="onAvatarUploadError"
              >
                <template #upload-button>
                  <div class="upload-dropzone">
                    <icon-plus style="font-size: 16px; color: #C5A880;" />
                    <span class="upload-title">上传头像</span>
                  </div>
                </template>
              </a-upload>
            </a-spin>
          </div>
        </a-form-item>

        <a-form-item label="客户姓名/昵称" required>
          <a-input v-model="editForm.nickname" placeholder="请输入客户姓名或备注" />
        </a-form-item>

        <a-form-item label="联系电话">
          <a-input v-model="editForm.phone" placeholder="请输入手机号" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';

const API_BASE = 'https://zc-api.carelife.top';

const DEFAULT_USERS = [
  { id: 'usr_1', nickname: 'care', phone: '13344443333', avatar_url: 'https://zc-oss.carelife.top/common/zc-logo.jpg', order_count: 4, openid: 'wx_openid_demo_care', address: '湖北仙桃恒迪建材市场2期14栋1-107-108', role: 'customer', created_at: '2026-08-05 05:30:09' },
  { id: 'usr_2', nickname: '张先生', phone: '13812345678', avatar_url: '', order_count: 1, openid: 'wx_user_13812345678', address: '湖北省仙桃市锦绣江山小区3栋201', role: 'customer', created_at: '2026-08-02 14:30:00' },
  { id: 'usr_3', nickname: '李女士', phone: '15987654321', avatar_url: '', order_count: 2, openid: 'wx_user_15987654321', address: '湖北省仙桃市碧桂园5栋1002', role: 'customer', created_at: '2026-08-03 16:20:00' }
];

const users = ref([]);
const tableLoading = ref(true);

const modalVisible = ref(false);
const detailDrawerVisible = ref(false);
const selectedUser = ref(null);
const userAddresses = ref([]);
const addressLoading = ref(false);
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
  tableLoading.value = true;
  try {
    const res = await fetch(`${API_BASE}/api/users`);
    const data = await res.json();
    if (data.success && data.data && data.data.length > 0) {
      users.value = data.data;
    } else {
      users.value = DEFAULT_USERS;
    }
  } catch (e) {
    users.value = DEFAULT_USERS;
  } finally {
    tableLoading.value = false;
  }
};

const viewCustomerDetails = async (record) => {
  selectedUser.value = record;
  detailDrawerVisible.value = true;
  addressLoading.value = true;
  userAddresses.value = [];

  try {
    const res = await fetch(`${API_BASE}/api/user/addresses?user_id=${record.id}`);
    const data = await res.json();
    if (data.success && data.data && data.data.length > 0) {
      userAddresses.value = data.data;
    } else if (record.address && record.address !== '暂无保存地址') {
      userAddresses.value = [{
        id: 'addr_default',
        name: record.nickname || '客户',
        phone: record.phone || '已绑定',
        detail_address: record.address,
        is_default: 1
      }];
    } else {
      userAddresses.value = [];
    }
  } catch (e) {
    if (record.address && record.address !== '暂无保存地址') {
      userAddresses.value = [{
        id: 'addr_default',
        name: record.nickname || '客户',
        phone: record.phone || '已绑定',
        detail_address: record.address,
        is_default: 1
      }];
    }
  } finally {
    addressLoading.value = false;
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
  Message.error('客户头像上传失败！');
};

const handleBeforeSaveUser = async () => {
  if (!editForm.value.nickname || !editForm.value.nickname.trim()) {
    Message.warning('【客户姓名/昵称】不能为空！');
    return false;
  }

  if (editForm.value.phone && editForm.value.phone.trim()) {
    const cleanPhone = editForm.value.phone.trim();
    const dup = users.value.find(u => u.id !== editForm.value.id && u.phone === cleanPhone);
    if (dup) {
      Message.warning(`【联系电话】${cleanPhone} 已被客户【${dup.nickname || '其他客户'}】绑定，不可重复！`);
      return false;
    }
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
      await fetchUsers();
      return true;
    } else {
      Message.error(data.message || `保存失败 (HTTP ${res.status})`);
      return false;
    }
  } catch (e) {
    Message.error('无法连接后端服务');
    return false;
  }
};

const deleteUser = async (id) => {
  try {
    const res = await fetch(`${API_BASE}/api/admin/users/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok && data.success) {
      Message.success('客户档案已成功删除！');
      await fetchUsers();
    } else {
      Message.error(data.message || `删除失败 (HTTP ${res.status})`);
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
.flex-row { display: flex; flex-direction: row; align-items: center; }
.flex-column { display: flex; flex-direction: column; }
.flex-center { align-items: center; justify-content: center; }
.mb-1 { margin-bottom: 4px; }
.mb-3 { margin-bottom: 12px; }
.mb-4 { margin-bottom: 16px; }
.ml-3 { margin-left: 12px; }
.mr-2 { margin-right: 8px; }

.user-card-header {
  padding: 16px;
  background: rgba(197, 168, 128, 0.08);
  border: 1px solid rgba(197, 168, 128, 0.2);
  border-radius: 12px;
}

.user-detail-name {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 4px 0;
}

.user-detail-phone {
  font-size: 13px;
  color: #C5A880;
  font-weight: 600;
}

.user-detail-time {
  font-size: 12px;
  color: #86909c;
  margin-top: 2px;
}

.address-item-box {
  padding: 12px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid #e5e6eb;
}

body[arco-theme='dark'] .address-item-box {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.12);
}

.addr-name {
  font-size: 14px;
  color: #1d2129;
}

body[arco-theme='dark'] .addr-name {
  color: #F8FAFC;
}

.addr-detail {
  font-size: 13px;
  color: #4e5969;
  line-height: 1.5;
}

body[arco-theme='dark'] .addr-detail {
  color: #CBD5E1;
}

.empty-address-tip {
  padding: 24px;
  text-align: center;
}

.upload-dropzone {
  width: 54px;
  height: 54px;
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
  font-size: 9px;
  color: #86909c;
  margin-top: 1px;
}

.avatar-preview-box {
  width: 54px;
  height: 54px;
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
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(2px);
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.avatar-preview-box:hover .avatar-hover-mask {
  opacity: 1;
}

.mask-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mask-icon:hover {
  background: rgba(255, 255, 255, 0.45);
  transform: scale(1.1);
}

.mask-icon-delete:hover {
  background: #f53f3f;
  color: #ffffff;
}

.champagne-tag {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  color: #C5A880;
  background: rgba(197, 168, 128, 0.12);
  border: 1px solid rgba(197, 168, 128, 0.35);
  padding: 2px 10px;
  border-radius: 6px;
}

.champagne-tag.count-badge {
  font-size: 13px;
  font-weight: 700;
}

.champagne-tag.role-badge {
  color: #A38458;
  background: rgba(197, 168, 128, 0.08);
  border-color: rgba(197, 168, 128, 0.25);
}

.btn-champagne-primary {
  background-color: #C5A880 !important;
  border-color: #C5A880 !important;
  color: #ffffff !important;
}

.btn-champagne-primary:hover {
  background-color: #b3956d !important;
  border-color: #b3956d !important;
}

.btn-champagne-outline {
  color: #C5A880 !important;
  border-color: #C5A880 !important;
  background: transparent !important;
}

.btn-champagne-outline:hover {
  background: rgba(197, 168, 128, 0.1) !important;
}
</style>
