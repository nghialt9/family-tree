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
.login-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f6f8fa; }
.login-card { background: #ffffff; border: 1px solid #d0d7de; border-radius: 12px; padding: 40px; width: 360px; box-shadow: 0 8px 24px rgba(140,149,159,0.15); }
h1 { font-size: 1.5rem; margin-bottom: 6px; color: #24292f; }
.subtitle { color: #57606a; margin-bottom: 24px; font-size: 0.9rem; }
.field { margin-bottom: 16px; }
label { display: block; margin-bottom: 6px; font-size: 0.85rem; color: #57606a; font-weight: 500; }
input { width: 100%; padding: 10px 12px; background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; color: #24292f; font-size: 1rem; box-sizing: border-box; }
input:focus { outline: none; border-color: #0969da; box-shadow: 0 0 0 3px rgba(9,105,218,0.1); }
input:disabled { opacity: 0.6; }
button[type=submit] { width: 100%; padding: 12px; background: #2da44e; border: none; border-radius: 6px; color: #fff; font-size: 1rem; font-weight: 500; cursor: pointer; margin-top: 8px; }
button[type=submit]:hover { background: #2c974b; }
button[type=submit]:disabled { opacity: 0.6; cursor: not-allowed; }
.back { width: 100%; padding: 8px; background: transparent; border: 1px solid #d0d7de; border-radius: 6px; color: #57606a; cursor: pointer; margin-top: 8px; font-size: 0.9rem; }
.back:hover { background: #f6f8fa; }
.error { color: #cf222e; font-size: 0.85rem; margin-bottom: 8px; }
</style>
