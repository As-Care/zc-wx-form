import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Development uses the deployed Worker/D1 by default. Set
        // VITE_API_PROXY_TARGET only when intentionally testing another API.
        target: process.env.VITE_API_PROXY_TARGET || 'https://zc-api.carelife.top',
        changeOrigin: true
      }
    }
  }
});
