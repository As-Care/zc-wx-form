<template>
  <div class="settings-view">
    <div class="header-bar flex-between mb-4">
      <h2 class="view-title">全局设置与门店信息配置</h2>
    </div>

    <!-- 门店基本地址与客服电话配置卡片 (双列栅格布局) -->
    <a-card title="📍 门店地址与客服电话配置" class="mb-4">
      <a-form :model="storeForm" layout="vertical" @submit="saveStoreConfig">
        <a-row :gutter="24">
          <a-col :span="12">
            <a-form-item label="门店名称" required>
              <a-input v-model="storeForm.name" placeholder="如: 展晨门窗" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="官方客服电话" required>
              <a-input v-model="storeForm.phone" placeholder="如: 13545941637" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="24">
          <a-col :span="12">
            <a-form-item label="门店详细地址" required>
              <a-input v-model="storeForm.address" placeholder="如: 湖北仙桃恒迪建材市场2期14栋1-107" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="营业时间">
              <a-input v-model="storeForm.business_hours" placeholder="如: 08:30 - 18:30 (周一至周日)" />
            </a-form-item>
          </a-col>
        </a-row>

        <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
          <a-button type="primary" html-type="submit" size="medium">
            <template #icon><icon-save /></template>
            保存全局配置
          </a-button>
        </div>
      </a-form>
    </a-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';

const API_BASE = 'https://zc-api.carelife.top';

const storeForm = ref({
  name: '展晨门窗',
  phone: '13545941637',
  address: '湖北仙桃恒迪建材市场2期14栋1-107',
  business_hours: '08:30 - 18:30 (周一至周日)'
});

const fetchStoreConfig = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/config/store`);
    const data = await res.json();
    if (data.success && data.data) {
      storeForm.value = {
        name: data.data.name || '展晨门窗',
        phone: data.data.phone || '13545941637',
        address: data.data.address || '湖北省仙桃市恒迪建材市场2期14栋1-107',
        business_hours: data.data.business_hours || '08:30 - 18:30 (周一至周日)'
      };
    }
  } catch (e) {}
};

const saveStoreConfig = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/admin/config/store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(storeForm.value)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      Message.success('保存成功！');
    } else {
      Message.error(data.message || `全局设置保存失败 (HTTP ${res.status})`);
    }
  } catch (e) {
    Message.error('无法连接后端服务，请检查网络！');
  }
};

onMounted(() => {
  fetchStoreConfig();
});
</script>

<style scoped>
.settings-view { display: flex; flex-direction: column; }
.view-title { font-size: 20px; font-weight: 700; margin: 0; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.mb-4 { margin-bottom: 16px; }
</style>
