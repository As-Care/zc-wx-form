import { createRouter, createWebHistory } from 'vue-router';
import Login from '../views/Login.vue';
import Dashboard from '../views/Dashboard.vue';
import Orders from '../views/Orders.vue';
import Products from '../views/Products.vue';
import Users from '../views/Users.vue';
import Overview from '../views/Overview.vue';
import StaffConfig from '../views/StaffConfig.vue';

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
        path: 'users',
        name: 'Users',
        component: Users
      },
      {
        path: 'staff',
        name: 'StaffConfig',
        component: StaffConfig
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

router.beforeEach((to, from, next) => {
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

export default router;
