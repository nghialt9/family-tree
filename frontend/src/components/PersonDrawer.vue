<template>
  <Transition name="drawer">
    <div v-if="personId" class="drawer-overlay" @click.self="$emit('close')">
      <div class="drawer">
        <button class="close-btn" @click="$emit('close')">✕</button>

        <div v-if="loading" class="loading">Đang tải...</div>
        <template v-else-if="person">
          <div class="avatar-section">
            <img v-if="person.avatarUrl" :src="person.avatarUrl" class="avatar-img" />
            <div v-else class="avatar-placeholder">{{ person.gender === 'female' ? '👩' : '👨' }}</div>
            <h2>{{ person.fullName }}</h2>
            <span v-if="person.nickname" class="nickname">"{{ person.nickname }}"</span>
            <div class="badges">
              <span class="gen-badge">Thế hệ {{ person.generation }}</span>
              <span v-if="!person.isAlive" class="deceased-badge">✝ Đã mất</span>
            </div>
          </div>

          <div class="info-section">
            <div v-if="person.birthDate" class="info-row">
              <span class="icon">🎂</span>
              <div><div class="info-label">Ngày sinh</div><div>{{ formatDate(person.birthDate) }}</div></div>
            </div>
            <div v-if="person.deathDate" class="info-row">
              <span class="icon">✝</span>
              <div><div class="info-label">Ngày mất</div><div>{{ formatDate(person.deathDate) }}</div></div>
            </div>
            <div v-if="person.phone" class="info-row">
              <span class="icon">📞</span>
              <div><div class="info-label">Điện thoại</div><div>{{ person.phone }}</div></div>
            </div>
            <div v-if="person.address" class="info-row">
              <span class="icon">📍</span>
              <div><div class="info-label">Địa chỉ</div><div>{{ person.address }}</div></div>
            </div>
          </div>

          <div v-if="person.bio" class="bio-section">
            <h3>Tiểu sử</h3>
            <p>{{ person.bio }}</p>
          </div>

          <div v-if="relatives" class="relatives-section">
            <div v-if="relatives.spouses?.length">
              <h3>💍 Vợ / Chồng</h3>
              <button v-for="s in relatives.spouses" :key="s.id" class="rel-btn" @click="$emit('selectPerson', s.id)">{{ s.fullName }}</button>
            </div>
            <div v-if="relatives.parents?.length">
              <h3>👴 Cha / Mẹ</h3>
              <button v-for="p in relatives.parents" :key="p.id" class="rel-btn" @click="$emit('selectPerson', p.id)">{{ p.fullName }}</button>
            </div>
            <div v-if="relatives.children?.length">
              <h3>👶 Con cái ({{ relatives.children.length }})</h3>
              <button v-for="c in relatives.children" :key="c.id" class="rel-btn" @click="$emit('selectPerson', c.id)">{{ c.fullName }}</button>
            </div>
          </div>

          <div v-if="isAdmin" class="admin-actions">
            <button class="btn-edit" @click="$emit('editPerson', person)">✏️ Sửa</button>
            <button class="btn-delete" @click="handleDelete">🗑️ Xóa</button>
          </div>
        </template>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { personsApi } from '../api';
import { useAuthStore } from '../stores/auth';

const props = defineProps<{ personId: string | null }>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'selectPerson', id: string): void;
  (e: 'editPerson', person: any): void;
  (e: 'deleted'): void;
}>();

const auth = useAuthStore();
const isAdmin = auth.isAdmin;
const person = ref<any>(null);
const relatives = ref<any>(null);
const loading = ref(false);

watch(() => props.personId, async (id) => {
  if (!id) { person.value = null; relatives.value = null; return; }
  loading.value = true;
  try {
    const [pRes, rRes] = await Promise.all([personsApi.get(id), personsApi.getRelatives(id)]);
    person.value = pRes.data;
    relatives.value = rRes.data;
  } finally {
    loading.value = false;
  }
});

async function handleDelete() {
  if (!person.value || !confirm(`Xóa ${person.value.fullName}?`)) return;
  await personsApi.delete(person.value.id);
  emit('deleted');
  emit('close');
}

function formatDate(d: string) { return new Date(d).toLocaleDateString('vi-VN'); }
</script>

<style scoped>
.drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100; }
.drawer { position: fixed; right: 0; top: 0; height: 100vh; width: 380px; background: #161b22; border-left: 1px solid #30363d; overflow-y: auto; padding: 24px; }
.close-btn { position: absolute; top: 12px; right: 12px; background: none; border: none; color: #8b949e; font-size: 18px; cursor: pointer; }
.avatar-section { text-align: center; margin-bottom: 20px; padding-top: 16px; }
.avatar-img { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 10px; }
.avatar-placeholder { font-size: 64px; margin-bottom: 10px; }
h2 { font-size: 1.2rem; color: #e94560; }
.nickname { color: #8b949e; font-style: italic; display: block; margin-bottom: 8px; }
.badges { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
.gen-badge { background: #0f3460; color: #58a6ff; border-radius: 10px; padding: 2px 10px; font-size: 11px; }
.deceased-badge { background: #21262d; color: #f85149; border-radius: 10px; padding: 2px 10px; font-size: 11px; }
.info-section { margin: 16px 0; }
.info-row { display: flex; gap: 10px; margin-bottom: 10px; align-items: flex-start; font-size: 13px; }
.icon { font-size: 18px; }
.info-label { font-size: 10px; color: #8b949e; }
.bio-section { background: #0d1117; border-radius: 8px; padding: 12px; margin: 16px 0; }
.bio-section h3, .relatives-section h3 { font-size: 12px; color: #8b949e; margin: 16px 0 6px; }
.bio-section p { font-size: 13px; color: #8b949e; line-height: 1.6; }
.rel-btn { background: #21262d; border: 1px solid #30363d; color: #58a6ff; padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; margin: 0 4px 4px 0; }
.admin-actions { margin-top: 24px; display: flex; gap: 10px; }
.btn-edit { flex: 1; padding: 10px; background: #21262d; border: 1px solid #30363d; color: #e6edf3; border-radius: 6px; cursor: pointer; }
.btn-delete { flex: 1; padding: 10px; background: #21262d; border: 1px solid #f85149; color: #f85149; border-radius: 6px; cursor: pointer; }
.loading { text-align: center; padding: 40px; color: #8b949e; }
.drawer-enter-active, .drawer-leave-active { transition: transform 0.3s ease; }
.drawer-enter-from, .drawer-leave-to { transform: translateX(100%); }
</style>
