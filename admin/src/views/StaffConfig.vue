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
      <a-table :data="receivers" :pagination="{ pageSize: 10 }" border>
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
              <img :src="record.qr_code_url" style="width: 60px; height: 60px; border-radius: 8px; border: 1px solid #C5A880;" />
            </template>
          </a-table-column>

          <a-table-column title="显示状态" :width="140">
            <template #cell="{ record }">
              <a-tag color="green">展示中</a-tag>
            </template>
          </a-table-column>

          <a-table-column title="操作" :width="180">
            <template #cell="{ record }">
              <a-button type="text" size="small" class="mr-2" @click="editReceiver(record)">编辑信息</a-button>
              <a-popconfirm content="确定删除此接单员吗？" type="warning" @ok="deleteReceiver(record.id)">
                <a-button type="text" status="danger" size="small">删除</a-button>
              </a-popconfirm>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <!-- 新建/编辑接单员 Modal -->
    <a-modal v-model:visible="modalVisible" title="配置接单员信息" @ok="handleSaveReceiver">
      <a-form :model="receiverForm" layout="vertical">
        <a-form-item label="接单员姓名">
          <a-input v-model="receiverForm.name" placeholder="如：张经理" />
        </a-form-item>

        <a-form-item label="联系手机号">
          <a-input v-model="receiverForm.phone" placeholder="请输入接单手机号" />
        </a-form-item>

        <a-form-item label="个人微信二维码图片 URL" help="输入二维码图片网络地址，或直接使用客服微信二维码">
          <a-input v-model="receiverForm.qr_code_url" placeholder="https://zc-oss.carelife.top/test/test-qrcode.png" />
        </a-form-item>
      </a-form>
    </a-modal>

  </div>
</template>

<script setup>
import { ref } from 'vue';
import { Message } from '@arco-design/web-vue';

const modalVisible = ref(false);

const storeForm = ref({
  name: '展晨门窗旗舰店',
  phone: '13545941637',
  address: '湖北省仙桃市恒迪建材市场2期14栋1-107'
});

const receivers = ref([
  {
    id: 'staff_1',
    name: '张经理',
    phone: '13545941637',
    qr_code_url: 'https://zc-oss.carelife.top/test/test-qrcode.png'
  },
  {
    id: 'staff_2',
    name: '李主管',
    phone: '13971234567',
    qr_code_url: 'https://zc-oss.carelife.top/test/test-qrcode.png'
  }
]);

const receiverForm = ref({
  id: '',
  name: '',
  phone: '',
  qr_code_url: ''
});

const openReceiverModal = () => {
  receiverForm.value = { id: '', name: '', phone: '', qr_code_url: 'https://zc-oss.carelife.top/test/test-qrcode.png' };
  modalVisible.value = true;
};

const editReceiver = (record) => {
  receiverForm.value = { ...record };
  modalVisible.value = true;
};

const deleteReceiver = (id) => {
  receivers.value = receivers.value.filter(r => r.id !== id);
  Message.success('接单员已移除');
};

const saveStoreConfig = () => {
  Message.success('门店地址与联系电话保存成功！');
};

const handleSaveReceiver = () => {
  if (!receiverForm.value.name || !receiverForm.value.phone) {
    Message.error('请填写接单员姓名与手机号！');
    return;
  }
  if (receiverForm.value.id) {
    const target = receivers.value.find(r => r.id === receiverForm.value.id);
    if (target) {
      target.name = receiverForm.value.name;
      target.phone = receiverForm.value.phone;
      target.qr_code_url = receiverForm.value.qr_code_url;
    }
  } else {
    receivers.value.push({
      id: `staff_${Date.now()}`,
      name: receiverForm.value.name,
      phone: receiverForm.value.phone,
      qr_code_url: receiverForm.value.qr_code_url || 'https://zc-oss.carelife.top/test/test-qrcode.png'
    });
  }
  Message.success('接单员配置保存成功！');
  modalVisible.value = false;
};
</script>

<style scoped>
.view-title { font-size: 20px; font-weight: 700; margin: 0; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.mb-4 { margin-bottom: 16px; }
.mr-2 { margin-right: 8px; }
</style>
