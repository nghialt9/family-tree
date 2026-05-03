<template>
  <Teleport to="body">
  <div
    class="modal-overlay"
    @click.self="$emit('close')"
  >
    <div class="pf-dialog">
      <div class="pf-dialog-header">
        <h2>{{ editPerson ? 'Sửa thông tin' : preRelationTitle }}</h2>
        <button type="button" class="pf-dialog-close" @click="$emit('close')">✕</button>
      </div>

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
          <label>Ngày mất (âm lịch)</label>
          <input v-model="form.deathLunarDate" type="date" />
        </div>
        <div class="field">
          <label>Số điện thoại</label>
          <input v-model="form.phone" type="tel" />
        </div>
        <div class="field">
          <label>Email thông báo</label>
          <input v-model="form.email" type="email" placeholder="example@gmail.com" />
        </div>
        <div class="field full-width location-section">
          <div class="loc-block">
            <div class="loc-label">Quê quán</div>
            <div class="loc-row">
              <input v-model="form.hometown" class="loc-input" placeholder="VD: Đồng Tháp, Việt Nam" />
              <button type="button" class="btn-geocode" :disabled="geocodingHometown || !form.hometown.trim()" @click="geocodeHometown">
                {{ geocodingHometown ? '...' : '📍 Geocode' }}
              </button>
              <button v-if="form.homeLat !== null || form.homeLng !== null" type="button" class="btn-clear-loc" @click="form.homeLat = null; form.homeLng = null; hometownDisplayName = ''">✕</button>
            </div>
            <div v-if="geocodeHometownError" class="geocode-error">{{ geocodeHometownError }}</div>
            <div v-if="form.homeLat !== null && form.homeLng !== null" class="mini-map-wrap">
              <l-map
                :key="`hm-${form.homeLat}-${form.homeLng}`"
                :zoom="12"
                :center="[form.homeLat, form.homeLng]"
                style="height:140px;width:100%"
                :options="{ attributionControl: false, zoomControl: true }"
              >
                <l-tile-layer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <l-marker
                  :lat-lng="[form.homeLat, form.homeLng]"
                  :icon="dragPinIcon"
                  :draggable="true"
                  @moveend="onHometownMarkerMove"
                />
              </l-map>
              <div class="mini-map-info">
                <span v-if="hometownDisplayName" class="mini-map-display">✓ {{ hometownDisplayName }}</span>
                <span v-else class="mini-map-display">{{ form.homeLat.toFixed(4) }}°N, {{ form.homeLng.toFixed(4) }}°E</span>
                <span class="drag-hint">Kéo pin để chỉnh vị trí</span>
              </div>
            </div>
          </div>

          <div class="loc-block">
            <div class="loc-label">Địa chỉ hiện tại</div>
            <div class="loc-row">
              <input v-model="form.address" class="loc-input" placeholder="VD: Q.7, TP.HCM" />
              <button type="button" class="btn-geocode" :disabled="geocodingCurrent || !form.address.trim()" @click="geocodeCurrent">
                {{ geocodingCurrent ? '...' : '📍 Geocode' }}
              </button>
              <button v-if="form.currentLat !== null || form.currentLng !== null" type="button" class="btn-clear-loc" @click="form.currentLat = null; form.currentLng = null; currentDisplayName = ''">✕</button>
            </div>
            <div v-if="geocodeCurrentError" class="geocode-error">{{ geocodeCurrentError }}</div>
            <div v-if="form.currentLat !== null && form.currentLng !== null" class="mini-map-wrap">
              <l-map
                :key="`cm-${form.currentLat}-${form.currentLng}`"
                :zoom="12"
                :center="[form.currentLat, form.currentLng]"
                style="height:140px;width:100%"
                :options="{ attributionControl: false, zoomControl: true }"
              >
                <l-tile-layer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <l-marker
                  :lat-lng="[form.currentLat, form.currentLng]"
                  :icon="dragPinIcon"
                  :draggable="true"
                  @moveend="onCurrentMarkerMove"
                />
              </l-map>
              <div class="mini-map-info">
                <span v-if="currentDisplayName" class="mini-map-display">✓ {{ currentDisplayName }}</span>
                <span v-else class="mini-map-display">{{ form.currentLat.toFixed(4) }}°N, {{ form.currentLng.toFixed(4) }}°E</span>
                <span class="drag-hint">Kéo pin để chỉnh vị trí</span>
              </div>
            </div>
          </div>
        </div>
        <div class="field full-width">
          <label>Tiểu sử / Ghi chú</label>
          <textarea v-model="form.bio" rows="3" />
        </div>

        <div class="section-title full-width">Quan hệ gia đình</div>
        <div class="field">
          <label>Cha</label>
          <div v-if="isLockedFather" class="locked-field">🔒 {{ preRelation?.personName }}</div>
          <SearchableSelect v-else v-model="form.fatherId" :options="fatherOptions" placeholder="-- Tìm tên cha --" />
        </div>
        <div class="field">
          <label>Mẹ</label>
          <div v-if="isLockedMother" class="locked-field">🔒 {{ preRelation?.personName }}</div>
          <SearchableSelect v-else v-model="form.motherId" :options="motherOptions" placeholder="-- Tìm tên mẹ --" />
        </div>
        <div class="field full-width">
          <label>Vợ / Chồng</label>
          <div v-if="isLockedSpouse" class="locked-field">🔒 {{ preRelation?.personName }}</div>
          <SearchableSelect v-else v-model="form.spouseId" :options="spouseOptions" placeholder="-- Tìm tên vợ/chồng --" />
        </div>

        <div v-if="form.phone && isEditor && canEditAccess" class="field full-width access-grant">

          <!-- Self-edit: role is locked, only password can change -->
          <template v-if="isSelfEdit">
            <div class="self-role-info">
              Vai trò hiện tại: <strong>{{ roleLabel(form.grantRole) }}</strong>
              <span class="role-note">· không thể thay đổi vai trò của chính mình</span>
            </div>
            <input
              v-if="form.grantAccess"
              v-model="form.grantPassword"
              type="password"
              class="mt-6"
              placeholder="Mật khẩu mới (để trống = giữ nguyên)"
            />
          </template>

          <!-- Editing someone else -->
          <template v-else>
            <label class="checkbox-label">
              <input type="checkbox" v-model="form.grantAccess" />
              Cấp quyền truy cập cho số điện thoại này
            </label>
            <div v-if="form.grantAccess" class="grant-options">
              <select v-model="form.grantRole" :disabled="!isAdmin">
                <option value="viewer">Viewer — chỉ xem</option>
                <option v-if="isAdmin" value="editor">Editor — thêm & sửa</option>
                <option v-if="isAdmin" value="admin">Admin — thêm/sửa/xóa</option>
              </select>
              <input
                v-if="isAdmin && (form.grantRole === 'admin' || form.grantRole === 'editor')"
                v-model="form.grantPassword"
                type="password"
                placeholder="Mật khẩu *"
                :required="form.grantAccess"
              />
            </div>
          </template>

        </div>

        <p v-if="error" class="error full-width">{{ error }}</p>

        <div class="buttons full-width">
          <button type="button" @click="$emit('close')">Hủy</button>
          <button type="submit" :disabled="loading">{{ loading ? 'Đang lưu...' : 'Lưu' }}</button>
        </div>
      </form>
    </div>
  </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { personsApi, relationshipsApi, geocodeApi } from '../api';
