<template>
  <div class="login-wrap">
    <div class="login-card">
      <h1>🌳 Gia Phả Nhà Lâm</h1>
      <p class="subtitle">Nhập số điện thoại để xem gia phả</p>

      <form @submit.prevent="step === 1 ? handleCheckPhone() : handleLogin()">
        <div class="field">
          <label>Số điện thoại</label>
          <input v-model="phone" type="tel" placeholder="09xxxxxxxx" :disabled="step === 2" required />
        </div>

        <div v-if="step === 2" class="field">
          <label>Mật khẩu (admin)</label>
          <input v-model="password" type="password" placeholder="••••••••" required />
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <button type="submit" :disabled="loading">
          {{ loading ? 'Đang xử lý...' : step === 1 ? 'Tiếp tục' : 'Đăng nhập' }}
        </button>

        <button v-if="step === 2" type="button" class="back" @click="step = 1; password = ''; error = ''">
          ← Quay lại
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();

const phone = ref('');
const password = ref('');
const step = ref<1 | 2>(1);
const loading = ref(false);
const error = ref('');

async function handleCheckPhone() {
  loading.value = true; error.value = '';
  try {
    const role = await auth.checkPhone(phone.value);
    if (role === 'admin') {
      step.value = 2;
    } else {
      await auth.login(phone.value);
      router.push('/');
    }
  } catch {
    error.value = 'Số điện thoại không có quyền truy cập.';
  } finally {
    loading.value = false;
  }
}

async function handleLogin() {
  loading.value = true; error.value = '';
  try {
    await auth.login(phone.value, password.value);
    router.push('/');
  } catch {
    error.value = 'Mật khẩu không đúng.';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0d1117; }
.login-card { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 40px; width: 360px; }
h1 { font-size: 1.5rem; margin-bottom: 6px; }
.subtitle { color: #8b949e; margin-bottom: 24px; font-size: 0.9rem; }
.field { margin-bottom: 16px; }
label { display: block; margin-bottom: 6px; font-size: 0.85rem; color: #8b949e; }
input { width: 100%; padding: 10px 12px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: #e6edf3; font-size: 1rem; }
input:focus { outline: none; border-color: #58a6ff; }
button[type=submit] { width: 100%; padding: 12px; background: #238636; border: none; border-radius: 6px; color: #fff; font-size: 1rem; cursor: pointer; margin-top: 8px; }
button[type=submit]:hover { background: #2ea043; }
button[type=submit]:disabled { opacity: 0.6; cursor: not-allowed; }
.back { width: 100%; padding: 8px; background: transparent; border: 1px solid #30363d; border-radius: 6px; color: #8b949e; cursor: pointer; margin-top: 8px; }
.error { color: #f85149; font-size: 0.85rem; margin-bottom: 8px; }
</style>
