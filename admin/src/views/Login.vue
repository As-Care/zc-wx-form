<template>
  <div class="login-container flex-center">
    <!-- 浅色/暗色模式切换 Toggle -->
    <div class="theme-switch-wrapper">
      <label
        class="block custom-switch cursor-pointer outline-none border-none"
        for="login-theme-switch"
      >
        <div class="moon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style="width: 20px; height: 20px; color: #a0aec0; border: none"
          >
            <path
              d="M21 13.9066C19.805 14.6253 18.4055 15.0386 16.9095 15.0386C12.5198 15.0386 8.9612 11.4801 8.9612 7.09034C8.9612 5.59439 9.37447 4.19496 10.0931 3C6.03221 3.91866 3 7.5491 3 11.8878C3 16.9203 7.07968 21 12.1122 21C16.451 21 20.0815 17.9676 21 13.9066Z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></path>
          </svg>
        </div>
        <div class="sun">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style="width: 19px; height: 19px; color: #ffb703; border: none"
          >
            <path
              d="M12 23V22M4.22183 19.7782L4.92893 19.0711M1 12H2M4.22183 4.22183L4.92893 4.92893M12 2V1M19.0711 4.92893L19.7782 4.22183M22 12H23M19.0711 19.0711L19.7782 19.7782M18 12C18 15.3137 15.3137 18 12 18C8.68629 18 6 15.3137 6 12C6 8.68629 8.68629 6 12 6C15.3137 6 18 8.68629 18 12Z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></path>
          </svg>
        </div>
        <input
          type="checkbox"
          id="login-theme-switch"
          class="input absolute translate-x-[1000px] outline-none border-none"
          v-model="isDark"
          @change="toggleTheme"
        />
        <div class="slider border-none"></div>
      </label>
    </div>

    <div class="login-box glass-panel">
      <div class="login-header">
        <img
          src="https://zc-oss.carelife.top/common/zc-logo.jpg"
          class="logo-img"
          alt="展晨门窗 Logo"
        />
        <h2>展晨门窗 - 后台管理系统</h2>
        <p class="sub-title">ZHANCHEN MENYE ADMIN SYSTEM</p>
      </div>

      <a-form :model="form" class="login-form" @submit="handleLogin">
        <a-form-item field="username" label="管理员账号">
          <a-input v-model="form.username" placeholder="默认账号: admin">
            <template #prefix><icon-user /></template>
          </a-input>
        </a-form-item>

        <a-form-item field="password" label="管理员密码">
          <a-input-password
            v-model="form.password"
            placeholder="默认密码: zhanchen888"
          >
            <template #prefix><icon-lock /></template>
          </a-input-password>
        </a-form-item>

        <a-button
          type="primary"
          html-type="submit"
          class="w-full submit-btn"
          :loading="loading"
        >
          登录系统
        </a-button>
      </a-form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { Message } from "@arco-design/web-vue";

const router = useRouter();
const loading = ref(false);
const isDark = ref(localStorage.getItem("theme") === "dark");

const form = ref({
  username: "admin",
  password: "zhanchen888",
});

const toggleTheme = () => {
  if (isDark.value) {
    document.body.setAttribute("arco-theme", "dark");
    localStorage.setItem("theme", "dark");
  } else {
    document.body.removeAttribute("arco-theme");
    localStorage.setItem("theme", "light");
  }
};

onMounted(() => {
  if (isDark.value) {
    document.body.setAttribute("arco-theme", "dark");
  } else {
    document.body.removeAttribute("arco-theme");
  }
});

const handleLogin = () => {
  loading.value = true;
  setTimeout(() => {
    loading.value = false;
    localStorage.setItem("admin_token", "zhanchen_demo_token");
    Message.success("欢迎登录展晨门窗后台管理系统！");
    router.push("/dashboard/overview");
  }, 600);
};
</script>

<style scoped>
.theme-switch-wrapper {
  position: absolute;
  top: 24px;
  right: 24px;
  z-index: 10;
}

.login-container {
  height: 100vh;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: #f4f7f6;
  transition: background-color 0.3s ease;
}

.login-box {
  width: 420px;
  padding: 40px;
  border-radius: 20px;
  background: #ffffff !important;
  border: 1px solid #e5e6eb !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.logo-img {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  border-radius: 16px;
  display: block;
  object-fit: cover;
  border: 2px solid #c5a880;
  box-shadow: 0 4px 12px rgba(197, 168, 128, 0.3);
}

.login-header h2 {
  font-size: 20px;
  font-weight: 700;
  color: #1d2129;
  margin: 0;
}

:deep(.arco-form-item-label),
:deep(.arco-form-item-label-col),
:deep(.arco-form-item-label-col > label),
:deep(.arco-form-item-label *) {
  color: #1d2129 !important;
}

.sub-title {
  font-size: 11px;
  color: #c5a880;
  margin-top: 4px;
  letter-spacing: 1px;
}

.w-full {
  width: 100%;
}

.submit-btn {
  background: linear-gradient(135deg, #d4af37 0%, #c5a880 100%) !important;
  color: #0f172a !important;
  font-weight: 700 !important;
  height: 40px;
  border-radius: 20px !important;
}

/* 暗色模式 Overrides */
body[arco-theme="dark"] .login-container {
  background: radial-gradient(
    circle at 10% 20%,
    rgba(15, 23, 42, 0.95) 0.1%,
    rgba(30, 41, 59, 0.98) 90.1%
  ) !important;
}

body[arco-theme="dark"] .login-box {
  background: rgba(30, 41, 59, 0.85) !important;
  border: 1px solid rgba(197, 168, 128, 0.3) !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}

body[arco-theme="dark"] .login-header h2 {
  color: #f8fafc !important;
}

body[arco-theme="dark"] :deep(.arco-form-item-label),
body[arco-theme="dark"] :deep(.arco-form-item-label-col),
body[arco-theme="dark"] :deep(.arco-form-item-label-col > label),
body[arco-theme="dark"] :deep(.arco-form-item-label-col *),
body[arco-theme="dark"] .login-box :deep(label) {
  color: #ffffff !important;
  font-weight: 500;
}

/* Custom switch styles */
.custom-switch {
  font-size: 17px;
  position: relative;
  display: inline-block;
  width: 60px;
  height: 30px;
}

.custom-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.custom-switch .slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #e5e6eb;
  transition: 0.4s;
  border-radius: 300px;
}

.custom-switch .slider:before {
  position: absolute;
  content: "";
  height: 24px;
  width: 24px;
  border-radius: 20px;
  left: 3px;
  bottom: 3px;
  z-index: 2;
  background-color: #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  transition: 0.4s;
}

.custom-switch .sun svg {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 1;
}

.custom-switch .moon svg {
  position: absolute;
  top: 5px;
  left: 5px;
  z-index: 1;
}

.custom-switch .input:checked + .slider {
  background-color: #2a2d35;
}

.custom-switch .input:checked + .slider:before {
  transform: translate(29px);
  background: #17171a;
}
</style>
