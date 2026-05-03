<template>
  <div class="album-page">
    <div v-if="loading" class="loading">Đang tải...</div>
    <template v-else-if="album">
      <div class="header">
        <router-link to="/albums" class="back-link">← Albums</router-link>
        <div class="title-row">
          <template v-if="!editing">
            <h1>{{ album.title }}</h1>
            <span v-if="album.status === 'PENDING'" class="status-badge pending">Chờ duyệt</span>
            <span v-if="album.status === 'REJECTED'" class="status-badge rejected">Từ chối</span>
          </template>
          <template v-else>
            <input v-model="editTitle" class="edit-title-input" />
          </template>
        </div>
        <p v-if="album.description && !editing" class="description">{{ album.description }}</p>
        <textarea v-if="editing" v-model="editDescription" class="edit-desc-input" rows="2" />
        <router-link v-if="album.person" to="/" class="person-link">👤 {{ album.person.fullName }}</router-link>

        <div class="actions">
          <button v-if="auth.token" class="btn-add" @click="showAddMedia = true">+ Thêm media</button>
          <template v-if="isAdmin && album.status === 'PENDING'">
            <button class="btn-approve" @click="moderate('APPROVED')">✓ Duyệt</button>
            <button class="btn-reject" @click="moderate('REJECTED')">✗ Từ chối</button>
          </template>
          <template v-if="canEdit && !editing">
            <button class="btn-edit" @click="startEdit">✏️ Sửa</button>
          </template>
          <template v-if="editing">
            <button class="btn-save" @click="saveEdit">Lưu</button>
            <button class="btn-cancel" @click="editing = false">Hủy</button>
          </template>
        </div>
      </div>

      <div v-if="album.items.length === 0" class="empty">Chưa có media nào trong album này.</div>
      <div v-else class="grid">
        <div
          v-for="item in album.items"
          :key="item.mediaId"
          class="grid-item"
          :class="{ pending: item.media.status === 'PENDING', rejected: item.media.status === 'REJECTED' }"
        >
          <div class="thumb-wrap" @click="viewerMedia = item.media">
            <img v-if="item.media.resourceType !== 'RAW'" :src="thumbUrl(item.media)" alt="" class="thumb" />
            <div v-else class="pdf-thumb">📄</div>
            <div v-if="item.media.status === 'PENDING'" class="media-badge pending">Chờ duyệt</div>
            <div v-if="item.media.status === 'REJECTED'" class="media-badge rejected">Từ chối</div>
          </div>
          <button v-if="canRemoveMedia(item)" class="btn-remove" @click.stop="removeMedia(item.mediaId)">✕</button>
        </div>
      </div>
    </template>

    <AlbumMediaAddModal
      v-if="showAddMedia"
      :album-id="albumId"
      :person-id="album?.personId ?? undefined"
      :existing-media-ids="existingMediaIds"
      @close="showAddMedia = false"
      @added="onMediaAdded"
    />
    <MediaViewer v-if="viewerMedia" :media="viewerMedia" @close="viewerMedia = null" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '../stores/auth';
import { albumsApi } from '../api';
import AlbumMediaAddModal from '../components/AlbumMediaAddModal.vue';
import MediaViewer from '../components/MediaViewer.vue';

const route = useRoute();
const router = useRouter();
const albumId = route.params.id as string;

const auth = useAuthStore();
const { isAdmin, isEditor } = storeToRefs(auth);

const album = ref<any>(null);
const loading = ref(true);
const viewerMedia = ref<any>(null);
const showAddMedia = ref(false);
const editing = ref(false);
const editTitle = ref('');
const editDescription = ref('');

const canEdit = computed(() =>
  isAdmin.value || isEditor.value || album.value?.createdBy === auth.userPhone
);

const existingMediaIds = computed(() =>
  (album.value?.items ?? []).map((i: any) => i.mediaId)
);

function canRemoveMedia(item: any) {
  return isAdmin.value || isEditor.value ||
    album.value?.createdBy === auth.userPhone ||
    item.media.uploadedBy === auth.userPhone;
}

onMounted(async () => {
  try {
    const res = await albumsApi.get(albumId);
    album.value = res.data;
  } catch {
    router.push('/albums');
  } finally {
    loading.value = false;
  }
});

