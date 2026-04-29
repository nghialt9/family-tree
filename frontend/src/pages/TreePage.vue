<template>
  <div class="tree-page">

    <!-- Toolbar -->
    <div class="toolbar">
      <span class="app-title">🌳 Gia Phả Nhà Lâm</span>

      <div class="search-wrap">
        <input
          v-model="searchQuery"
          class="search-input"
          placeholder="🔍 Tìm tên..."
          @focus="searchActive = true"
          @blur="handleSearchBlur"
          @keydown.escape="clearSearch"
        />
        <div v-if="searchActive && searchResults.length" class="search-dropdown">
          <button
            v-for="node in searchResults"
            :key="node.id"
            class="search-item"
            @mousedown.prevent="selectResult(node)"
          >
            <span class="si-gen">T{{ node.data.generation }}</span>
            <span class="si-name">{{ node.data.fullName }}</span>
            <span v-if="node.data.nickname" class="si-nick">"{{ node.data.nickname }}"</span>
          </button>
        </div>
      </div>

      <div class="stats">
        <span class="stat">👁 {{ stats.totalVisits.toLocaleString('vi-VN') }} lượt xem</span>
        <span class="stat-dot">·</span>
        <span class="stat online">🟢 {{ stats.onlineNow }} đang online</span>
      </div>
      <div class="toolbar-actions">
        <span v-if="auth.personName || auth.userPhone" class="user-greeting">
          👤 {{ auth.personName ?? auth.userPhone }}
        </span>
        <button v-if="isEditor" class="btn-add" @click="openAddForm">+ Thêm người</button>
        <span class="action-divider" />
        <button class="btn-logout" @click="handleLogout">Đăng xuất</button>
      </div>
    </div>

    <!-- Hero banner -->
    <div class="hero">
      <div class="hero-content">
        <h2>Gia Phả Họ Lâm</h2>
        <p>Lưu giữ và kết nối ký ức của các thế hệ trong gia đình. Bấm vào từng người để xem thông tin chi tiết, bấm <em>Chi tiết ▼</em> để xem đầy đủ tiểu sử và mối quan hệ.</p>
      </div>
    </div>

    <!-- Reminder banner -->
    <div v-if="reminders.length && !remindersDismissed" class="reminder-banner">
      <div class="reminder-list">
        <span v-for="r in reminders" :key="r.person.id + r.type" class="reminder-item"
          @click="selectedPersonId = r.person.id" style="cursor:pointer">
          <template v-if="r.type === 'birthday'">
            🎂
            <template v-if="r.daysUntil === 0">Hôm nay sinh nhật <strong>{{ r.person.fullName }}</strong>!</template>
            <template v-else-if="r.daysUntil === 1">Ngày mai sinh nhật <strong>{{ r.person.fullName }}</strong></template>
            <template v-else>{{ r.daysUntil }} ngày nữa sinh nhật <strong>{{ r.person.fullName }}</strong></template>
          </template>
          <template v-else>
            🙏
            <template v-if="r.daysUntil === 0">Hôm nay ngày giỗ <strong>{{ r.person.fullName }}</strong></template>
            <template v-else-if="r.daysUntil === 1">Ngày mai ngày giỗ <strong>{{ r.person.fullName }}</strong></template>
            <template v-else>{{ r.daysUntil }} ngày nữa ngày giỗ <strong>{{ r.person.fullName }}</strong></template>
          </template>
        </span>
      </div>
      <button class="reminder-close" @click.stop="remindersDismissed = true">✕</button>
    </div>

    <!-- Tree canvas -->
    <FamilyTreeCanvas
      :key="treeKey"
      ref="canvasRef"
      :focus-person-id="auth.linkedPersonId"
      @select-person="selectedPersonId = $event"
    />

    <!-- Footer -->
    <div class="footer">
      <span>© {{ new Date().getFullYear() }} · Tác giả: <strong>JustinLam</strong> · Gia Phả Họ Lâm</span>
    </div>

    <!-- Drawer & Form -->
    <PersonDrawer
      :person-id="selectedPersonId"
      :version="drawerVersion"
      @close="selectedPersonId = null"
      @select-person="selectedPersonId = $event"
      @edit-person="openEditForm"
      @deleted="refreshTree"
      @add-relative="handleAddRelative"
    />
    <PersonForm
      v-if="showForm"
      :edit-person="editingPerson"
      :pre-relation="preRelation"
      @close="closeForm"
      @saved="onSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import FamilyTreeCanvas from '../components/FamilyTreeCanvas.vue';
