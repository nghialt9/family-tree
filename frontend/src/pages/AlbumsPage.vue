<template>
  <div class="albums-page">
    <div class="header">
      <router-link to="/" class="back-link">← Về trang chủ</router-link>
      <h1>📚 Albums</h1>
      <button v-if="auth.token" class="btn-add" @click="showCreate = true">+ Tạo album</button>
    </div>

    <div v-if="loading" class="loading">Đang tải...</div>
    <div v-else-if="albums.length === 0" class="empty">Chưa có album nào.</div>
    <div v-else class="grid">
      <router-link v-for="a in albums" :key="a.id" :to="`/albums/${a.id}`" class="album-card">
        <div class="cover">
          <img v-if="a.coverMedia?.url" :src="thumbUrl(a.coverMedia.url)" alt="" class="cover-img" />
          <div v-else class="cover-placeholder">📷</div>
          <div v-if="a.status === 'PENDING'" class="status-badge pending">Chờ duyệt</div>
          <div v-if="a.status === 'REJECTED'" class="status-badge rejected">Từ chối</div>
        </div>
        <div class="meta">
          <div class="album-title">{{ a.title }}</div>
          <div v-if="a.person" class="person-name">{{ a.person.fullName }}</div>
          <div class="count">{{ a._count?.items ?? 0 }} mục</div>
        </div>
      </router-link>
    </div>

    <AlbumCreateModal v-if="showCreate" @close="showCreate = false" @created="onCreated" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { albumsApi } from '../api';
import AlbumCreateModal from '../components/AlbumCreateModal.vue';

const auth = useAuthStore();
const albums = ref<any[]>([]);
const loading = ref(true);
const showCreate = ref(false);

onMounted(async () => {
  try {
    const res = await albumsApi.list();
    albums.value = res.data.data;
  } catch {
    // keep albums empty on error
  } finally {
    loading.value = false;
  }
});

function thumbUrl(url: string) {
  return url.replace('/upload/', '/upload/w_400,h_300,c_fill,f_auto/');
}

async function onCreated() {
  showCreate.value = false;
  const res = await albumsApi.list();
  albums.value = res.data.data;
}
</script>

<style scoped>
.albums-page { max-width: 1000px; margin: 0 auto; padding: 24px 16px; }
.header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
.back-link { color: #0969da; text-decoration: none; font-size: 14px; }
.back-link:hover { text-decoration: underline; }
h1 { flex: 1; font-size: 1.3rem; color: #24292f; margin: 0; }
.btn-add { padding: 7px 16px; background: #0969da; color: #fff; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; }
.btn-add:hover { background: #0860ca; }
.loading, .empty { text-align: center; color: #57606a; padding: 48px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.album-card { text-decoration: none; border: 1px solid #d0d7de; border-radius: 8px; overflow: hidden; background: #fff; transition: box-shadow 0.15s; }
.album-card:hover { box-shadow: 0 4px 12px rgba(140,149,159,0.2); }
.cover { position: relative; aspect-ratio: 4/3; background: #f6f8fa; overflow: hidden; }
.cover-img { width: 100%; height: 100%; object-fit: cover; }
.cover-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 48px; color: #d0d7de; }
.status-badge { position: absolute; top: 6px; right: 6px; font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 10px; }
.status-badge.pending { background: #fff8c5; color: #9a6700; }
.status-badge.rejected { background: #ffebe9; color: #cf222e; }
.meta { padding: 10px 12px; }
.album-title { font-size: 14px; font-weight: 600; color: #24292f; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.person-name { font-size: 12px; color: #0969da; margin-bottom: 2px; }
.count { font-size: 11px; color: #57606a; }
</style>
