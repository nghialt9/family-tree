import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '../api';

function decodeJwtPhone(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return (payload.phone as string) ?? null;
  } catch {
    return null;
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'));
  const role = ref<'viewer' | 'editor' | 'admin' | null>(localStorage.getItem('role') as 'viewer' | 'editor' | 'admin' | null);
  const personName = ref<string | null>(localStorage.getItem('personName'));
  const linkedPersonId = ref<string | null>(localStorage.getItem('linkedPersonId'));

  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => role.value === 'admin');
  const isEditor = computed(() => role.value === 'editor' || role.value === 'admin');
  const userPhone = computed(() => (token.value ? decodeJwtPhone(token.value) : null));

  async function checkPhone(phone: string): Promise<'viewer' | 'admin'> {
    const res = await authApi.checkPhone(phone);
    return res.data.role as 'viewer' | 'admin';
  }

  async function login(phone: string, password?: string) {
    const res = await authApi.login(phone, password);
    token.value = res.data.token;
    role.value = res.data.role;
    personName.value = res.data.personName ?? null;
    linkedPersonId.value = res.data.personId ?? null;
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('role', res.data.role);
    if (res.data.personName) localStorage.setItem('personName', res.data.personName);
    else localStorage.removeItem('personName');
    if (res.data.personId) localStorage.setItem('linkedPersonId', res.data.personId);
    else localStorage.removeItem('linkedPersonId');
  }

  function logout() {
    token.value = null;
    role.value = null;
    personName.value = null;
    linkedPersonId.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('personName');
    localStorage.removeItem('linkedPersonId');
  }

  return { token, role, personName, userPhone, linkedPersonId, isLoggedIn, isAdmin, isEditor, checkPhone, login, logout };
});