import PersonDrawer from '../components/PersonDrawer.vue';
import PersonForm from '../components/PersonForm.vue';
import { statsApi } from '../api';

const auth = useAuthStore();
const router = useRouter();
const { isEditor } = storeToRefs(auth);

const selectedPersonId = ref<string | null>(null);
const showForm = ref(false);
const editingPerson = ref<any>(null);
const preRelation = ref<any>(null);
const treeKey = ref(0);
const drawerVersion = ref(0);
const canvasRef = ref<InstanceType<typeof FamilyTreeCanvas> & { focusOnNode: (id: string) => void; personNodes: any[] }>();
const stats = ref({ totalVisits: 0, onlineNow: 0 });
const remindersDismissed = ref(false);

function daysUntilNextOccurrence(month: number, day: number): number {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), month, day);
  if (target < todayStart) target = new Date(now.getFullYear() + 1, month, day);
  return Math.round((target.getTime() - todayStart.getTime()) / 86400000);
}

const reminders = computed(() => {
  const nodes: any[] = canvasRef.value?.personNodes ?? [];
  const result: { type: 'birthday' | 'death'; person: any; daysUntil: number }[] = [];
  for (const node of nodes) {
    const p = node.data;
    if (p.birthDate) {
      const bd = new Date(p.birthDate);
      const d = daysUntilNextOccurrence(bd.getUTCMonth(), bd.getUTCDate());
      if (d <= 7) result.push({ type: 'birthday', person: p, daysUntil: d });
    }
    if (p.deathDate) {
      const dd = new Date(p.deathDate);
      const d = daysUntilNextOccurrence(dd.getUTCMonth(), dd.getUTCDate());
      if (d <= 7) result.push({ type: 'death', person: p, daysUntil: d });
    }
  }
  return result.sort((a, b) => a.daysUntil - b.daysUntil);
});

const searchQuery = ref('');
const searchActive = ref(false);

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
}

const searchResults = computed(() => {
  const q = searchQuery.value.trim();
  if (!q || !canvasRef.value) return [];
  const nq = normalize(q);
  return (canvasRef.value.personNodes ?? [])
    .filter((n: any) => normalize((n.data.fullName ?? '') + ' ' + (n.data.nickname ?? '')).includes(nq))
    .slice(0, 8);
});

function handleSearchBlur() { setTimeout(() => { searchActive.value = false; }, 200); }
function clearSearch() { searchQuery.value = ''; searchActive.value = false; }
function selectResult(node: any) {
  selectedPersonId.value = node.id;
  canvasRef.value?.focusOnNode(node.id);
  clearSearch();
}

let pingInterval: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  try {
    const res = await statsApi.ping(true);
    stats.value = res.data;
  } catch { /* ignore */ }
  pingInterval = setInterval(async () => {
    try {
      const res = await statsApi.ping(false);
      stats.value = res.data;
    } catch { /* ignore */ }
  }, 60_000);
  window.addEventListener('beforeunload', sendLeave);
});

onUnmounted(() => {
  if (pingInterval) clearInterval(pingInterval);
  window.removeEventListener('beforeunload', sendLeave);
});

function sendLeave() {
  const token = localStorage.getItem('token');
  if (!token) return;
  fetch('/api/stats/leave', {
    method: 'POST',
    keepalive: true,
    headers: { Authorization: `Bearer ${token}` },
  });
}

function openAddForm() { preRelation.value = null; editingPerson.value = null; showForm.value = true; }
function openEditForm(person: any) { preRelation.value = null; editingPerson.value = person; showForm.value = true; }
function closeForm() { showForm.value = false; editingPerson.value = null; preRelation.value = null; }
function handleAddRelative(data: any) { preRelation.value = data; editingPerson.value = null; selectedPersonId.value = null; showForm.value = true; }
async function onSaved() { closeForm(); refreshTree(); drawerVersion.value++; }
function refreshTree() { treeKey.value++; }
function handleLogout() { auth.logout(); router.push('/login'); }
</script>

