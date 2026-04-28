import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '../api';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'));
  const role = ref<'viewer' | 'admin' | null>(localStorage.getItem('role') as 'viewer' | 'admin' | null);

  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => role.value === 'admin');

  async function checkPhone(phone: string): Promise<'viewer' | 'admin'> {
    const res = await authApi.checkPhone(phone);
    return res.data.role as 'viewer' | 'admin';
  }

  async function login(phone: string, password?: string) {
    const res = await authApi.login(phone, password);
    token.value = res.data.token;
    role.value = res.data.role;
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('role', res.data.role);
  }

  function logout() {
    token.value = null;
    role.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('role');
  }

  return { token, role, isLoggedIn, isAdmin, checkPhone, login, logout };
});
