<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="add-modal">
      <button class="close-btn" @click="$emit('close')">✕</button>
      <h3>Thêm media vào album</h3>

      <div class="tabs" v-if="personId">
        <button :class="['tab', { active: activeTab === 'upload' }]" @click="activeTab = 'upload'">Upload mới</button>
        <button :class="['tab', { active: activeTab === 'select' }]" @click="activeTab = 'select'">Chọn từ media có sẵn</button>
      </div>

      <!-- Tab 1: Upload mới -->
      <div v-if="activeTab === 'upload'">
        <div v-if="!uploading && !uploadDone">
          <div class="file-area" @click="fileInput?.click()" @dragover.prevent @drop.prevent="onDrop">
            <span v-if="!selectedFile">Chọn hoặc kéo file vào đây<br /><small>Ảnh ≤ 10MB · Video ≤ 50MB · PDF ≤ 20MB</small></span>
            <span v-else class="file-name">{{ selectedFile.name }}</span>
          </div>
          <input ref="fileInput" type="file" accept="image/*,video/*,application/pdf" class="hidden-input" @change="onFileChange" />
          <input v-model="caption" type="text" placeholder="Ghi chú (tuỳ chọn)" class="caption-input" maxlength="200" />
          <div v-if="sizeError" class="error-msg">{{ sizeError }}</div>
          <button class="btn-action" :disabled="!selectedFile || !!sizeError" @click="uploadFile">Tải lên</button>
        </div>
        <div v-if="uploading" class="status-msg">Đang tải lên...</div>
        <div v-if="uploadDone" class="success-msg">Đã thêm — media đang chờ admin duyệt<br /><button class="btn-action" @click="$emit('close')">Đóng</button></div>
        <div v-if="uploadError" class="error-msg">{{ uploadError }}</div>
      </div>

      <!-- Tab 2: Chọn từ media có sẵn -->
      <div v-if="activeTab === 'select'">
        <div v-if="loadingMedia" class="status-msg">Đang tải media...</div>
        <div v-else-if="availableMedia.length === 0" class="status-msg">Không có media APPROVED nào để chọn.</div>
        <div v-else>
          <div class="select-grid">
            <div
              v-for="m in availableMedia"
              :key="m.id"
              :class="['select-item', { selected: selectedIds.has(m.id) }]"
              @click="toggleSelect(m.id)"
            >
              <img v-if="m.resourceType !== 'RAW'" :src="thumbUrl(m)" alt="" class="select-thumb" />
              <div v-else class="select-pdf">📄</div>
              <div v-if="selectedIds.has(m.id)" class="check">✓</div>
            </div>
          </div>
          <div v-if="selectError" class="error-msg">{{ selectError }}</div>
          <button class="btn-action" :disabled="selectedIds.size === 0 || adding" @click="addSelected">
            {{ adding ? 'Đang thêm...' : `Thêm ${selectedIds.size} mục` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { mediaApi, albumsApi } from '../api';

const props = defineProps<{
  albumId: string;
  personId?: string;
  existingMediaIds: string[];
}>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'added'): void }>();

const activeTab = ref<'upload' | 'select'>('upload');
const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const caption = ref('');
const sizeError = ref('');
const uploadError = ref('');
const uploading = ref(false);
const uploadDone = ref(false);

const loadingMedia = ref(false);
const availableMedia = ref<any[]>([]);
const selectedIds = ref(new Set<string>());
const adding = ref(false);
const selectError = ref('');

const SIZE_LIMITS: Record<string, number> = {
  image: 10 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  raw: 20 * 1024 * 1024,
};

function getResourceType(file: File): 'image' | 'video' | 'raw' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'raw';
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) selectFile(file);
}

function onDrop(e: DragEvent) {
  const file = e.dataTransfer?.files?.[0];
  if (file) selectFile(file);
}

function selectFile(file: File) {
  selectedFile.value = file;
  const rt = getResourceType(file);
  const limit = SIZE_LIMITS[rt];
  sizeError.value = file.size > limit ? `File quá lớn. Giới hạn: ${Math.round(limit / 1024 / 1024)}MB` : '';
  uploadError.value = '';
}

