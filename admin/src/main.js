import { createApp } from 'vue';
import ArcoVue from '@arco-design/web-vue';
import ArcoVueIcon from '@arco-design/web-vue/es/icon';
import '@arco-design/web-vue/dist/arco.css';
import App from './App.vue';
import router from './router';
import './style.css';

// Attach the current backend operator to every admin request so the server can
// create a consistent audit trail without repeating identity code in each page.
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{}');
  const headers = new Headers(init.headers || {});
  const method = String(init.method || (input && input.method) || 'GET').toUpperCase();
  // Read-only list/detail requests stay simple and avoid CORS preflight.
  // Audit identity is only needed for operations that mutate data.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    if (adminUser.id) headers.set('X-Admin-Id', adminUser.id);
    if (adminUser.username) headers.set('X-Admin-Username', adminUser.username);
    if (adminUser.nickname) headers.set('X-Admin-Name', adminUser.nickname);
  }
  return nativeFetch(input, { ...init, headers });
};

const app = createApp(App);
app.use(ArcoVue);
app.use(ArcoVueIcon);
app.use(router);
app.mount('#app');
