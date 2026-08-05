<template>
  <div class="users-view">
    <div class="header-bar flex-between mb-4">
      <h2 class="view-title">小程序注册客户列表</h2>
    </div>

    <!-- 客户数据表格 -->
    <a-table :data="users" :pagination="{ pageSize: 10 }" border>
      <template #columns>
        <a-table-column title="客户 ID" data-index="id" :width="160" />
        <a-table-column title="微信 OpenID" data-index="openid" :width="220">
          <template #cell="{ record }">
            <small style="color: #86909c;">{{ record.openid }}</small>
          </template>
        </a-table-column>
        <a-table-column title="昵称/备注" data-index="nickname" :width="180">
          <template #cell="{ record }">
            <strong>{{ record.nickname }}</strong>
          </template>
        </a-table-column>
        <a-table-column title="联系电话" data-index="phone" :width="160" />
        <a-table-column title="角色" data-index="role" :width="140">
          <template #cell="{ record }">
            <a-tag :color="record.role === 'admin' ? 'red' : 'blue'">
              {{ record.role === 'admin' ? '系统管理员' : '微信客户' }}
            </a-tag>
          </template>
        </a-table-column>
        <a-table-column title="注册时间" data-index="created_at" :width="180" />
      </template>
    </a-table>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const users = ref([
  { id: 'user_admin_1', openid: 'admin_openid_zc', nickname: '展晨总管理', phone: '13545941637', role: 'admin', created_at: '2026-08-01 10:00' },
  { id: 'user_customer_demo', openid: 'wx_openid_demo1', nickname: '张先生', phone: '13800138000', role: 'customer', created_at: '2026-08-04 15:30' },
  { id: 'user_customer_2', openid: 'wx_openid_demo2', nickname: '李女士', phone: '13971234567', role: 'customer', created_at: '2026-08-04 16:10' }
]);
</script>

<style scoped>
.view-title { font-size: 20px; font-weight: 700; margin: 0; }
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.mb-4 { margin-bottom: 16px; }
</style>