async function uploadFile() {
  if (!selectedFile.value || sizeError.value) return;
  uploading.value = true;
  uploadError.value = '';
  const file = selectedFile.value;
  const resourceType = getResourceType(file);

  try {
    const signRes = await mediaApi.sign({ resourceType, albumId: props.albumId });
    const { signature, timestamp, apiKey, cloudName, folder } = signRes.data;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('signature', signature);
    formData.append('timestamp', String(timestamp));
    formData.append('api_key', apiKey);
    formData.append('folder', folder);

    let cloudResult: any;
    try {
      const cloudRes = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
        formData
      );
      cloudResult = cloudRes.data;
    } catch {
      uploadError.value = 'Tải lên Cloudinary thất bại. Vui lòng thử lại.';
      uploading.value = false;
      return;
    }

    const { public_id, secure_url, format, bytes } = cloudResult;
    const enumType = resourceType === 'image' ? 'IMAGE' : resourceType === 'video' ? 'VIDEO' : 'RAW';
    try {
      await albumsApi.addMedia(props.albumId, {
        cloudinaryId: public_id,
        url: secure_url,
        resourceType: enumType,
        format,
        bytes,
        caption: caption.value || undefined,
      });
    } catch {
      uploadError.value = 'Tải lên thành công nhưng không lưu được — vui lòng thử lại.';
      uploading.value = false;
      return;
    }

    uploading.value = false;
    uploadDone.value = true;
    emit('added');
  } catch {
    uploadError.value = 'Đã có lỗi xảy ra. Vui lòng thử lại.';
    uploading.value = false;
  }
}

onMounted(async () => {
  if (props.personId) {
    loadingMedia.value = true;
    try {
      const res = await mediaApi.listByPerson(props.personId);
      const all: any[] = res.data.data ?? res.data;
      availableMedia.value = all.filter(
        m => m.status === 'APPROVED' && !props.existingMediaIds.includes(m.id)
      );
    } finally {
      loadingMedia.value = false;
    }
  }
});

function thumbUrl(m: any) {
  if (m.resourceType === 'IMAGE') return m.url.replace('/upload/', '/upload/w_120,h_120,c_fill,f_auto/');
  return m.url.replace('/upload/', '/upload/w_120,h_120,c_fill,so_auto,f_jpg/').replace(/\.[^.]+$/, '.jpg');
}

function toggleSelect(id: string) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id);
  } else {
    selectedIds.value.add(id);
  }
  selectedIds.value = new Set(selectedIds.value);
}

async function addSelected() {
  if (selectedIds.value.size === 0) return;
  adding.value = true;
  selectError.value = '';
  try {
    for (const mediaId of selectedIds.value) {
      await albumsApi.addMedia(props.albumId, { mediaId });
    }
    emit('added');
    emit('close');
  } catch (e: any) {
    selectError.value = e.response?.data?.error ?? 'Lỗi khi thêm media.';
  } finally {
    adding.value = false;
  }
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 200; display: flex; align-items: center; justify-content: center; }
.add-modal { background: #fff; border-radius: 12px; padding: 28px; width: 480px; max-width: 94vw; max-height: 85vh; overflow-y: auto; position: relative; }
.close-btn { position: absolute; top: 12px; right: 12px; background: none; border: none; font-size: 18px; cursor: pointer; color: #57606a; }
h3 { margin: 0 0 16px; font-size: 16px; color: #24292f; }
.tabs { display: flex; gap: 0; margin-bottom: 16px; border-bottom: 1px solid #d0d7de; }
.tab { padding: 8px 16px; background: none; border: none; border-bottom: 2px solid transparent; font-size: 13px; cursor: pointer; color: #57606a; }
.tab.active { color: #0969da; border-bottom-color: #0969da; font-weight: 600; }
.file-area { border: 2px dashed #d0d7de; border-radius: 8px; padding: 28px 16px; text-align: center; cursor: pointer; font-size: 14px; color: #57606a; margin-bottom: 12px; }
.file-area:hover { border-color: #0969da; background: #f6f8fa; }
.file-name { color: #24292f; font-weight: 500; }
small { display: block; margin-top: 6px; font-size: 11px; color: #8c959f; }
.hidden-input { display: none; }
.caption-input { width: 100%; box-sizing: border-box; border: 1px solid #d0d7de; border-radius: 6px; padding: 8px 10px; font-size: 13px; margin-bottom: 12px; outline: none; }
.caption-input:focus { border-color: #0969da; }
.btn-action { width: 100%; padding: 10px; background: #0969da; color: #fff; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; margin-top: 4px; }
.btn-action:disabled { background: #8c959f; cursor: not-allowed; }
.btn-action:hover:not(:disabled) { background: #0860ca; }
.error-msg { color: #cf222e; font-size: 13px; margin: 8px 0; }
.status-msg { text-align: center; color: #57606a; padding: 20px; }
.success-msg { text-align: center; color: #2da44e; font-size: 14px; padding: 12px 0; line-height: 1.8; }
.select-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 8px; margin-bottom: 12px; max-height: 320px; overflow-y: auto; }
.select-item { position: relative; aspect-ratio: 1; border: 2px solid #d0d7de; border-radius: 6px; overflow: hidden; cursor: pointer; }
.select-item.selected { border-color: #0969da; }
.select-item:hover { border-color: #54aeff; }
.select-thumb { width: 100%; height: 100%; object-fit: cover; display: block; }
.select-pdf { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 28px; background: #f6f8fa; }
.check { position: absolute; inset: 0; background: rgba(9,105,218,0.35); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 24px; font-weight: 700; }
</style>
