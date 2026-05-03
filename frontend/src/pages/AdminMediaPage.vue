<template>
  <div class="admin-page">
    <div class="header">
      <router-link to="/" class="back-link">← Về trang chủ</router-link>
      <h1>📋 Duyệt Media <span v-if="total > 0">({{ total }})</span></h1>
    </div>

    <div class="filters">
      <select v-model="statusFilter" @change="fetchMedia(1)">
        <option value="PENDING">Chờ duyệt</option>
        <option value="APPROVED">Đã duyệt</option>
        <option value="REJECTED">Đã từ chối</option>
        <option value="ALL">Tất cả</option>
      </select>
    </div>

    <div v-if="loading" class="loading">Đang tải...</div>
    <div v-else-if="items.length === 0" class="empty">Không có media nào.</div>

    <table v-else class="media-table">
      <thead>
        <tr>
          <th>Preview</th>
          <th>Người</th>
          <th>Loại</th>
          <th>Trạng thái</th>
          <th>Ngày tải</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id">
          <td class="thumb-cell">
            <img v-if="item.resourceType !== 'RAW'" :src="thumbUrl(item)" class="thumb" @click="openViewer(item)" />
            <span v-else class="pdf-icon" @click="openViewer(item)">📄</span>
          </td>
          <td>
            <router-link :to="`/persons/${item.personId}/media`" class="person-link">
              {{ item.person?.fullName ?? '—' }}
            </router-link>
          </td>
          <td>
            <span class="type-badge">{{ item.resourceType }}</span>
          </td>
          <td>
            <span class="status-badge" :class="item.status.toLowerCase()">{{ statusLabel(item.status) }}</span>
          </td>
          <td class="date-cell">{{ formatDate(item.createdAt) }}</td>
          <td>
            <div v-if="item.status === 'PENDING'" class="actions">
              <button class="btn-approve" @click="moderate(item.id, 'APPROVED')">✓ Duyệt</button>
              <button class="btn-reject" @click="moderate(item.id, 'REJECTED')">✗ Từ chối</button>
            </div>
            <span v-else class="no-action">—</span>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-show="totalPages > 1" class="pagination">
      <button :disabled="page === 1" @click="fetchMedia(page - 1)">←</button>
      <span>Trang {{ page }}/{{ totalPages }}</span>
      <button :disabled="page === totalPages" @click="fetchMedia(page + 1)">→</button>
    </div>

    <MediaViewer v-if="viewerMedia" :media="viewerMedia" @close="viewerMedia = null" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { mediaApi } from '../api';
import MediaViewer from '../components/MediaViewer.vue';

const statusFilter = ref('PENDING');
const items = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(true);
const viewerMedia = ref<any>(null);
const LIMIT = 20;

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / LIMIT)));

onMounted(() => fetchMedia(1));

async function fetchMedia(p: number) {
  loading.value = true;
  page.value = p;
  const res = await mediaApi.adminQueue({ status: statusFilter.value, page: p, limit: LIMIT });
  items.value = res.data.data;
  total.value = res.data.total;
  loading.value = false;
}

function thumbUrl(item: any): string {
  if (item.resourceType === 'IMAGE') {
    return item.url.replace('/upload/', '/upload/w_80,h_80,c_fill,f_auto/');
  }
  return item.url
    .replace('/upload/', '/upload/w_80,h_80,c_fill,so_auto,f_jpg/')
    .replace(/\.[^.]+$/, '.jpg');
}

async function moderate(mediaId: string, status: 'APPROVED' | 'REJECTED') {
  await mediaApi.updateStatus(mediaId, status);
  const item = items.value.find((i: any) => i.id === mediaId);
  if (item) item.status = status;
}

function openViewer(item: any) {
  viewerMedia.value = item;
}

function statusLabel(s: string) {
  return s === 'PENDING' ? 'Chờ duyệt' : s === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối';
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
</script>

<style scoped>
.admin-page { max-width: 1000px; margin: 0 auto; padding: 24px 16px; }
.header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.back-link { color: #0969da; text-decoration: none; font-size: 14px; }
.back-link:hover { text-decoration: underline; }
h1 { flex: 1; font-size: 1.3rem; color: #24292f; margin: 0; }
.filters { margin-bottom: 16px; }
.filters select { padding: 6px 10px; border: 1px solid #d0d7de; border-radius: 6px; font-size: 13px; }
.loading, .empty { text-align: center; color: #57606a; padding: 48px; }
.media-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.media-table th { padding: 8px 12px; background: #f6f8fa; border-bottom: 1px solid #d0d7de; text-align: left; color: #57606a; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; }
.media-table td { padding: 8px 12px; border-bottom: 1px solid #eaecef; vertical-align: middle; }
.thumb-cell { width: 72px; }
.thumb { width: 56px; height: 56px; object-fit: cover; border-radius: 4px; cursor: pointer; }
.pdf-icon { font-size: 32px; cursor: pointer; }
.person-link { color: #0969da; text-decoration: none; }
.person-link:hover { text-decoration: underline; }
.type-badge { background: #eaeef2; color: #57606a; border-radius: 8px; padding: 2px 8px; font-size: 11px; font-weight: 600; }
.status-badge { border-radius: 8px; padding: 2px 8px; font-size: 11px; font-weight: 600; }
.status-badge.pending { background: #fff8c5; color: #9a6700; }
.status-badge.approved { background: #dafbe1; color: #116329; }
.status-badge.rejected { background: #ffebe9; color: #cf222e; }
.date-cell { color: #57606a; white-space: nowrap; }
.actions { display: flex; gap: 4px; }
.btn-approve { background: #2da44e; color: #fff; border: none; border-radius: 4px; padding: 4px 10px; font-size: 12px; cursor: pointer; }
.btn-approve:hover { background: #2c974b; }
.btn-reject { background: #cf222e; color: #fff; border: none; border-radius: 4px; padding: 4px 10px; font-size: 12px; cursor: pointer; }
.btn-reject:hover { background: #a40e26; }
.no-action { color: #8c959f; }
.pagination { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 24px; font-size: 14px; color: #57606a; }
.pagination button { padding: 6px 14px; border: 1px solid #d0d7de; border-radius: 6px; background: #f6f8fa; cursor: pointer; }
.pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
.pagination button:hover:not(:disabled) { background: #eaeef2; }
</style>
