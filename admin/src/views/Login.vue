<template>
  <div class="login-container flex-center">
    <div class="login-box glass-panel">
      <div class="login-header">
        <div class="logo-box">ZC</div>
        <h2>展晨门窗 - 商家后台管理系统</h2>
        <p class="sub-title">ZHANCHEN MENYE ADMIN SYSTEM</p>
      </div>

      <a-form :model="form" class="login-form" @submit="handleLogin">
        <a-form-item field="username" label="管理员账号">
          <a-input v-model="form.username" placeholder="默认账号: admin">
            <template #prefix><icon-user /></template>
          </a-input>
        </a-form-item>

        <a-form-item field="password" label="管理员密码">
          <a-input-password v-model="form.password" placeholder="默认密码: zhanchen888">
            <template #prefix><icon-lock /></template>
          </a-input-password>
        </a-form-item>

        <a-button type="primary" html-type="submit" class="w-full submit-btn" :loading="loading">
          登录系统
        </a-button>
      </a-form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Message } from '@arco-design/web-vue';

const router = useRouter();
const loading = ref(false);

const form = ref({
  username: 'admin',
  password: 'zhanchen888'
});

const handleLogin = () => {
  loading.value = true;
  setTimeout(() => {
    loading.value = false;
    localStorage.setItem('admin_token', 'zhanchen_demo_token');
    Message.success('欢迎登录展晨门窗后台管理系统！');
    router.push('/dashboard/overview');
  }, 600);
};
</script>

<style scoped>
.login-container {
  height: 100vh;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 10% 20%, rgba(15, 23, 42, 0.95) 0.1%, rgba(30, 41, 59, 0.98) 90.1%);
}

.login-box {
  width: 420px;
  padding: 40px;
  border-radius: 20px;
  background: rgba(30, 41, 59, 0.8) !important;
  border: 1px solid rgba(197, 168, 128, 0.3) !important;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.logo-box {
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  background: rgba(197, 168, 128, 0.2);
  border: 2px solid #C5A880;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 900;
  color: #C5A880;
}

.login-header h2 {
  font-size: 20px;
  font-weight: 700;
  color: #F8FAFC;
  margin: 0;
}

.sub-title {
  font-size: 11px;
  color: #C5A880;
  margin-top: 4px;
  letter-spacing: 1px;
}

.w-full {
  width: 100%;
}

.submit-btn {
  background: linear-gradient(135deg, #D4AF37 0%, #C5A880 100%) !important;
  color: #0F172A !important;
  font-weight: 700 !important;
  height: 40px;
  border-radius: 20px !important;
}
</style>
