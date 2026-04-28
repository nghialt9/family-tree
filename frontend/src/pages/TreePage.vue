<template>
  <div class="tree-page">
    <div class="toolbar">
      <span class="app-title">🌳 Gia Phả Nhà Lâm</span>
      <div class="toolbar-actions">
        <button v-if="isAdmin" class="btn-add" @click="openAddForm">+ Thêm người</button>
        <button class="btn-logout" @click="handleLogout">Đăng xuất</button>
      </div>
    </div>

    <FamilyTreeCanvas
      :key="treeKey"
      ref="canvasRef"
      @select-person="selectedPersonId = $event"
    />

    <PersonDrawer
      :person-id="selectedPersonId"
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
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import FamilyTreeCanvas from '../components/FamilyTreeCanvas.vue';
import PersonDrawer from '../components/PersonDrawer.vue';
import PersonForm from '../components/PersonForm.vue';

const auth = useAuthStore();
const router = useRouter();
const isAdmin = auth.isAdmin;

const selectedPersonId = ref<string | null>(null);
const showForm = ref(false);
const editingPerson = ref<any>(null);
const treeKey = ref(0);
const canvasRef = ref<InstanceType<typeof FamilyTreeCanvas>>();

function openAddForm() {
  editingPerson.value = null;
  showForm.value = true;
}

function openEditForm(person: any) {
  editingPerson.value = person;
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingPerson.value = null;
}

async function onSaved() {
  closeForm();
  refreshTree();
}

function refreshTree() {
  treeKey.value++;
}

function handleLogout() {
  auth.logout();
  router.push('/login');
}
</script>

<style scoped>
.tree-page { width: 100vw; height: 100vh; display: flex; flex-direction: column; background: #0d1117; overflow: hidden; }
.toolbar { display: flex; align-items: center; justify-content: space-between; padding: 10px 20px; background: #161b22; border-bottom: 1px solid #30363d; height: 52px; flex-shrink: 0; z-index: 10; }
.app-title { font-size: 1rem; font-weight: bold; }
.toolbar-actions { display: flex; gap: 10px; }
.btn-add { background: #238636; color: #fff; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer; font-size: 13px; }
.btn-add:hover { background: #2ea043; }
.btn-logout { background: #21262d; color: #8b949e; border: 1px solid #30363d; border-radius: 6px; padding: 8px 16px; cursor: pointer; font-size: 13px; }
</style>
