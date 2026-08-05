<template>
  <a-layout class="layout-container">
    <!-- Header -->
    <a-layout-header class="layout-header glass-panel">
      <div class="header-logo">
        <img
          src="https://zc-oss.carelife.top/common/zc-logo.jpg"
          class="header-logo-img"
          alt="展晨门窗 Logo"
        />
        <span class="logo-text">展晨门窗 - 后台管理系统</span>
      </div>
      <div class="header-user">
        <!-- Theme Switch Toggle -->
        <label
          class="block custom-switch cursor-pointer outline-none border-none"
          for="theme-switch"
          style="margin-right: 20px"
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
            id="theme-switch"
            class="input absolute translate-x-[1000px] outline-none border-none"
            v-model="isDark"
            @change="toggleTheme"
          />
          <div class="slider border-none"></div>
        </label>
        <span class="username">展晨总管理 (Admin)</span>
        <a-divider direction="vertical" />
        <a-popconfirm
          content="确定要退出登录吗？"
          position="br"
          type="warning"
          @ok="handleLogout"
        >
          <a-button type="text" status="danger" class="logout-btn">
            <template #icon><IconExport /></template>
            退出登录
          </a-button>
        </a-popconfirm>
      </div>
    </a-layout-header>

    <a-layout-content class="layout-body">
      <a-layout class="layout-inner">
        <!-- Sidebar -->
        <a-layout-sider
          class="layout-sider glass-panel"
          :width="220"
          collapsible
        >
          <a-menu
            :selected-keys="[activeKey]"
            :theme="isDark ? 'dark' : 'light'"
            class="sidebar-menu"
            @menu-item-click="handleMenuClick"
          >
            <a-menu-item key="Overview">
              <template #icon><IconDashboard /></template>
              大盘数据
            </a-menu-item>
            <a-menu-item key="Categories">
              <template #icon><IconFolder /></template>
              门窗分类
            </a-menu-item>
            <a-menu-item key="Products">
              <template #icon><IconApps /></template>
              门窗商品
            </a-menu-item>
            <a-menu-item key="Orders">
              <template #icon><IconFile /></template>
              订单管理
            </a-menu-item>
            <a-menu-item key="StaffConfig">
              <template #icon><IconPhone /></template>
              接单员配置
            </a-menu-item>
            <a-menu-item key="Users">
              <template #icon><IconUserGroup /></template>
              客户管理
            </a-menu-item>
            <a-menu-item key="Settings">
              <template #icon><IconSettings /></template>
              全局设置
            </a-menu-item>
          </a-menu>
        </a-layout-sider>

        <!-- Main Workspace (含全局 Spinner 加载器) -->
        <a-layout-content class="layout-main">
          <div class="main-card glass-panel">
            <a-spin
              :loading="loading"
              tip="正在同步加载数据..."
              style="width: 100%; min-height: 100%; display: block"
            >
              <router-view />
            </a-spin>
          </div>
        </a-layout-content>
      </a-layout>
    </a-layout-content>
  </a-layout>
</template>

<script setup>
import { computed, ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Message } from "@arco-design/web-vue";
import { isPageLoading } from "../router";

const route = useRoute();
const router = useRouter();

const isDark = ref(localStorage.getItem("theme") === "dark");
const loading = computed(() => isPageLoading.value);

const activeKey = computed(() => {
  return route.name || "Overview";
});

const handleMenuClick = (key) => {
  router.push({ name: key });
};

const handleLogout = () => {
  localStorage.removeItem("admin_token");
  Message.success("成功退出登录！");
  router.push("/login");
};

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
</script>

<style scoped>
.layout-container {
  height: 100vh;
  width: 100vw;
  box-sizing: border-box;
  padding: 16px;
  background: #f4f7f6;
  gap: 16px;
  overflow: hidden;
  transition: background-color 0.3s ease;
}

.layout-header {
  height: 64px;
  line-height: 64px;
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  border-radius: 16px !important;
  background: #ffffff !important;
  border: 1px solid #e5e6eb;
}

.header-logo {
  display: flex;
  align-items: center;
  font-size: 18px;
  font-weight: 700;
  color: #1d2129;
  letter-spacing: 0.5px;
}