import { useAuthStore } from '../stores/auth';
import AvatarCropper from './AvatarCropper.vue';
import SearchableSelect from './SearchableSelect.vue';
import { LMap, LTileLayer, LMarker } from '@vue-leaflet/vue-leaflet';
import L from 'leaflet';

// Pin kéo tuỳ chỉnh — dùng emoji thay cho ảnh marker mặc định của Leaflet
const dragPinIcon = L.divIcon({
  html: '<span style="font-size:24px;line-height:1;display:block">📍</span>',
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

const auth = useAuthStore();
// storeToRefs() giữ reactivity khi destructure từ Pinia store
const { isAdmin, isEditor, linkedPersonId } = storeToRefs(auth);

// True khi người dùng đang đăng nhập chỉnh sửa card hồ sơ của chính mình
const isSelfEdit = computed(() => !!props.editPerson && !!linkedPersonId.value && props.editPerson.id === linkedPersonId.value);

function roleLabel(r: string) {
  if (r === 'admin') return 'Admin';
  if (r === 'editor') return 'Editor — thêm & sửa';
  return 'Viewer — chỉ xem';
}

// defineProps với TypeScript generic — không cần withDefaults() vì các prop đều optional
const props = defineProps<{
  editPerson?: any | null;
  preRelation?: { type: 'asChildOf' | 'asSpouseOf' | 'asParentOf'; personId: string; personName: string; personGender: 'male' | 'female' } | null;
}>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved'): void }>();

const preRelationTitle = computed(() => {
  const r = props.preRelation;
  if (!r) return 'Thêm người mới';
  if (r.type === 'asChildOf') return `Thêm con của ${r.personName}`;
  if (r.type === 'asSpouseOf') return `Thêm vợ/chồng của ${r.personName}`;
  return `Thêm cha/mẹ của ${r.personName}`;
});

const isLockedFather = computed(() => props.preRelation?.type === 'asChildOf' && props.preRelation.personGender === 'male');
const isLockedMother = computed(() => props.preRelation?.type === 'asChildOf' && props.preRelation.personGender === 'female');
const isLockedSpouse = computed(() => props.preRelation?.type === 'asSpouseOf');

const defaultForm = () => ({
  fullName: '', nickname: '', gender: 'male' as 'male' | 'female',
  birthDate: '', deathLunarDate: '',
  phone: '', address: '', bio: '', email: '',
  generation: 1, grantAccess: false, grantRole: 'viewer' as 'viewer' | 'editor' | 'admin',
  grantPassword: '',
  fatherId: '', motherId: '', spouseId: '',
  hometown: '',
  homeLat: null as number | null,
  homeLng: null as number | null,
  currentLat: null as number | null,
  currentLng: null as number | null,
});

const form = ref(defaultForm());
const loading = ref(false);
const error = ref('');
const geocodingHometown = ref(false);
const geocodeHometownError = ref('');
const hometownDisplayName = ref('');
const geocodingCurrent = ref(false);
const geocodeCurrentError = ref('');
const currentDisplayName = ref('');
const allPersons = ref<any[]>([]);

const fileInput = ref<HTMLInputElement | null>(null);
const avatarFile = ref<File | null>(null);
const avatarPreview = ref('');
const showCropper = ref(false);
const cropperSrc = ref('');

// ref() bọc object — Vue theo dõi khi .value bị thay thế hoàn toàn (không theo dõi field con)
const origRelIds = ref({ fatherRelId: '', motherRelId: '', spouseRelId: '' });
const origPersonIds = ref({ fatherId: '', motherId: '', spouseId: '' });

// Role hiện tại của người này trong hệ thống (null = chưa có quyền truy cập)
const existingAccessRole = ref<string | null>(null);

// Editor không được thay đổi quyền của người đã có role admin hoặc editor.
// Điều này ngăn leo thang đặc quyền (editor tự cấp/thu hồi quyền admin/editor).
const canEditAccess = computed(() => {
  if (isSelfEdit.value || isAdmin.value) return true;
  return !existingAccessRole.value || existingAccessRole.value === 'viewer';
});

// Loại người đang chỉnh sửa khỏi dropdown quan hệ để tránh tự tham chiếu chính mình
const malePersons = computed(() =>
  allPersons.value.filter(p => p.id !== props.editPerson?.id && p.gender === 'male')
);
const femalePersons = computed(() =>
  allPersons.value.filter(p => p.id !== props.editPerson?.id && p.gender === 'female')
);
const otherPersons = computed(() =>
  allPersons.value.filter(p => p.id !== props.editPerson?.id)
);

function personLabel(p: any) {
  return `${p.fullName}${p.nickname ? ` (${p.nickname})` : ''} · Gen ${p.generation}`;
}
const fatherOptions = computed(() => malePersons.value.map(p => ({ value: p.id, label: personLabel(p) })));
const motherOptions = computed(() => femalePersons.value.map(p => ({ value: p.id, label: personLabel(p) })));
const spouseOptions = computed(() => otherPersons.value.map(p => ({
  value: p.id,
  label: `${p.fullName}${p.nickname ? ` (${p.nickname})` : ''} · ${p.gender === 'male' ? 'Nam' : 'Nữ'} · Gen ${p.generation}`,
})));

onMounted(async () => {
  // Tải trước tất cả người một lần để dropdown quan hệ sẵn sàng ngay khi form mở
  const res = await personsApi.list();
  allPersons.value = res.data;
});

// watch(() => props.editPerson, ...) — dùng getter function thay vì props.editPerson trực tiếp
// vì props là reactive object, cần getter để Vue theo dõi đúng field
// { immediate: true } — chạy ngay khi component mount, không chờ editPerson thay đổi
// Điền lại form mỗi khi người được chỉnh sửa thay đổi (hoặc khi form mở lần đầu).
// Dùng allSettled để tải quan hệ và quyền truy cập song song — một lỗi 403
// (editor xem quyền của admin) không làm hỏng phần còn lại của form.
watch(() => props.editPerson, async (p) => {
  // Reset trạng thái tạm trước để dữ liệu cũ không lọt vào lần mở form mới
  avatarFile.value = null;
  avatarPreview.value = '';
  origRelIds.value = { fatherRelId: '', motherRelId: '', spouseRelId: '' };
  origPersonIds.value = { fatherId: '', motherId: '', spouseId: '' };
  existingAccessRole.value = null;
  hometownDisplayName.value = '';
  currentDisplayName.value = '';
  geocodeHometownError.value = '';
  geocodeCurrentError.value = '';
  if (p) {
    form.value = {
      ...defaultForm(),
      fullName: p.fullName, nickname: p.nickname || '', gender: p.gender,
      birthDate: p.birthDate ? p.birthDate.slice(0, 10) : '',
      // Ghép 3 field riêng thành "YYYY-MM-DD" để date picker hiển thị đúng
      deathLunarDate: (p.deathLunarYear && p.deathLunarMonth && p.deathLunarDay)
        ? `${p.deathLunarYear}-${String(p.deathLunarMonth).padStart(2, '0')}-${String(p.deathLunarDay).padStart(2, '0')}`
        : '',
      phone: p.phone || '', address: p.address || '', bio: p.bio || '',
      email: p.email || '',
      generation: p.generation,
      hometown: p.hometown || '',
      homeLat: p.homeLat ?? null,
      homeLng: p.homeLng ?? null,
      currentLat: p.currentLat ?? null,
      currentLng: p.currentLng ?? null,
    };
    // Promise.allSettled() — chạy song song, KHÔNG throw nếu một promise fail
    // (khác Promise.all() sẽ reject ngay khi có một cái fail)
    const [rResult, aResult] = await Promise.allSettled([
      personsApi.getRelatives(p.id),
      // Chỉ editor mới cần thông tin quyền truy cập; bỏ qua với phiên viewer
      isEditor.value ? personsApi.getAccess(p.id) : Promise.resolve(null),
    ]);
    if (rResult.status === 'fulfilled' && rResult.value) {
      const rels = rResult.value.data;
      const father = rels.parents.find((x: any) => x.gender === 'male');
      const mother = rels.parents.find((x: any) => x.gender === 'female');
      const spouse = rels.spouses[0];
      form.value.fatherId = father?.id || '';
      form.value.motherId = mother?.id || '';
      form.value.spouseId = spouse?.id || '';
      // Lưu ID gốc để handleRelationships có thể so sánh cũ/mới khi submit
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
    }
    if (aResult.status === 'fulfilled' && aResult.value?.data?.hasAccess) {
      const existingRole = aResult.value.data.role;
      existingAccessRole.value = existingRole; // luôn lưu để canEditAccess có thể kiểm tra
      // Điền sẵn phần quyền: self-edit luôn thấy; admin thấy tất cả; editor chỉ thấy viewer
      if (isSelfEdit.value || isAdmin.value || existingRole === 'viewer') {
        form.value.grantAccess = true;
        form.value.grantRole = existingRole;
      }
    }
  } else {
    // Người mới: reset về mặc định, rồi điền sẵn quan hệ bị khoá từ preRelation
    form.value = defaultForm();
    const rel = props.preRelation;
    if (rel) {
      if (rel.type === 'asChildOf') {
        if (rel.personGender === 'male') form.value.fatherId = rel.personId;
        else form.value.motherId = rel.personId;
      } else if (rel.type === 'asSpouseOf') {
        form.value.spouseId = rel.personId;
      }
    }
  }
}, { immediate: true });

// watch([dep1, dep2], ([val1, val2]) => ...) — watch mảng deps để lắng nghe cả 2 field cùng lúc
// destructure [fId, mId] từ tham số đầu tiên tương ứng với từng dep
// Tự động tính thế hệ khi chọn bố/mẹ (chỉ áp dụng cho người mới).
// Lấy thế hệ cao nhất của bố/mẹ + 1 để nhập liệu nhiều thế hệ vẫn nhất quán.
watch([() => form.value.fatherId, () => form.value.motherId], ([fId, mId]) => {
  if (props.editPerson) return;
  const father = allPersons.value.find(p => p.id === fId);
  const mother = allPersons.value.find(p => p.id === mId);
  const maxGen = Math.max(father?.generation ?? 0, mother?.generation ?? 0);
  form.value.generation = maxGen > 0 ? maxGen + 1 : 1;
});

// Mở cropper ngay sau khi người dùng chọn file ảnh
function handleFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  // Thu hồi object URL cũ để tránh rò rỉ bộ nhớ
  if (cropperSrc.value) URL.revokeObjectURL(cropperSrc.value);
  // URL.createObjectURL() — tạo URL tạm (blob:...) trong memory trỏ đến file, cần revoke sau khi dùng
  cropperSrc.value = URL.createObjectURL(file);
  showCropper.value = true;
}

function onCropConfirm(blob: Blob) {
  avatarFile.value = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
  // Thu hồi URL xem trước cũ trước khi tạo URL mới
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value);
  avatarPreview.value = URL.createObjectURL(blob);
  showCropper.value = false;
  if (cropperSrc.value) { URL.revokeObjectURL(cropperSrc.value); cropperSrc.value = ''; }
}

