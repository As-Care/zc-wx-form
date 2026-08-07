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

        <a-row :gutter="24">
          <a-col :span="12">
            <a-form-item label="腾讯地图纬度 (Latitude)" extra="用于小程序精准地图定位，如: 30.3621">
              <a-input-number v-model="storeForm.latitude" placeholder="如: 30.3621" :precision="6" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="腾讯地图经度 (Longitude)" extra="用于小程序精准地图定位，如: 113.4532">
              <a-input-number v-model="storeForm.longitude" placeholder="如: 113.4532" :precision="6" />
            </a-form-item>
          </a-col>
        </a-row>

        <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
          <a-button type="primary" html-type="submit" size="medium" :loading="saving">
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

import request from '../utils/request';
const saving = ref(false);

const storeForm = ref({
  name: '展晨门窗',
  phone: '13545941637',
  address: '湖北仙桃恒迪建材市场2期14栋1-107',
  latitude: undefined,
  longitude: undefined,
  business_hours: '08:30 - 18:30 (周一至周日)'
});

const fetchStoreConfig = async () => {
  try {
    const data = await request(`/api/config/store`);
    if (data.success && data.data) {
      storeForm.value = {
        name: data.data.name || '展晨门窗',
        phone: data.data.phone || '13545941637',
        address: data.data.address || '湖北省仙桃市恒迪建材市场2期14栋1-107',
        latitude: (data.data.latitude !== undefined && data.data.latitude !== null) ? Number(data.data.latitude) : undefined,
        longitude: (data.data.longitude !== undefined && data.data.longitude !== null) ? Number(data.data.longitude) : undefined,
        business_hours: data.data.business_hours || '08:30 - 18:30 (周一至周日)'
      };
    }
  } catch (e) {}
};

const saveStoreConfig = async () => {
  saving.value = true;
  try {
    const data = await request(`/api/admin/config/store`, {
      method: 'POST',
      body: JSON.stringify(storeForm.value)
    });
    if (data.success) {
      Message.success('保存成功！');
    } else {
      Message.error(data.message || `全局设置保存失败`);
    }
  } catch (e) {
  } finally {
    saving.value = false;
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