.header-logo-img {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  margin-right: 10px;
  object-fit: cover;
  border: 1px solid rgba(197, 168, 128, 0.3);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.header-user {
  display: flex;
  align-items: center;
}

.username {
  font-weight: 600;
  font-size: 14px;
  color: #1d2129;
}

.logout-btn {
  font-weight: 500;
  font-size: 13px;
  transition: all 0.2s ease;
}

.logout-btn:hover {
  background: rgba(238, 10, 36, 0.05);
}

.layout-body {
  flex: 1;
  min-height: 0;
}

.layout-inner {
  height: 100%;
  gap: 16px;
  background: transparent !important;
}

.layout-sider {
  border-radius: 16px !important;
  overflow: hidden !important;
  background: #ffffff !important;
  border: 1px solid #e5e6eb;
}

:deep(.arco-layout-sider-children),
:deep(.arco-menu),
:deep(.arco-menu-inner),
.sidebar-menu {
  overflow: hidden !important;
  overflow-x: hidden !important;
  overflow-y: hidden !important;
}

:deep(.arco-layout-sider-children::-webkit-scrollbar),
:deep(.arco-menu::-webkit-scrollbar),
:deep(.arco-menu-inner::-webkit-scrollbar),
.sidebar-menu::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}

.sidebar-menu {
  background: transparent !important;
  height: 100%;
  padding-top: 12px;
}

:deep(.arco-menu-inner) {
  padding: 8px;
}

/* 基础菜单项：预留透明边框，固定盒模型，防止切换选中时产生 1px 抖动 */
:deep(.arco-menu-item) {
  border-radius: 10px !important;
  margin-bottom: 6px !important;
  font-weight: 500;
  font-size: 14px;
  color: #4e5969;
  border: 1px solid transparent !important;
  box-sizing: border-box !important;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease !important;
}

/* 亮色模式选中 */
:deep(.arco-menu-selected) {
  background: #c5a880 !important;
  color: #ffffff !important;
  font-weight: 600;
  border-color: #c5a880 !important;
}

:deep(.arco-menu-selected .arco-icon),
:deep(.arco-menu-selected .arco-menu-item-inner),
:deep(.arco-menu-selected *) {
  color: #ffffff !important;
}

.layout-main {
  flex: 1;
  min-width: 0;
  height: 100%;
}

.main-card {
  height: 100%;
  box-sizing: border-box;
  padding: 24px;
  overflow-y: auto;
  background: #ffffff !important;
  border: 1px solid #e5e6eb;
}

/* 暗色模式下清爽纯净的白灰文字菜单样式 */
body[arco-theme="dark"] .layout-container {
  background: #121316 !important;
}

body[arco-theme="dark"] .layout-header {
  background: rgba(26, 29, 36, 0.9) !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
}

body[arco-theme="dark"] .header-logo {
  color: #c5a880 !important;
}

body[arco-theme="dark"] .username {
  color: #f5f5f7 !important;
}

body[arco-theme="dark"] .layout-sider {
  background: rgba(26, 29, 36, 0.9) !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
}

/* 未选中菜单项：柔和中浅灰 (#A0AEC0) */
body[arco-theme="dark"] .sidebar-menu :deep(.arco-menu-item) {
  background: transparent !important;
  color: #a0aec0 !important;
  border: 1px solid transparent !important;
}

body[arco-theme="dark"] .sidebar-menu :deep(.arco-menu-item .arco-icon),
body[arco-theme="dark"] .sidebar-menu :deep(.arco-menu-item-inner),
body[arco-theme="dark"] .sidebar-menu :deep(.arco-menu-item *) {
  color: #a0aec0 !important;
  opacity: 1 !important;
}

body[arco-theme="dark"] .sidebar-menu :deep(.arco-menu-item:hover) {
  background: rgba(255, 255, 255, 0.06) !important;
  color: #ffffff !important;
  border-color: transparent !important;
}

/* 暗色模式选中项：清透亮暗高光背景 + 纯粹白灰色文字 (#FFFFFF) */
body[arco-theme="dark"] .sidebar-menu :deep(.arco-menu-selected) {
  background: rgba(255, 255, 255, 0.12) !important;
  border-radius: 10px !important;
  border: 1px solid rgba(255, 255, 255, 0.18) !important;
}

body[arco-theme="dark"] .sidebar-menu :deep(.arco-menu-selected),
body[arco-theme="dark"]
  .sidebar-menu
  :deep(.arco-menu-selected .arco-menu-item-inner),
body[arco-theme="dark"] .sidebar-menu :deep(.arco-menu-selected .arco-icon),
body[arco-theme="dark"] .sidebar-menu :deep(.arco-menu-selected *) {
  color: #ffffff !important;
  font-weight: 700 !important;
}

body[arco-theme="dark"] .main-card {
  background: rgba(26, 29, 36, 0.95) !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
}

/* Custom theme switcher styles */
.custom-switch {
  font-size: 17px;
  position: relative;
  display: inline-block;
  width: 60px;
  height: 30px;
  --color: #3a3a3a;
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

.custom-switch .input:focus + .slider {
  box-shadow: 0 0 1px #2a2d35;
}

.custom-switch .input:checked + .slider:before {
  transform: translate(29px);
  background: #17171a;
}
</style>