function onCropCancel() {
  showCropper.value = false;
  if (cropperSrc.value) { URL.revokeObjectURL(cropperSrc.value); cropperSrc.value = ''; }
  // Reset file input để người dùng có thể chọn lại cùng file nếu muốn
  if (fileInput.value) fileInput.value.value = '';
}

function clearAvatar() {
  avatarFile.value = null;
  if (avatarPreview.value) { URL.revokeObjectURL(avatarPreview.value); avatarPreview.value = ''; }
  if (fileInput.value) fileInput.value.value = '';
}

// Đồng bộ quan hệ theo kiểu diff: chỉ xử lý những quan hệ thực sự thay đổi.
// Xóa quan hệ cũ trước, rồi tạo mới (backend không có endpoint update trực tiếp).
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

async function geocodeHometown() {
  if (!form.value.hometown.trim()) return;
  geocodingHometown.value = true;
  geocodeHometownError.value = '';
  hometownDisplayName.value = '';
  try {
    const res = await geocodeApi.search(form.value.hometown);
    if (!res.data.length) {
      geocodeHometownError.value = 'Không tìm thấy địa điểm, thử từ khóa khác';
      return;
    }
    const first = res.data[0];
    form.value.homeLat = first.lat;
    form.value.homeLng = first.lng;
    hometownDisplayName.value = first.displayName;
  } catch (e: any) {
    geocodeHometownError.value = e.response?.status === 502
      ? 'Dịch vụ geocoding tạm thời không khả dụng'
      : 'Lỗi geocoding';
  } finally {
    geocodingHometown.value = false;
  }
}

