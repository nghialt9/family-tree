<template>
  <div class="audit-page">
    <div class="audit-header">
      <router-link to="/" class="back-link">← Về trang chủ</router-link>
      <h1 class="audit-title">📋 Audit Log</h1>
    </div>

    <div class="filters">
      <select v-model="filters.action" class="filter-select">
        <option value="">Tất cả hành động</option>
        <option value="CREATE">CREATE</option>
        <option value="UPDATE">UPDATE</option>
        <option value="DELETE">DELETE</option>
      </select>
      <select v-model="filters.entityType" class="filter-select">
        <option value="">Tất cả loại</option>
        <option value="PERSON">Person</option>
        <option value="RELATIONSHIP">Relationship</option>
      </select>
      <input type="date" v-model="filters.from" class="filter-date" />
      <input type="date" v-model="filters.to" class="filter-date" />
      <input
        type="text"
        v-model="filters.search"
        placeholder="🔍 Tìm tên..."
        class="filter-search"
      />
      <button class="btn-reset" @click="resetFilters">Reset</button>
    </div>

    <div class="table-wrap">
      <div v-if="loading" class="table-loading">Đang tải...</div>
      <table v-else class="audit-table">
        <thead>
          <tr>
            <th>Thời gian</th>
            <th>Actor</th>
            <th>Hành động</th>
            <th>Loại</th>
            <th>Tên entity</th>
            <th>Diff</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id">
            <td class="col-time">{{ formatDate(log.createdAt) }}</td>
            <td class="col-actor">{{ log.actorPhone }}</td>
            <td class="col-action">
              <span :class="['badge', log.action.toLowerCase()]">{{ log.action }}</span>
            </td>
            <td class="col-type">{{ log.entityType }}</td>
            <td class="col-label">{{ log.entityLabel }}</td>
            <td class="col-diff">
              <button
                v-if="log.beforeJson || log.afterJson"
                class="btn-diff"
                @click="diffEntry = log"
              >👁</button>
            </td>
          </tr>
          <tr v-if="logs.length === 0">
            <td colspan="6" class="empty-state">Chưa có hoạt động nào</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pagination" v-show="!loading">
      <button class="btn-page" :disabled="page <= 1" @click="page--">← Trước</button>
      <span class="page-info">Trang {{ page }} / {{ totalPages }}</span>
      <button class="btn-page" :disabled="page >= totalPages" @click="page++">Tiếp →</button>
    </div>

    <div v-if="diffEntry" class="modal-overlay" @click.self="diffEntry = null">
      <div class="diff-modal">
        <div class="diff-header">
          <span class="diff-title">{{ diffEntry.entityLabel }} — {{ diffEntry.action }}</span>
          <button class="diff-close" @click="diffEntry = null">✕</button>
        </div>
        <div class="diff-body">
          <div class="diff-col">
            <h3 class="diff-col-title">Trước</h3>
            <pre class="diff-pre">{{ diffEntry.beforeJson ? JSON.stringify(diffEntry.beforeJson, null, 2) : '—' }}</pre>
          </div>
          <div class="diff-col">
            <h3 class="diff-col-title">Sau</h3>
            <pre class="diff-pre">{{ diffEntry.afterJson ? JSON.stringify(diffEntry.afterJson, null, 2) : '—' }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { auditApi } from '../api';

const LIMIT = 50;

const logs = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const diffEntry = ref<any>(null);

const filters = ref({
  action: '',
  entityType: '',
  search: '',
  from: '',
  to: '',
});

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / LIMIT)));

