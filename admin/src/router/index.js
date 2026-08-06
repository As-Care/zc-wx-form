import { createRouter, createWebHistory } from 'vue-router';
import { ref } from 'vue';
import Login from '../views/Login.vue';
import Dashboard from '../views/Dashboard.vue';
import Orders from '../views/Orders.vue';
import Products from '../views/Products.vue';
import Categories from '../views/Categories.vue';
import Users from '../views/Users.vue';
import Overview from '../views/Overview.vue';
import StaffConfig from '../views/StaffConfig.vue';
import Settings from '../views/Settings.vue';
import Rooms from '../views/Rooms.vue';
import Admins from '../views/Admins.vue';
import Roles from '../views/Roles.vue';
import Menus from '../views/Menus.vue';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresGuest: true }
  },
  {
    path: '/dashboard',
    component: Dashboard,
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/dashboard/overview'
      },
      {
        path: 'overview',
        name: 'Overview',
        component: Overview
      },
      {
        path: 'orders',
        name: 'Orders',
        component: Orders
      },
      {
        path: 'products',
        name: 'Products',
        component: Products
      },
      {
        path: 'categories',
        name: 'Categories',
        component: Categories
      },
      {
        path: 'rooms',
        name: 'Rooms',
        component: Rooms
      },
      {
        path: 'users',
        name: 'Users',
        component: Users
      },
      {
        path: 'staff',
        name: 'StaffConfig',
        component: StaffConfig
      },
      {
        path: 'admins',
        name: 'Admins',
        component: Admins
      },
      {
        path: 'roles',
        name: 'Roles',
        component: Roles
      },
      {
        path: 'menus',
        name: 'Menus',
        component: Menus
      },
      {
        path: 'settings',
        name: 'Settings',
        component: Settings
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard/overview'
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// 全局路由加载 Loading (响应式 ref)
export const isPageLoading = ref(false);

router.beforeEach((to, from, next) => {
  isPageLoading.value = true;
  const token = localStorage.getItem('admin_token');

  if (to.matched.some(record => record.meta.requiresAuth)) {
    if (!token) {
      localStorage.setItem('admin_token', 'zhanchen_demo_token');
      next();
    } else {
      next();
    }
  } else if (to.matched.some(record => record.meta.requiresGuest)) {
    if (token) {
      next('/dashboard/overview');
    } else {
      next();
    }
  } else {
    next();
  }
});

router.afterEach(() => {
  setTimeout(() => {
    isPageLoading.value = false;
  }, 200);
});

export default router;
