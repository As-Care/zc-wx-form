import { Message } from '@arco-design/web-vue';
import { API_BASE } from '../config';
import router from '../router';

export default async function request(url, options = {}) {
  const defaultHeaders = { Accept: 'application/json' };
  const isLoginRequest = url.endsWith('/api/admin/login') || url === '/api/admin/login';

  const token = localStorage.getItem('admin_token');
  if (token && !isLoginRequest) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }
  
  const finalOptions = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };
  if (typeof options.body === 'string' && !finalOptions.headers['Content-Type']) {
    finalOptions.headers['Content-Type'] = 'application/json';
  }

  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  
  try {
    const controller = new AbortController();
    // Default timeout 15 seconds
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 15000);
    finalOptions.signal = controller.signal;

    let response;
    try {
      response = await fetch(fullUrl, finalOptions);
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 401) {
      Message.warning('登录已失效或无权访问，请重新登录');
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      router.push('/login');
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      let message = `请求错误 (HTTP ${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData.message) message = errorData.message;
      } catch (e) {}
      throw new Error(message);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      if (!options.silent) Message.error('请求超时，请检查网络');
      throw new Error('请求超时');
    }
    // Dont show error message twice if we already handled 401
    if (error.message !== 'Unauthorized' && !options.silent) {
      Message.error(error.message || '网络连接异常');
    }
    throw error;
  }
}