async function fetchLogs() {
  loading.value = true;
  try {
    const params: Record<string, any> = { page: page.value, limit: LIMIT };
    if (filters.value.action) params.action = filters.value.action;
    if (filters.value.entityType) params.entityType = filters.value.entityType;
    if (filters.value.search) params.search = filters.value.search;
    if (filters.value.from) params.from = filters.value.from;
    if (filters.value.to) params.to = filters.value.to;

    const res = await auditApi.list(params);
    logs.value = res.data.data;
    total.value = res.data.total;
  } catch {
    logs.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filters.value = { action: '', entityType: '', search: '', from: '', to: '' };
  page.value = 1;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

const fetchKey = computed(() => ({ page: page.value, ...filters.value }));
watch(fetchKey, fetchLogs);
onMounted(fetchLogs);
</script>

<style scoped>
.audit-page {
  min-height: 100vh;
  background: #f6f8fa;
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
  gap: 16px;
}

.audit-header {
  display: flex;
  align-items: center;
  gap: 16px;
}
.back-link {
  color: #0969da;
  text-decoration: none;
  font-size: 13px;
  flex-shrink: 0;
}
.back-link:hover { text-decoration: underline; }
.audit-title { font-size: 1.1rem; font-weight: 700; color: #24292f; margin: 0; }

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  background: #ffffff;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  padding: 12px 16px;
}
.filter-select, .filter-date {
  height: 30px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 0 8px;
  font-size: 13px;
  background: #f6f8fa;
  color: #24292f;
}
.filter-search {
  height: 30px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 0 10px;
  font-size: 13px;
  background: #f6f8fa;
  flex: 1;
  min-width: 140px;
}
.filter-search:focus, .filter-select:focus, .filter-date:focus {
  outline: none;
  border-color: #0969da;
  background: #fff;
}
.btn-reset {
  height: 30px;
  background: #f6f8fa;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 0 12px;
  font-size: 13px;
  cursor: pointer;
  color: #57606a;
}
.btn-reset:hover { background: #eaeef2; color: #24292f; }

.table-wrap {
  background: #ffffff;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  overflow: auto;
  flex: 1;
}
.table-loading { padding: 32px; text-align: center; color: #57606a; font-size: 13px; }
.audit-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.audit-table th {
  background: #f6f8fa;
  border-bottom: 1px solid #d0d7de;
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  color: #57606a;
  white-space: nowrap;
}
.audit-table td {
  border-bottom: 1px solid #f0f0f0;
  padding: 8px 12px;
  color: #24292f;
  vertical-align: middle;
}
.audit-table tr:last-child td { border-bottom: none; }
.audit-table tr:hover td { background: #f6f8fa; }

.col-time { white-space: nowrap; color: #57606a; font-size: 12px; }
.col-actor { font-family: monospace; font-size: 12px; color: #57606a; }
.col-label { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.col-diff { text-align: center; }

.badge {
  display: inline-block;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
}
.badge.create { background: #2da44e; }
.badge.update { background: #0969da; }
.badge.delete { background: #cf222e; }

.btn-diff {
  background: none;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  font-size: 13px;
}
.btn-diff:hover { background: #f6f8fa; border-color: #0969da; }

.empty-state { text-align: center; color: #57606a; padding: 32px; }

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}
.btn-page {
  background: #ffffff;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  color: #24292f;
}
.btn-page:hover:not(:disabled) { background: #f0f7ff; border-color: #0969da; color: #0969da; }
.btn-page:disabled { opacity: 0.4; cursor: default; }
.page-info { font-size: 13px; color: #57606a; }

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.diff-modal {
  background: #ffffff;
  border: 1px solid #d0d7de;
  border-radius: 10px;
  width: 860px;
  max-width: 95vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}
.diff-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #d0d7de;
  flex-shrink: 0;
}
.diff-title { font-weight: 600; font-size: 14px; color: #24292f; }
.diff-close {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #57606a;
  padding: 2px 6px;
}
.diff-close:hover { color: #cf222e; }
.diff-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  overflow: auto;
  flex: 1;
}
.diff-col {
  padding: 12px 16px;
  border-right: 1px solid #d0d7de;
  overflow: auto;
}
.diff-col:last-child { border-right: none; }
.diff-col-title { margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #57606a; text-transform: uppercase; }
.diff-pre {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: #24292f;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
