<template>
  <div class="media-page">
    <div class="header">
      <router-link to="/" class="back-link">← Về trang chủ</router-link>
      <h1 v-if="relInfo">
        🖼 {{ relInfo.personA.fullName }} ↔ {{ relInfo.personB.fullName }}
        <span class="rel-type">{{ relInfo.type === 'spouse' ? '💍' : '👨‍👩‍👧' }}</span>
      </h1>
      <h1 v-else>🖼 Đang tải...</h1>
      <button v-if="auth.token" class="btn-add" @click="showUpload = true">+ Thêm media</button>
    </div>

    <div v-if="loading" class="loading">Đang tải...</div>
    <div v-else-if="mediaList.length === 0" class="empty">Chưa có media nào.</div>

    <div v-else class="grid">
      <div
        v-for="item in mediaList"
        :key="item.id"
        class="grid-item"
        :class="{ pending: item.status === 'PENDING', rejected: item.status === 'REJECTED' }"
      >
        <div class="thumb-wrap" @click="openViewer(item)">
          <img v-if="item.resourceType !== 'RAW'" :src="thumbUrl(item)" :alt="item.caption || ''" class="thumb" />
          <div v-else class="pdf-thumb">📄</div>
          <div v-if="item.status === 'PENDING'" class="status-badge pending-badge">Chờ duyệt</div>
          <div v-if="item.status === 'REJECTED'" class="status-badge rejected-badge">Đã từ chối</div>
        </div>

        <div v-if="isPrivileged && item.status === 'PENDING'" class="mod-actions">
          <button class="btn-approve" @click.stop="moderateItem(item.id, 'APPROVED')">✓ Duyệt</button>
          <button class="btn-reject" @click.stop="moderateItem(item.id, 'REJECTED')">✗ Từ chối</button>
        </div>
      </div>
    </div>

    <MediaUploadModal
      v-if="showUpload"
      :personId="''"
      :relationshipId="relationshipId"
      @close="showUpload = false"
      @uploaded="onUploaded"
    />

    <MediaViewer
      v-if="viewerMedia"
      :media="viewerMedia"
      @close="viewerMedia = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '../stores/auth';
import { mediaApi, relationshipsApi } from '../api';
import MediaUploadModal from '../components/MediaUploadModal.vue';
import MediaViewer from '../components/MediaViewer.vue';

const route = useRoute();
const router = useRouter();
const relationshipId = route.params.id as string;

const auth = useAuthStore();
const { isAdmin, isEditor } = storeToRefs(auth);
const isPrivileged = computed(() => isAdmin.value || isEditor.value);

const relInfo = ref<any>(null);
const mediaList = ref<any[]>([]);
const loading = ref(true);
const showUpload = ref(false);
const viewerMedia = ref<any>(null);

onMounted(async () => {
  try {
    const [relRes, mediaRes] = await Promise.all([
      relationshipsApi.get(relationshipId),
      mediaApi.listByRelationship(relationshipId),
    ]);
    relInfo.value = relRes.data;
    mediaList.value = mediaRes.data.data;
  } catch {
    router.push('/');
  } finally {
    loading.value = false;
  }
});

function thumbUrl(item: any): string {
  if (item.resourceType === 'IMAGE') {
    return item.url.replace('/upload/', '/upload/w_300,h_300,c_fill,f_auto/');
  }
  return item.url
    .replace('/upload/', '/upload/w_300,h_300,c_fill,so_auto,f_jpg/')
    .replace(/\.[^.]+$/, '.jpg');
}

function openViewer(item: any) {
  viewerMedia.value = item;
}

async function moderateItem(mediaId: string, status: 'APPROVED' | 'REJECTED') {
  await mediaApi.updateStatus(mediaId, status);
  const item = mediaList.value.find((m: any) => m.id === mediaId);
  if (item) item.status = status;
}

async function onUploaded() {
  showUpload.value = false;
  const res = await mediaApi.listByRelationship(relationshipId);
  mediaList.value = res.data.data;
}
</script>

<style scoped>
.media-page { max-width: 960px; margin: 0 auto; padding: 24px 16px; }
.header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
.back-link { color: #0969da; text-decoration: none; font-size: 14px; }
.back-link:hover { text-decoration: underline; }
h1 { flex: 1; font-size: 1.3rem; color: #24292f; margin: 0; }
.rel-type { font-size: 1rem; margin-left: 6px; }
.btn-add { padding: 7px 16px; background: #0969da; color: #fff; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; }
.btn-add:hover { background: #0860ca; }
.loading, .empty { text-align: center; color: #57606a; padding: 48px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.grid-item { border-radius: 8px; overflow: hidden; border: 1px solid #d0d7de; background: #f6f8fa; }
.grid-item.pending { border-color: #d4a72c; }
.grid-item.rejected { opacity: 0.55; }
.thumb-wrap { position: relative; cursor: pointer; aspect-ratio: 1; overflow: hidden; }
.thumb { width: 100%; height: 100%; object-fit: cover; display: block; }
.thumb-wrap:hover .thumb { opacity: 0.85; }
.pdf-thumb { width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 48px; cursor: pointer; }
.status-badge { position: absolute; bottom: 6px; left: 6px; font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 10px; }
.pending-badge { background: #fff8c5; color: #9a6700; }
.rejected-badge { background: #ffebe9; color: #cf222e; }
.mod-actions { display: flex; gap: 4px; padding: 6px; background: #fff8c5; }
.btn-approve { flex: 1; background: #2da44e; color: #fff; border: none; border-radius: 4px; padding: 4px; font-size: 11px; cursor: pointer; }
.btn-approve:hover { background: #2c974b; }
.btn-reject { flex: 1; background: #cf222e; color: #fff; border: none; border-radius: 4px; padding: 4px; font-size: 11px; cursor: pointer; }
.btn-reject:hover { background: #a40e26; }
</style>
