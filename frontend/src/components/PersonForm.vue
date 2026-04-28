<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <h2>{{ editPerson ? 'Sửa thông tin' : 'Thêm người mới' }}</h2>

      <form @submit.prevent="handleSubmit" class="form-grid">
        <div class="field">
          <label>Họ và tên *</label>
          <input v-model="form.fullName" required />
        </div>
        <div class="field">
          <label>Tên gọi</label>
          <input v-model="form.nickname" />
        </div>
        <div class="field">
          <label>Giới tính *</label>
          <select v-model="form.gender" required>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
          </select>
        </div>
        <div class="field">
          <label>Thế hệ *</label>
          <input v-model.number="form.generation" type="number" min="1" required />
        </div>
        <div class="field">
          <label>Ngày sinh</label>
          <input v-model="form.birthDate" type="date" />
        </div>
        <div class="field">
          <label>Ngày mất</label>
          <input v-model="form.deathDate" type="date" />
        </div>
        <div class="field">
          <label>Số điện thoại</label>
          <input v-model="form.phone" type="tel" />
        </div>
        <div class="field">
          <label>Địa chỉ</label>
          <input v-model="form.address" />
        </div>
        <div class="field full-width">
          <label>Tiểu sử / Ghi chú</label>
          <textarea v-model="form.bio" rows="3" />
        </div>

        <div v-if="form.phone" class="field full-width access-grant">
          <label class="checkbox-label">
            <input type="checkbox" v-model="form.grantAccess" />
            Cấp quyền truy cập cho số điện thoại này
          </label>
          <div v-if="form.grantAccess" class="grant-options">
            <select v-model="form.grantRole">
              <option value="viewer">Viewer — chỉ xem</option>
              <option value="admin">Admin — thêm/sửa/xóa</option>
            </select>
            <input
              v-if="form.grantRole === 'admin'"
              v-model="form.grantPassword"
              type="password"
              placeholder="Mật khẩu cho admin *"
              :required="form.grantRole === 'admin' && form.grantAccess"
            />
          </div>
        </div>

        <p v-if="error" class="error full-width">{{ error }}</p>

        <div class="buttons full-width">
          <button type="button" @click="$emit('close')">Hủy</button>
          <button type="submit" :disabled="loading">{{ loading ? 'Đang lưu...' : 'Lưu' }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { personsApi } from '../api';

const props = defineProps<{ editPerson?: any | null }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved'): void }>();

const defaultForm = () => ({
  fullName: '', nickname: '', gender: 'male' as 'male' | 'female',
  birthDate: '', deathDate: '', phone: '', address: '', bio: '',
  generation: 1, grantAccess: false, grantRole: 'viewer' as 'viewer' | 'admin',
  grantPassword: '',
});

const form = ref(defaultForm());
const loading = ref(false);
const error = ref('');

watch(() => props.editPerson, (p) => {
  if (p) {
    form.value = {
      ...defaultForm(),
      fullName: p.fullName, nickname: p.nickname || '', gender: p.gender,
      birthDate: p.birthDate ? p.birthDate.slice(0, 10) : '',
      deathDate: p.deathDate ? p.deathDate.slice(0, 10) : '',
      phone: p.phone || '', address: p.address || '', bio: p.bio || '',
      generation: p.generation,
    };
  } else {
    form.value = defaultForm();
  }
}, { immediate: true });

async function handleSubmit() {
  loading.value = true; error.value = '';
  try {
    const payload = {
      ...form.value,
      birthDate: form.value.birthDate || undefined,
      deathDate: form.value.deathDate || undefined,
      phone: form.value.phone || undefined,
      nickname: form.value.nickname || undefined,
      address: form.value.address || undefined,
      bio: form.value.bio || undefined,
      grantAccess: form.value.grantAccess || undefined,
      grantRole: form.value.grantAccess ? form.value.grantRole : undefined,
      grantPassword: (form.value.grantAccess && form.value.grantRole === 'admin') ? form.value.grantPassword : undefined,
    };
    if (props.editPerson) {
      await personsApi.update(props.editPerson.id, payload);
    } else {
      await personsApi.create(payload);
    }
    emit('saved');
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Lỗi khi lưu.';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 16px; }
.modal { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 28px; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; }
h2 { margin-bottom: 20px; font-size: 1.1rem; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.full-width { grid-column: 1 / -1; }
label { font-size: 12px; color: #8b949e; }
input, select, textarea { background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 8px 10px; color: #e6edf3; font-size: 13px; width: 100%; }
input:focus, select:focus, textarea:focus { outline: none; border-color: #58a6ff; }
textarea { resize: vertical; }
.access-grant { background: rgba(88,166,255,0.06); border: 1px solid #30363d; border-radius: 8px; padding: 12px; }
.checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #e6edf3; cursor: pointer; }
.grant-options { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.buttons { display: flex; gap: 10px; justify-content: flex-end; }
.buttons button { padding: 10px 20px; border-radius: 6px; cursor: pointer; border: 1px solid #30363d; font-size: 13px; }
.buttons button[type=button] { background: #21262d; color: #e6edf3; }
.buttons button[type=submit] { background: #238636; border-color: #238636; color: #fff; }
.buttons button:disabled { opacity: 0.6; cursor: not-allowed; }
.error { color: #f85149; font-size: 12px; }
</style>
