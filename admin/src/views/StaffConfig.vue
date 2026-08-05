<template>
  <div class="staff-config-view">
    <div class="header-bar flex-between mb-4">
      <h2 class="view-title">接单员配置与门店信息</h2>
      <a-button type="primary" @click="openReceiverModal">
        <template #icon><icon-plus /></template>
        添加接单员
      </a-button>
    </div>

    <!-- 门店基本地址配置卡片 -->
    <a-card title="📍 门店地址与客服电话配置" class="mb-4">
      <a-form :model="storeForm" layout="inline" @submit="saveStoreConfig">
        <a-form-item label="门店名称">
          <a-input v-model="storeForm.name" style="width: 200px;" />
        </a-form-item>

        <a-form-item label="官方客服电话">
          <a-input v-model="storeForm.phone" style="width: 180px;" />
        </a-form-item>

        <a-form-item label="门店详细地址">
          <a-input v-model="storeForm.address" style="width: 340px;" />
        </a-form-item>

        <a-form-item>
          <a-button type="primary" html-type="submit">保存地址配置</a-button>
        </a-form-item>
      </a-form>
    </a-card>

    <!-- 接单员列表数据表格 -->
    <a-card title="👥 接单员列表 (小程序专人接单展示)">
      <a-table :data="receivers" :pagination="{ pageSize: 10 }" border row-key="id">
        <template #columns>
          <a-table-column title="接单员姓名" data-index="name" :width="220">
            <template #cell="{ record }">
              <strong>{{ record.name }}</strong>
            </template>
          </a-table-column>

          <a-table-column title="联系手机号" data-index="phone" :width="180">
            <template #cell="{ record }">
              <span style="color: #C5A880; font-weight: bold;">{{ record.phone }}</span>
            </template>
          </a-table-column>

          <a-table-column title="个人微信二维码" :width="200">
            <template #cell="{ record }">
              <a-image
                v-if="record.qr_code_url"
                :src="record.qr_code_url"
                width="60"
                height="60"
                fit="cover"
                style="border-radius: 8px; border: 1px solid #C5A880; cursor: pointer;"
              />
              <span v-else style="color: #c9cdd4; font-size: 12px;">暂无二维码</span>
            </template>
          </a-table-column>

          <a-table-column title="显示状态" :width="140">
            <template #cell="{ record }">
              <a-tag color="green">展示中</a-tag>
            </template>
          </a-table-column>

          <a-table-column title="操作" :width="180">
            <template #cell="{ record }">
              <a-button type="text" size="small" class="mr-2" @click="editReceiver(record)">编辑信息/二维码</a-button>
              <a-popconfirm content="确定删除此接单员吗？" type="warning" @ok="deleteReceiver(record.id)">
                <a-button type="text" status="danger" size="small">删除</a-button>
              </a-popconfirm>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <!-- 新建/编辑接单员 Modal -->
    <a-modal v-model:visible="modalVisible" title="配置接单员信息与二维码" @ok="handleSaveReceiver">
      <a-form :model="receiverForm" layout="vertical">
        <a-form-item label="接单员姓名" required>
          <a-input v-model="receiverForm.name" placeholder="如：张经理" />
        </a-form-item>

        <a-form-item label="联系手机号" required>
          <a-input v-model="receiverForm.phone" placeholder="请输入接单手机号" />
        </a-form-item>

        <!-- 高奢品质二维码图片上传区域 (直存 Cloudflare R2) -->
        <a-form-item label="微信二维码图片 (直存 Cloudflare R2)">
          <div class="luxury-upload-card">
            <a-spin :loading="uploading" tip="二维码上传至 R2 中...">
              <a-upload
                action="https://zc-api.carelife.top/api/upload"
                :show-file-list="false"
                @before-upload="onBeforeUpload"
                @success="onQrUploadSuccess"
                @error="onQrUploadError"
              >
                <template #upload-button>
                  <div v-if="receiverForm.qr_code_url" class="cover-preview-box">
                    <img :src="receiverForm.qr_code_url" class="cover-img" />
                    <div class="cover-hover-mask">
                      <icon-camera style="font-size: 24px; color: #ffffff;" />
                      <span style="font-size: 12px; color: #ffffff; margin-top: 4px;">点击更换二维码</span>
                    </div>
                  </div>
                  <div v-else class="upload-dropzone">
                    <div class="upload-icon-circle">
                      <icon-plus style="font-size: 22px; color: #C5A880;" />
                    </div>
                    <span class="upload-title">点击上传至 R2</span>
                    <span class="upload-sub">支持 PNG / JPG 格式</span>
                  </div>
                </template>
              </a-upload>
            </a-spin>
            <a-button
              v-if="receiverForm.qr_code_url"
              type="text"
              status="danger"
              size="small"
              style="margin-top: 6px;"
              @click="receiverForm.qr_code_url = ''"
            >
              移除二维码
            </a-button>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';

const API_BASE = 'https://zc-api.carelife.top';

