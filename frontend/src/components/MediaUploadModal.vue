<template>
  <div class="modal-overlay" @click.self="close">
    <div class="upload-modal">
      <button class="close-btn" @click="close">✕</button>
      <h3>Tải lên media</h3>

      <div v-if="!uploading && !done">
        <div class="file-area" @click="fileInput?.click()" @dragover.prevent @drop.prevent="onDrop">
          <span v-if="!selectedFile">Chọn hoặc kéo file vào đây<br/><small>Ảnh ≤ 10MB · Video ≤ 50MB · PDF ≤ 20MB</small></span>
          <span v-else class="file-name">{{ selectedFile.name }}</span>
        </div>
        <input ref="fileInput" type="file" accept="image/*,video/*,application/pdf" class="hidden-input" @change="onFileChange" />

        <input v-model="caption" type="text" placeholder="Ghi chú (tuỳ chọn)" class="caption-input" maxlength="200" />

        <div v-if="sizeError" class="error-msg">{{ sizeError }}</div>

        <button class="btn-upload" :disabled="!selectedFile || !!sizeError" @click="upload">
          Tải lên
        </button>
      </div>

      <div v-if="uploading" class="uploading">Đang tải lên...</div>

      <div v-if="done" class="done-msg">
        Đã tải lên — đang chờ admin duyệt
        <br/>
        <button class="btn-upload" @click="close">Đóng</button>
      </div>

      <div v-if="uploadError" class="error-msg">{{ uploadError }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';
import { mediaApi } from '../api';

const props = defineProps<{ personId: string }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'uploaded'): void }>();

const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const caption = ref('');
const sizeError = ref('');
const uploadError = ref('');
const uploading = ref(false);
const done = ref(false);

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

function validateFile(file: File): string {
  const rt = getResourceType(file);
  const limit = SIZE_LIMITS[rt];
  if (file.size > limit) {
    const mb = Math.round(limit / 1024 / 1024);
    return `File quá lớn. Giới hạn ${rt === 'image' ? 'ảnh' : rt === 'video' ? 'video' : 'PDF'}: ${mb}MB`;
  }
  return '';
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
  sizeError.value = validateFile(file);
  uploadError.value = '';
}

function close() {
  emit('close');
}

async function upload() {
  if (!selectedFile.value || sizeError.value) return;

  uploading.value = true;
  uploadError.value = '';

  const file = selectedFile.value;
  const resourceType = getResourceType(file);

  try {
    // Step 1: Get upload signature from our backend
    const signRes = await mediaApi.sign({ resourceType, personId: props.personId });
    const { signature, timestamp, apiKey, cloudName, folder } = signRes.data;

    // Step 2: Upload directly to Cloudinary (must use raw axios, not api instance)
    const formData = new FormData();
    formData.append('file', file);
    formData.append('signature', signature);
    formData.append('timestamp', String(timestamp));
    formData.append('api_key', apiKey);
    formData.append('folder', folder);

    let cloudinaryResult: any;
    try {
      const cloudRes = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
        formData
      );
      cloudinaryResult = cloudRes.data;
    } catch {
      uploadError.value = 'Tải lên Cloudinary thất bại. Vui lòng thử lại.';
      uploading.value = false;
      return;
    }

    // Step 3: Register the upload with our backend
    const { public_id, secure_url, format, bytes } = cloudinaryResult;
    const enumType = resourceType === 'image' ? 'IMAGE' : resourceType === 'video' ? 'VIDEO' : 'RAW';

    try {
      await mediaApi.confirmUpload(props.personId, {
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
    done.value = true;
    emit('uploaded');
  } catch {
    uploadError.value = 'Đã có lỗi xảy ra. Vui lòng thử lại.';
    uploading.value = false;
  }
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 200; display: flex; align-items: center; justify-content: center; }
.upload-modal { background: #fff; border-radius: 12px; padding: 28px; width: 400px; max-width: 92vw; position: relative; }
.close-btn { position: absolute; top: 12px; right: 12px; background: none; border: none; font-size: 18px; cursor: pointer; color: #57606a; }
h3 { margin: 0 0 18px; font-size: 16px; color: #24292f; }
.file-area { border: 2px dashed #d0d7de; border-radius: 8px; padding: 32px 16px; text-align: center; cursor: pointer; font-size: 14px; color: #57606a; margin-bottom: 12px; }
.file-area:hover { border-color: #0969da; background: #f6f8fa; }
.file-name { color: #24292f; font-weight: 500; }
small { display: block; margin-top: 6px; font-size: 11px; color: #8c959f; }
.hidden-input { display: none; }
.caption-input { width: 100%; box-sizing: border-box; border: 1px solid #d0d7de; border-radius: 6px; padding: 8px 10px; font-size: 13px; margin-bottom: 12px; }
.caption-input:focus { outline: none; border-color: #0969da; }
.btn-upload { width: 100%; padding: 10px; background: #0969da; color: #fff; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; margin-top: 4px; }
.btn-upload:disabled { background: #8c959f; cursor: not-allowed; }
.btn-upload:hover:not(:disabled) { background: #0860ca; }
.error-msg { color: #cf222e; font-size: 13px; margin: 8px 0; }
.uploading { text-align: center; color: #57606a; padding: 20px; }
.done-msg { text-align: center; color: #2da44e; font-size: 14px; padding: 12px 0; line-height: 1.8; }
</style>
