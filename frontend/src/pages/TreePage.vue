<template>
  <div class="tree-page">

    <!-- Toolbar -->
    <div class="toolbar">
      <span class="app-title">🌳 Gia Phả Nhà Lâm</span>
      <div class="stats">
        <span class="stat">👁 {{ stats.totalVisits.toLocaleString('vi-VN') }} lượt xem</span>
        <span class="stat-dot">·</span>
        <span class="stat online">🟢 {{ stats.onlineNow }} đang online</span>
      </div>
      <div class="toolbar-actions">
        <button v-if="isAdmin" class="btn-add" @click="openAddForm">+ Thêm người</button>
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

    <!-- Tree canvas -->
    <FamilyTreeCanvas
      :key="treeKey"
      ref="canvasRef"
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
    />
    <PersonForm
      v-if="showForm"
      :edit-person="editingPerson"
      @close="closeForm"
      @saved="onSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import FamilyTreeCanvas from '../components/FamilyTreeCanvas.vue';
import PersonDrawer from '../components/PersonDrawer.vue';
import PersonForm from '../components/PersonForm.vue';
import { statsApi } from '../api';

const auth = useAuthStore();
const router = useRouter();
const isAdmin = auth.isAdmin;

const selectedPersonId = ref<string | null>(null);
const showForm = ref(false);
const editingPerson = ref<any>(null);
const treeKey = ref(0);
const drawerVersion = ref(0);
const canvasRef = ref<InstanceType<typeof FamilyTreeCanvas>>();
const stats = ref({ totalVisits: 0, onlineNow: 0 });

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
});

onUnmounted(() => {
  if (pingInterval) clearInterval(pingInterval);
});

function openAddForm() { editingPerson.value = null; showForm.value = true; }
function openEditForm(person: any) { editingPerson.value = person; showForm.value = true; }
function closeForm() { showForm.value = false; editingPerson.value = null; }
async function onSaved() { closeForm(); refreshTree(); drawerVersion.value++; }
function refreshTree() { treeKey.value++; }
function handleLogout() { auth.logout(); router.push('/login'); }
</script>

<style scoped>
.tree-page { width: 100vw; height: 100vh; display: flex; flex-direction: column; background: #f6f8fa; overflow: hidden; }

/* Toolbar */
.toolbar { display: flex; align-items: center; justify-content: space-between; padding: 0 20px; background: #ffffff; border-bottom: 1px solid #d0d7de; height: 52px; flex-shrink: 0; z-index: 10; gap: 16px; }
.app-title { font-size: 1rem; font-weight: bold; color: #24292f; white-space: nowrap; }
.stats { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #57606a; flex: 1; justify-content: center; }
.stat { white-space: nowrap; }
.stat-dot { color: #d0d7de; }
.stat.online { color: #2da44e; }
.toolbar-actions { display: flex; gap: 10px; flex-shrink: 0; }
.btn-add { background: #2da44e; color: #fff; border: none; border-radius: 6px; padding: 7px 14px; cursor: pointer; font-size: 13px; font-weight: 500; white-space: nowrap; }
.btn-add:hover { background: #2c974b; }
.btn-logout { background: #f6f8fa; color: #57606a; border: 1px solid #d0d7de; border-radius: 6px; padding: 7px 14px; cursor: pointer; font-size: 13px; white-space: nowrap; }
.btn-logout:hover { background: #eaeef2; }

/* Hero */
.hero { background: linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%); border-bottom: 1px solid #d0d7de; padding: 14px 24px; flex-shrink: 0; }
.hero-content h2 { font-size: 1rem; font-weight: 700; color: #0969da; margin-bottom: 4px; }
.hero-content p { font-size: 12px; color: #57606a; line-height: 1.5; margin: 0; max-width: 700px; }
.hero-content em { font-style: normal; background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 4px; padding: 0 4px; font-size: 11px; }

/* Footer */
.footer { background: #ffffff; border-top: 1px solid #d0d7de; height: 34px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #57606a; flex-shrink: 0; }
.footer strong { color: #24292f; }
</style>
