<template>
  <a-modal :visible="visible" @update:visible="val => emit('update:visible', val)" title="展晨门窗 - 订单状态与特殊费用修改" :ok-loading="saving" :on-before-ok="handleBeforeSaveOrder">
    <a-form :model="editForm" layout="vertical">
      <a-form-item label="订单编号">
        <a-input v-model="editForm.order_no" readonly />
      </a-form-item>

      <a-form-item label="一键扭转订单状态">
        <a-select v-model="editForm.status">
          <a-option value="pending_review">待复核</a-option>
          <a-option value="producing">生产中</a-option>
          <a-option value="installing">待提货</a-option>
          <a-option value="completed">已完成</a-option>
          <a-option value="cancelled">已取消</a-option>
        </a-select>
      </a-form-item>

      <a-form-item label="商家补充特殊费用 (元)">
        <a-input-number v-model="editForm.special_charges_amount" placeholder="如高楼吊装费500元、旧窗拆除费300元" />
      </a-form-item>

      <a-form-item label="商家订单备注">
        <a-textarea v-model="editForm.admin_remark" placeholder="填写订单备注、现场测量或客户特殊要求说明" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup>
import { ref, watch, defineProps, defineEmits } from 'vue';
import { Message } from '@arco-design/web-vue';
import request from '../utils/request';

const props = defineProps({
  visible: { type: Boolean, default: false },
  orderRecord: { type: Object, default: () => null }
});

const emit = defineEmits(['update:visible', 'refresh']);

const saving = ref(false);

const editForm = ref({
  id: '',
  order_no: '',
  status: 'pending_review',
  special_charges_amount: 0,
  admin_remark: ''
});

watch(() => props.orderRecord, (newVal) => {
  if (newVal) {
    editForm.value = {
      id: newVal.id,
      order_no: newVal.order_no,
      status: newVal.status,
      special_charges_amount: newVal.special_charges_amount || 0,
      admin_remark: newVal.admin_remark || ''
    };
  }
}, { immediate: true });

const handleBeforeSaveOrder = async () => {
  if (saving.value) return false;
  saving.value = true;
  try {
    const data = await request(`/api/admin/orders/${editForm.value.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        new_status: editForm.value.status,
        special_charges_amount: editForm.value.special_charges_amount,
        admin_remark: editForm.value.admin_remark
      }),
      silent: true
    });
    if (data.success) {
      Message.success('保存成功！');
      emit('refresh');
      return true;
    } else {
      Message.error(data.message || '订单状态修改失败');
      return false;
    }
  } catch (e) {
    Message.error(e?.message || '无法连接后端服务，更新失败');
    return false;
  } finally {
    saving.value = false;
  }
};
</script>