async function geocodeCurrent() {
  if (!form.value.address.trim()) return;
  geocodingCurrent.value = true;
  geocodeCurrentError.value = '';
  currentDisplayName.value = '';
  try {
    const res = await geocodeApi.search(form.value.address);
    if (!res.data.length) {
      geocodeCurrentError.value = 'Không tìm thấy địa điểm, thử từ khóa khác';
      return;
    }
    const first = res.data[0];
    form.value.currentLat = first.lat;
    form.value.currentLng = first.lng;
    currentDisplayName.value = first.displayName;
  } catch (e: any) {
    geocodeCurrentError.value = e.response?.status === 502
      ? 'Dịch vụ geocoding tạm thời không khả dụng'
      : 'Lỗi geocoding';
  } finally {
    geocodingCurrent.value = false;
  }
}

// Cập nhật toạ độ khi người dùng kéo pin; xoá displayName vì vị trí đã thay đổi, không còn khớp
function onHometownMarkerMove(event: any) {
  const { lat, lng } = event.target.getLatLng();
  form.value.homeLat = lat;
  form.value.homeLng = lng;
  hometownDisplayName.value = '';
}

function onCurrentMarkerMove(event: any) {
  const { lat, lng } = event.target.getLatLng();
  form.value.currentLat = lat;
  form.value.currentLng = lng;
  currentDisplayName.value = '';
}

