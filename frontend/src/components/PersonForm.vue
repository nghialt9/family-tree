<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <h2>{{ editPerson ? 'Sửa thông tin' : 'Thêm người mới' }}</h2>

      <form @submit.prevent="handleSubmit" class="form-grid">

        <!-- Avatar -->
        <div class="field full-width avatar-field">
          <label>Ảnh đại diện</label>
          <div class="avatar-row">
            <div class="avatar-preview">
              <img v-if="avatarPreview" :src="avatarPreview" />
              <img v-else-if="editPerson?.avatarUrl" :src="editPerson.avatarUrl" />
              <span v-else class="avatar-placeholder">{{ form.gender === 'female' ? '👩' : '👨' }}</span>
            </div>
            <div class="avatar-upload">
              <input type="file" accept="image/*" @change="handleFileChange" ref="fileInput" style="display:none" />
              <button type="button" class="btn-pick" @click="(fileInput as HTMLInputElement)?.click()">Chọn ảnh…</button>
              <button type="button" v-if="avatarPreview" class="btn-clear" @click="clearAvatar">Xóa</button>
              <span class="upload-hint">JPG / PNG · tối đa 5 MB · nhấn để cắt ảnh</span>
            </div>
          </div>
        </div>

        <AvatarCropper
          v-if="showCropper"
          :src="cropperSrc"
          @confirm="onCropConfirm"
          @cancel="onCropCancel"
        />

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

        <div class="section-title full-width">Quan hệ gia đình</div>
        <div class="field">
          <label>Cha</label>
          <select v-model="form.fatherId">
            <option value="">-- Không chọn --</option>
            <option v-for="p in malePersons" :key="p.id" :value="p.id">
              {{ p.fullName }}{{ p.nickname ? ` (${p.nickname})` : '' }} · Gen {{ p.generation }}
            </option>
          </select>
        </div>
        <div class="field">
          <label>Mẹ</label>
          <select v-model="form.motherId">
            <option value="">-- Không chọn --</option>
            <option v-for="p in femalePersons" :key="p.id" :value="p.id">
              {{ p.fullName }}{{ p.nickname ? ` (${p.nickname})` : '' }} · Gen {{ p.generation }}
            </option>
          </select>
        </div>
        <div class="field full-width">
          <label>Vợ / Chồng</label>
          <select v-model="form.spouseId">
            <option value="">-- Không chọn --</option>
            <option v-for="p in otherPersons" :key="p.id" :value="p.id">
              {{ p.fullName }}{{ p.nickname ? ` (${p.nickname})` : '' }} · {{ p.gender === 'male' ? 'Nam' : 'Nữ' }} · Gen {{ p.generation }}
            </option>
          </select>
        </div>

        <div v-if="form.phone && isAdmin" class="field full-width access-grant">
          <label class="checkbox-label">
            <input type="checkbox" v-model="form.grantAccess" />
            Cấp quyền truy cập cho số điện thoại này
          </label>
          <div v-if="form.grantAccess" class="grant-options">
            <select v-model="form.grantRole">
              <option value="viewer">Viewer — chỉ xem</option>
              <option value="editor">Editor — thêm & sửa</option>
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
import { ref, computed, watch, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { personsApi, relationshipsApi } from '../api';
import { useAuthStore } from '../stores/auth';
import AvatarCropper from './AvatarCropper.vue';

const auth = useAuthStore();
const { isAdmin } = storeToRefs(auth);

const props = defineProps<{ editPerson?: any | null }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved'): void }>();

const defaultForm = () => ({
  fullName: '', nickname: '', gender: 'male' as 'male' | 'female',
  birthDate: '', deathDate: '', phone: '', address: '', bio: '',
  generation: 1, grantAccess: false, grantRole: 'viewer' as 'viewer' | 'editor' | 'admin',
  grantPassword: '',
  fatherId: '', motherId: '', spouseId: '',
});

const form = ref(defaultForm());
const loading = ref(false);
const error = ref('');
const allPersons = ref<any[]>([]);

const fileInput = ref<HTMLInputElement | null>(null);
const avatarFile = ref<File | null>(null);
const avatarPreview = ref('');
const showCropper = ref(false);
const cropperSrc = ref('');

const origRelIds = ref({ fatherRelId: '', motherRelId: '', spouseRelId: '' });
const origPersonIds = ref({ fatherId: '', motherId: '', spouseId: '' });

const malePersons = computed(() =>
  allPersons.value.filter(p => p.id !== props.editPerson?.id && p.gender === 'male')
);
const femalePersons = computed(() =>
  allPersons.value.filter(p => p.id !== props.editPerson?.id && p.gender === 'female')
);
const otherPersons = computed(() =>
  allPersons.value.filter(p => p.id !== props.editPerson?.id)
);

onMounted(async () => {
  const res = await personsApi.list();
  allPersons.value = res.data;
});

watch(() => props.editPerson, async (p) => {
  avatarFile.value = null;
  avatarPreview.value = '';
  origRelIds.value = { fatherRelId: '', motherRelId: '', spouseRelId: '' };
  origPersonIds.value = { fatherId: '', motherId: '', spouseId: '' };
  if (p) {
    form.value = {
      ...defaultForm(),
      fullName: p.fullName, nickname: p.nickname || '', gender: p.gender,
      birthDate: p.birthDate ? p.birthDate.slice(0, 10) : '',
      deathDate: p.deathDate ? p.deathDate.slice(0, 10) : '',
      phone: p.phone || '', address: p.address || '', bio: p.bio || '',
      generation: p.generation,
    };
    try {
      const rRes = await personsApi.getRelatives(p.id);
      const rels = rRes.data;
      const father = rels.parents.find((x: any) => x.gender === 'male');
      const mother = rels.parents.find((x: any) => x.gender === 'female');
      const spouse = rels.spouses[0];
      form.value.fatherId = father?.id || '';
      form.value.motherId = mother?.id || '';
      form.value.spouseId = spouse?.id || '';
      origRelIds.value = {
        fatherRelId: father?.relationshipId || '',
        motherRelId: mother?.relationshipId || '',
        spouseRelId: spouse?.relationshipId || '',
      };
      origPersonIds.value = {
        fatherId: father?.id || '',
        motherId: mother?.id || '',
        spouseId: spouse?.id || '',
      };
    } catch { /* ignore */ }
    // Pre-fill access grant status from existing AccessToken
    try {
      const aRes = await personsApi.getAccess(p.id);
      if (aRes.data.hasAccess) {
        form.value.grantAccess = true;
        form.value.grantRole = aRes.data.role;
      }
    } catch { /* ignore — non-admin or no token */ }
  } else {
    form.value = defaultForm();
  }
}, { immediate: true });

// Auto-calculate generation from selected parents (new persons only)
watch([() => form.value.fatherId, () => form.value.motherId], ([fId, mId]) => {
  if (props.editPerson) return;
  const father = allPersons.value.find(p => p.id === fId);
  const mother = allPersons.value.find(p => p.id === mId);
  const maxGen = Math.max(father?.generation ?? 0, mother?.generation ?? 0);
  form.value.generation = maxGen > 0 ? maxGen + 1 : 1;
});

function handleFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (cropperSrc.value) URL.revokeObjectURL(cropperSrc.value);
  cropperSrc.value = URL.createObjectURL(file);
  showCropper.value = true;
}

