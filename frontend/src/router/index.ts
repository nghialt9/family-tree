import { createRouter, createWebHistory } from 'vue-router';
import LoginPage from '../pages/LoginPage.vue';
import TreePage from '../pages/TreePage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginPage },
    {
      path: '/',
      component: TreePage,
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/audit',
      component: () => import('../pages/AuditPage.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/persons/:id/media',
      component: () => import('../pages/PersonMediaPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/relationships/:id/media',
      component: () => import('../pages/RelationshipMediaPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/media',
      component: () => import('../pages/AdminMediaPage.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
  ],
});

router.beforeEach((to) => {
  const token = localStorage.getItem('token');
  if (to.meta.requiresAuth && !token) return '/login';
  if (to.meta.requiresAdmin) {
    const role = localStorage.getItem('role');
    if (role !== 'admin') return '/';
  }
});