<style scoped>
.tree-page { width: 100vw; height: 100vh; display: flex; flex-direction: column; background: #f6f8fa; overflow: hidden; }

/* Toolbar */
.toolbar { display: flex; align-items: center; padding: 0 20px; background: #ffffff; border-bottom: 1px solid #d0d7de; height: 52px; flex-shrink: 0; z-index: 10; gap: 12px; }
.app-title { font-size: 1rem; font-weight: bold; color: #24292f; white-space: nowrap; flex-shrink: 0; }

.search-wrap { position: relative; flex-shrink: 0; }
.search-input { height: 30px; padding: 0 10px; border: 1px solid #d0d7de; border-radius: 6px; font-size: 13px; background: #f6f8fa; outline: none; width: 200px; }
.search-input:focus { border-color: #0969da; background: #fff; box-shadow: 0 0 0 3px rgba(9,105,218,0.1); }
.search-dropdown { position: absolute; top: calc(100% + 4px); left: 0; z-index: 1000; background: #fff; border: 1px solid #d0d7de; border-radius: 8px; box-shadow: 0 8px 24px rgba(140,149,159,0.2); width: 280px; max-height: 300px; overflow-y: auto; }
.search-item { display: flex; align-items: center; gap: 6px; width: 100%; padding: 8px 12px; background: none; border: none; border-bottom: 1px solid #f0f0f0; cursor: pointer; text-align: left; font-size: 13px; }
.search-item:last-child { border-bottom: none; }
.search-item:hover { background: #f6f8fa; }
.si-gen { background: #ddf4ff; color: #0969da; border-radius: 8px; padding: 1px 6px; font-size: 10px; font-weight: 700; flex-shrink: 0; }
.si-name { font-weight: 600; color: #24292f; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.si-nick { color: #57606a; font-size: 11px; font-style: italic; flex-shrink: 0; }

.stats { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #57606a; flex: 1; justify-content: center; }
.stat { white-space: nowrap; }
.stat-dot { color: #d0d7de; }
.stat.online { color: #2da44e; }
.toolbar-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.action-divider { width: 1px; height: 20px; background: #d0d7de; flex-shrink: 0; }
.user-greeting { font-size: 12px; color: #57606a; white-space: nowrap; }
.btn-add { background: #2da44e; color: #fff; border: none; border-radius: 6px; padding: 7px 14px; cursor: pointer; font-size: 13px; font-weight: 500; white-space: nowrap; }
.btn-add:hover { background: #2c974b; }
.btn-logout { background: #f6f8fa; color: #57606a; border: 1px solid #d0d7de; border-radius: 6px; padding: 7px 14px; cursor: pointer; font-size: 13px; white-space: nowrap; }
.btn-logout:hover { background: #eaeef2; }

/* Reminder banner */
.reminder-banner { background: linear-gradient(135deg, #fff8c5, #fffbe6); border-bottom: 1px solid #d4a72c; padding: 7px 20px; display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.reminder-list { flex: 1; display: flex; flex-wrap: wrap; gap: 4px 18px; }
.reminder-item { font-size: 12px; color: #633c01; white-space: nowrap; }
.reminder-item strong { font-weight: 700; }
.reminder-item:hover { text-decoration: underline; }
.reminder-close { background: none; border: none; color: #633c01; cursor: pointer; font-size: 15px; flex-shrink: 0; opacity: 0.6; padding: 2px 4px; }
.reminder-close:hover { opacity: 1; }

/* Hero */
.hero { background: linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%); border-bottom: 1px solid #d0d7de; padding: 14px 24px; flex-shrink: 0; }
.hero-content h2 { font-size: 1rem; font-weight: 700; color: #0969da; margin-bottom: 4px; }
.hero-content p { font-size: 12px; color: #57606a; line-height: 1.5; margin: 0; max-width: 700px; }
.hero-content em { font-style: normal; background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 4px; padding: 0 4px; font-size: 11px; }

/* Footer */
.footer { background: #ffffff; border-top: 1px solid #d0d7de; height: 34px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #57606a; flex-shrink: 0; }
.footer strong { color: #24292f; }

/* Mobile */
@media (max-width: 640px) {
  .toolbar { padding: 0 10px; gap: 6px; }
  .app-title { font-size: 0.8rem; }
  .stats { display: none; }
  .user-greeting { display: none; }
  .search-input { width: 110px; font-size: 12px; }
  .search-dropdown { width: 240px; }
  .btn-add { padding: 6px 10px; font-size: 12px; }
  .btn-logout { padding: 6px 10px; font-size: 12px; }
  .hero { padding: 10px 14px; }
  .hero-content h2 { font-size: 0.9rem; }
  .hero-content p { font-size: 11px; }
}
</style>