function onCropConfirm(blob: Blob) {
  avatarFile.value = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value);
  avatarPreview.value = URL.createObjectURL(blob);
  showCropper.value = false;
  if (cropperSrc.value) { URL.revokeObjectURL(cropperSrc.value); cropperSrc.value = ''; }
}

function onCropCancel() {
  showCropper.value = false;
  if (cropperSrc.value) { URL.revokeObjectURL(cropperSrc.value); cropperSrc.value = ''; }
  if (fileInput.value) fileInput.value.value = '';
}

function clearAvatar() {
  avatarFile.value = null;
  if (avatarPreview.value) { URL.revokeObjectURL(avatarPreview.value); avatarPreview.value = ''; }
  if (fileInput.value) fileInput.value.value = '';
}

async function handleRelationships(personId: string) {
  if (form.value.fatherId !== origPersonIds.value.fatherId) {
    if (origRelIds.value.fatherRelId) await relationshipsApi.delete(origRelIds.value.fatherRelId);
    if (form.value.fatherId) await relationshipsApi.create({ personAId: form.value.fatherId, personBId: personId, type: 'parent_child' });
  }
  if (form.value.motherId !== origPersonIds.value.motherId) {
    if (origRelIds.value.motherRelId) await relationshipsApi.delete(origRelIds.value.motherRelId);
    if (form.value.motherId) await relationshipsApi.create({ personAId: form.value.motherId, personBId: personId, type: 'parent_child' });
  }
  if (form.value.spouseId !== origPersonIds.value.spouseId) {
    if (origRelIds.value.spouseRelId) await relationshipsApi.delete(origRelIds.value.spouseRelId);
    if (form.value.spouseId) await relationshipsApi.create({ personAId: personId, personBId: form.value.spouseId, type: 'spouse' });
  }
}

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
      grantAccess: form.value.grantAccess,
      grantRole: form.value.grantAccess ? form.value.grantRole : undefined,
      grantPassword: (form.value.grantAccess && form.value.grantRole === 'admin') ? form.value.grantPassword : undefined,
    };
    let savedId: string;
    if (props.editPerson) {
      const res = await personsApi.update(props.editPerson.id, payload);
      savedId = res.data.id;
    } else {
      const res = await personsApi.create(payload);
      savedId = res.data.id;
    }
    if (avatarFile.value) {
      await personsApi.uploadAvatar(savedId, avatarFile.value);
    }
    await handleRelationships(savedId);
    emit('saved');
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Lỗi khi lưu.';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 16px; }
.modal { background: #ffffff; border: 1px solid #d0d7de; border-radius: 12px; padding: 28px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; box-shadow: 0 8px 24px rgba(140,149,159,0.2); }
h2 { margin-bottom: 20px; font-size: 1.1rem; color: #24292f; font-weight: 700; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.full-width { grid-column: 1 / -1; }
.section-title { font-size: 11px; font-weight: 600; color: #57606a; text-transform: uppercase; letter-spacing: 0.5px; padding-top: 8px; border-top: 1px solid #d0d7de; margin-top: 4px; }
label { font-size: 12px; color: #57606a; font-weight: 500; }
input, select, textarea { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: 8px 10px; color: #24292f; font-size: 13px; width: 100%; box-sizing: border-box; }
input:focus, select:focus, textarea:focus { outline: none; border-color: #0969da; box-shadow: 0 0 0 3px rgba(9,105,218,0.1); }
textarea { resize: vertical; }

/* Avatar */
.avatar-field { }
.avatar-row { display: flex; gap: 14px; align-items: center; }
.avatar-preview { width: 72px; height: 72px; border-radius: 50%; border: 2px solid #d0d7de; background: #f6f8fa; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
.avatar-preview img { width: 100%; height: 100%; object-fit: cover; }
.avatar-placeholder { font-size: 36px; }
.avatar-upload { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.btn-pick { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: 6px 12px; font-size: 12px; cursor: pointer; color: #24292f; }
.btn-pick:hover { background: #eaeef2; }
.btn-clear { background: #ffebe9; border: 1px solid #ffcecb; border-radius: 6px; padding: 6px 10px; font-size: 12px; cursor: pointer; color: #cf222e; }
.upload-hint { font-size: 11px; color: #57606a; width: 100%; }

.access-grant { background: #ddf4ff; border: 1px solid #54aeff; border-radius: 8px; padding: 12px; }
.checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #24292f; cursor: pointer; font-weight: 500; }
.grant-options { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.buttons { display: flex; gap: 10px; justify-content: flex-end; }
.buttons button { padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
.buttons button[type=button] { background: #f6f8fa; border: 1px solid #d0d7de; color: #24292f; }
.buttons button[type=button]:hover { background: #eaeef2; }
.buttons button[type=submit] { background: #2da44e; border: 1px solid #2da44e; color: #fff; }
.buttons button[type=submit]:hover { background: #2c974b; }
.buttons button:disabled { opacity: 0.6; cursor: not-allowed; }
.error { color: #cf222e; font-size: 12px; }
</style>