function thumbUrl(media: any) {
  if (media.resourceType === 'IMAGE') {
    return media.url.replace('/upload/', '/upload/w_300,h_300,c_fill,f_auto/');
  }
  return media.url
    .replace('/upload/', '/upload/w_300,h_300,c_fill,so_auto,f_jpg/')
    .replace(/\.[^.]+$/, '.jpg');
}

function startEdit() {
  editTitle.value = album.value.title;
  editDescription.value = album.value.description ?? '';
  editing.value = true;
}

async function saveEdit() {
  await albumsApi.update(albumId, { title: editTitle.value, description: editDescription.value });
  album.value.title = editTitle.value;
  album.value.description = editDescription.value;
  editing.value = false;
}

async function moderate(status: 'APPROVED' | 'REJECTED') {
  await albumsApi.updateStatus(albumId, status);
  album.value.status = status;
}

async function removeMedia(mediaId: string) {
  await albumsApi.removeMedia(albumId, mediaId);
  album.value.items = album.value.items.filter((i: any) => i.mediaId !== mediaId);
}

async function onMediaAdded() {
  const res = await albumsApi.get(albumId);
  album.value = res.data;
}
</script>

<style scoped>
.album-page { max-width: 960px; margin: 0 auto; padding: 24px 16px; }
.header { margin-bottom: 24px; }
.back-link { color: #0969da; text-decoration: none; font-size: 14px; display: inline-block; margin-bottom: 12px; }
.back-link:hover { text-decoration: underline; }
.title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
h1 { font-size: 1.4rem; color: #24292f; margin: 0; }
.status-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; }
.status-badge.pending { background: #fff8c5; color: #9a6700; }
.status-badge.rejected { background: #ffebe9; color: #cf222e; }
.description { color: #57606a; font-size: 13px; margin: 6px 0; line-height: 1.5; }
.person-link { display: inline-block; color: #0969da; text-decoration: none; font-size: 13px; margin-bottom: 12px; }
.person-link:hover { text-decoration: underline; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.btn-add { padding: 7px 14px; background: #0969da; color: #fff; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; }
.btn-add:hover { background: #0860ca; }
.btn-approve { background: #2da44e; color: #fff; border: none; border-radius: 6px; padding: 7px 12px; font-size: 13px; cursor: pointer; }
.btn-approve:hover { background: #2c974b; }
.btn-reject { background: #cf222e; color: #fff; border: none; border-radius: 6px; padding: 7px 12px; font-size: 13px; cursor: pointer; }
.btn-reject:hover { background: #a40e26; }
.btn-edit { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: 7px 12px; font-size: 13px; cursor: pointer; }
.btn-edit:hover { background: #eaeef2; }
.btn-save { background: #0969da; color: #fff; border: none; border-radius: 6px; padding: 7px 14px; font-size: 13px; cursor: pointer; }
.btn-cancel { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: 7px 12px; font-size: 13px; cursor: pointer; }
.edit-title-input { font-size: 1.4rem; font-weight: 700; border: 1px solid #0969da; border-radius: 6px; padding: 4px 8px; flex: 1; outline: none; }
.edit-desc-input { width: 100%; border: 1px solid #d0d7de; border-radius: 6px; padding: 8px 10px; font-size: 13px; resize: vertical; outline: none; margin-bottom: 8px; }
.edit-desc-input:focus { border-color: #0969da; }
.loading, .empty { text-align: center; color: #57606a; padding: 48px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.grid-item { border-radius: 8px; overflow: hidden; border: 1px solid #d0d7de; background: #f6f8fa; position: relative; }
.grid-item.pending { border-color: #d4a72c; }
.grid-item.rejected { opacity: 0.55; }
.thumb-wrap { position: relative; cursor: pointer; aspect-ratio: 1; overflow: hidden; }
.thumb { width: 100%; height: 100%; object-fit: cover; display: block; }
.thumb-wrap:hover .thumb { opacity: 0.85; }
.pdf-thumb { width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 48px; cursor: pointer; }
.media-badge { position: absolute; bottom: 6px; left: 6px; font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 10px; }
.media-badge.pending { background: #fff8c5; color: #9a6700; }
.media-badge.rejected { background: #ffebe9; color: #cf222e; }
.btn-remove { position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.55); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 2; }
.btn-remove:hover { background: #cf222e; }
</style>