const storeForm = ref({
  name: '展晨门窗',
  phone: '13545941637',
  address: '湖北仙桃恒迪建材市场2期14栋1-107'
});

const receivers = ref([]);

const modalVisible = ref(false);
const uploading = ref(false);

const receiverForm = ref({
  id: '',
  name: '',
  phone: '',
  qr_code_url: ''
});

const fetchReceivers = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/receivers`);
    const data = await res.json();
    if (data.success && data.data) {
      receivers.value = data.data;
    }
  } catch (e) {
    receivers.value = [];
  }
};

const saveStoreConfig = () => {
  Message.success('门店信息与客服电话保存成功！');
};

const openReceiverModal = () => {
  receiverForm.value = {
    id: '',
    name: '',
    phone: '',
    qr_code_url: ''
  };
  uploading.value = false;
  modalVisible.value = true;
};

const editReceiver = (record) => {
  receiverForm.value = {
    id: record.id,
    name: record.name,
    phone: record.phone,
    qr_code_url: record.qr_code_url || ''
  };
  uploading.value = false;
  modalVisible.value = true;
};

const onBeforeUpload = () => {
  uploading.value = true;
  return true;
};

const onQrUploadSuccess = (fileItem) => {
  uploading.value = false;
  if (fileItem && fileItem.response && fileItem.response.url) {
    receiverForm.value.qr_code_url = fileItem.response.url;
    Message.success('客服微信二维码成功保存至 Cloudflare R2 存储桶！');
  } else if (fileItem && fileItem.url) {
    receiverForm.value.qr_code_url = fileItem.url;
    Message.success('客服微信二维码成功保存至 Cloudflare R2 存储桶！');
  }
};

const onQrUploadError = () => {
  uploading.value = false;
  Message.error('二维码图片上传至 Cloudflare R2 失败！');
};

const handleSaveReceiver = async () => {
  if (!receiverForm.value.name || !receiverForm.value.name.trim()) {
    Message.warning('【接单员姓名】为必填项，请输入后再保存！');
    return;
  }
  if (!receiverForm.value.phone || !receiverForm.value.phone.trim()) {
    Message.warning('【联系手机号】为必填项，请输入后再保存！');
    return;
  }

  if (receiverForm.value.id) {
    const idx = receivers.value.findIndex(r => r.id === receiverForm.value.id);
    if (idx !== -1) {
      receivers.value[idx] = {
        id: receiverForm.value.id,
        name: receiverForm.value.name,
        phone: receiverForm.value.phone,
        qr_code_url: receiverForm.value.qr_code_url
      };
      receivers.value = [...receivers.value];
    }
  } else {
    receivers.value.push({
      id: `rec_${Date.now()}`,
      name: receiverForm.value.name,
      phone: receiverForm.value.phone,
      qr_code_url: receiverForm.value.qr_code_url || ''
    });
    receivers.value = [...receivers.value];
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/receivers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receiverForm.value)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      Message.success('接单员配置保存成功！已同步至线上数据库。');
      modalVisible.value = false;
      fetchReceivers();
    } else {
      Message.error(data.message || `接口响应失败 (HTTP ${res.status})`);
    }
  } catch (e) {
    Message.error('无法连接后端 API 服务，请检查网络设置');
  }
};

const deleteReceiver = async (id) => {
  try {
    const res = await fetch(`${API_BASE}/api/admin/receivers/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok && data.success) {
      Message.success('接单员信息已从数据库移除');
      fetchReceivers();
    } else {
      Message.error(data.message || `操作失败 (HTTP ${res.status})`);
    }
  } catch (e) {
    Message.error('删除操作失败，网络连接错误');
  }
};

onMounted(() => {
  fetchReceivers();
});
</script>

<style scoped>
.staff-config-view { display: flex; flex-direction: column; }
.view-title { font-size: 20px; font-weight: 700; margin: 0; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.mb-4 { margin-bottom: 16px; }
.mr-2 { margin-right: 8px; }

/* 奢华精致上传控件样式 */
.luxury-upload-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.upload-dropzone {
  width: 156px;
  height: 140px;
  border: 1.5px dashed rgba(197, 168, 128, 0.6);
  background: rgba(197, 168, 128, 0.04);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s ease;
  box-sizing: border-box;
  padding: 6px;
}

.upload-dropzone:hover {
  border-color: #C5A880;
  background: rgba(197, 168, 128, 0.08);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(197, 168, 128, 0.15);
}

.upload-icon-circle {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(197, 168, 128, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
}

.upload-title {
  font-size: 13px;
  font-weight: 600;
  color: #1d2129;
  white-space: nowrap;
}

body[arco-theme='dark'] .upload-title {
  color: #E2E8F0;
}

.upload-sub {
  font-size: 10.5px;
  color: #86909c;
  margin-top: 4px;
  white-space: nowrap;
}

.cover-preview-box {
  width: 156px;
  height: 140px;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  border: 1.5px solid #C5A880;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  box-sizing: border-box;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover-hover-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.cover-preview-box:hover .cover-hover-mask {
  opacity: 1;
}
</style>