async function handleSubmit() {
  loading.value = true; error.value = '';
  try {
    // Xây dựng fields cấp quyền theo 3 quy tắc phân quyền khác nhau:
    //   self-edit  → role không được đổi, chỉ có thể thay đổi mật khẩu
    //   admin      → có thể đặt bất kỳ role và mật khẩu nào
    //   editor     → chỉ cấp được quyền viewer, không có trường mật khẩu
    let grantAccess: boolean | undefined;
    let grantRole: string | undefined;
    let grantPassword: string | undefined;

    if (isSelfEdit.value) {
      grantAccess = form.value.grantAccess;
      grantRole   = form.value.grantAccess ? form.value.grantRole : undefined;
      grantPassword = (form.value.grantAccess && form.value.grantPassword) ? form.value.grantPassword : undefined;
    } else if (isAdmin.value) {
      grantAccess   = form.value.grantAccess;
      grantRole     = form.value.grantAccess ? form.value.grantRole : undefined;
      grantPassword = (form.value.grantAccess && (form.value.grantRole === 'admin' || form.value.grantRole === 'editor') && form.value.grantPassword)
        ? form.value.grantPassword : undefined;
    } else {
      grantAccess   = form.value.grantAccess || undefined;
      grantRole     = form.value.grantAccess ? 'viewer' : undefined;
      grantPassword = undefined;
    }

    const payload = {
      ...form.value,
      birthDate: form.value.birthDate || undefined,
      // Parse "YYYY-MM-DD" → 3 field số riêng để backend lưu
      ...(() => {
        const d = form.value.deathLunarDate;
        if (!d) return { deathLunarYear: null, deathLunarMonth: null, deathLunarDay: null };
        const [y, m, dd] = d.split('-').map(Number);
        return { deathLunarYear: y || null, deathLunarMonth: m || null, deathLunarDay: dd || null };
      })(),
      phone: form.value.phone || undefined,
      email: form.value.email || undefined,
      nickname: form.value.nickname || undefined,
      address: form.value.address,
      bio: form.value.bio || undefined,
      hometown: form.value.hometown,
      homeLat: form.value.homeLat,
      homeLng: form.value.homeLng,
      currentLat: form.value.currentLat,
      currentLng: form.value.currentLng,
      grantAccess,
      grantRole,
      grantPassword,
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
    // 'asParentOf' xử lý riêng: người mới là bố/mẹ nên chiều edge bị đảo ngược
    // (newPerson → existingPerson) và không được handleRelationships bao phủ
    if (!props.editPerson && props.preRelation?.type === 'asParentOf') {
      await relationshipsApi.create({ personAId: savedId, personBId: props.preRelation.personId, type: 'parent_child' });
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
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 9000; display: flex; align-items: center; justify-content: center; padding: 16px; }
.pf-dialog { background: #ffffff; border: 1px solid #d0d7de; border-radius: 12px; padding: 28px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; box-shadow: 0 8px 24px rgba(140,149,159,0.2); }
.pf-dialog-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.pf-dialog-header h2 { margin: 0; }
.pf-dialog-close { background: none; border: none; color: #57606a; font-size: 18px; cursor: pointer; padding: 2px 6px; border-radius: 4px; line-height: 1; }
.pf-dialog-close:hover { background: #f6f8fa; color: #24292f; }
h2 { font-size: 1.1rem; color: #24292f; font-weight: 700; margin: 0; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.full-width { grid-column: 1 / -1; }
.section-title { font-size: 11px; font-weight: 600; color: #57606a; text-transform: uppercase; letter-spacing: 0.5px; padding-top: 8px; border-top: 1px solid #d0d7de; margin-top: 4px; }
label { font-size: 12px; color: #57606a; font-weight: 500; }
input, select, textarea { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: 8px 10px; color: #24292f; font-size: 13px; width: 100%; box-sizing: border-box; }
.locked-field { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: 7px 10px; font-size: 13px; color: #57606a; }
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
.self-role-info { font-size: 13px; color: #24292f; }
.role-note { font-size: 11px; color: #57606a; }
.mt-6 { margin-top: 6px; }

@media (max-width: 560px) {
  .pf-dialog { padding: 18px; }
  .form-grid { grid-template-columns: 1fr; }
  .full-width { grid-column: 1; }
}
.buttons { display: flex; gap: 10px; justify-content: flex-end; }
.buttons button { padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
.buttons button[type=button] { background: #f6f8fa; border: 1px solid #d0d7de; color: #24292f; }
.buttons button[type=button]:hover { background: #eaeef2; }
.buttons button[type=submit] { background: #2da44e; border: 1px solid #2da44e; color: #fff; }
.buttons button[type=submit]:hover { background: #2c974b; }
.buttons button:disabled { opacity: 0.6; cursor: not-allowed; }
.error { color: #cf222e; font-size: 12px; }
.location-section { display: flex; flex-direction: column; gap: 16px; }
.loc-block { display: flex; flex-direction: column; gap: 6px; }
.loc-label { font-size: 11px; font-weight: 600; color: #57606a; text-transform: uppercase; letter-spacing: 0.4px; }
.loc-row { display: flex; gap: 6px; align-items: center; }
.loc-input { flex: 1; height: 32px; padding: 0 8px; border: 1px solid #d0d7de; border-radius: 6px; font-size: 13px; }
.loc-input:focus { outline: none; border-color: #0969da; box-shadow: 0 0 0 3px rgba(9,105,218,0.1); }
.btn-geocode { padding: 5px 10px; background: #0969da; color: #fff; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; white-space: nowrap; }
.btn-geocode:hover:not(:disabled) { background: #0860ca; }
.btn-geocode:disabled { background: #8c959f; cursor: default; }
.btn-clear-loc { padding: 5px 8px; background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; font-size: 12px; cursor: pointer; color: #57606a; }
.btn-clear-loc:hover { background: #ffebe9; border-color: #ffcecb; color: #cf222e; }
.geocode-error { font-size: 11px; color: #cf222e; }
.mini-map-wrap { border: 1px solid #54aeff; border-radius: 6px; overflow: hidden; }
.mini-map-info { padding: 4px 8px; background: #f0f9ff; border-top: 1px solid #54aeff; font-size: 11px; color: #0969da; display: flex; justify-content: space-between; align-items: center; }
.mini-map-display { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 75%; }
.drag-hint { color: #57606a; font-style: italic; flex-shrink: 0; }
</style>
