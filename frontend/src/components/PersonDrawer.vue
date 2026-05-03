<template>
  <Transition name="drawer">
    <div v-if="personId" class="drawer-overlay" @click.self="$emit('close')">
      <div class="drawer">
        <button class="close-btn" @click="$emit('close')">✕</button>

        <div v-if="loading" class="loading">Đang tải...</div>
        <template v-else-if="person">
          <div class="avatar-section">
            <img v-if="person.avatarUrl" :src="person.avatarUrl + '?v=' + new Date(person.updatedAt).getTime()" class="avatar-img" />
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
              <div>
                <div class="info-label">Điện thoại</div>
                <a :href="'tel:' + person.phone" class="phone-link">{{ person.phone }}</a>
              </div>
            </div>
            <div v-if="person.email" class="info-row">
              <span class="icon">✉️</span>
              <div>
                <div class="info-label">Email</div>
                <a :href="'mailto:' + person.email" class="phone-link">{{ person.email }}</a>
              </div>
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
              <div v-for="s in relatives.spouses" :key="s.id" class="rel-row">
                <button class="rel-btn" @click="$emit('selectPerson', s.id)">{{ s.fullName }}</button>
                <router-link :to="`/relationships/${s.relationshipId}/media`" class="rel-media-btn" title="Xem ảnh quan hệ">🖼</router-link>
              </div>
            </div>
            <div v-if="relatives.parents?.length">
              <h3>👴 Cha / Mẹ</h3>
              <div v-for="p in relatives.parents" :key="p.id" class="rel-row">
                <button class="rel-btn" @click="$emit('selectPerson', p.id)">{{ p.fullName }}</button>
                <router-link :to="`/relationships/${p.relationshipId}/media`" class="rel-media-btn" title="Xem ảnh quan hệ">🖼</router-link>
              </div>
            </div>
            <div v-if="relatives.children?.length">
              <h3>👶 Con cái ({{ relatives.children.length }})</h3>
              <div v-for="c in relatives.children" :key="c.id" class="rel-row">
                <button class="rel-btn" @click="$emit('selectPerson', c.id)">{{ c.fullName }}</button>
                <router-link :to="`/relationships/${c.relationshipId}/media`" class="rel-media-btn" title="Xem ảnh quan hệ">🖼</router-link>
              </div>
            </div>
          </div>

          <div v-if="isEditor" class="quick-add-section">
            <h3>Thêm người quan hệ</h3>
            <div class="quick-add-btns">
              <button class="btn-quick" @click="addRelative('asChildOf')">+ Thêm con</button>
              <button class="btn-quick" @click="addRelative('asSpouseOf')">+ Thêm vợ/chồng</button>
              <button class="btn-quick" @click="addRelative('asParentOf')">+ Thêm cha/mẹ</button>
            </div>
          </div>

          <div v-if="auth.token" class="media-link-row">
            <router-link :to="`/persons/${person.id}/media`" class="btn-media">
              🖼 Xem media
            </router-link>
          </div>

          <div v-if="isEditor" class="admin-actions">
            <button class="btn-edit" @click="$emit('editPerson', person)">✏️ Sửa</button>
            <button v-if="isAdmin" class="btn-delete" @click="handleDelete">🗑️ Xóa</button>
          </div>
        </template>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { personsApi } from '../api';
import { useAuthStore } from '../stores/auth';

const props = defineProps<{ personId: string | null; version?: number }>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'selectPerson', id: string): void;
  (e: 'editPerson', person: any): void;
  (e: 'deleted'): void;
  (e: 'addRelative', data: { type: string; personId: string; personName: string; personGender: string }): void;
}>();

const auth = useAuthStore();
const { isAdmin, isEditor } = storeToRefs(auth);
const person = ref<any>(null);
const relatives = ref<any>(null);
const loading = ref(false);

watch(
  [() => props.personId, () => props.version],
  async ([id]) => {
    if (!id) { person.value = null; relatives.value = null; return; }
    loading.value = true;
    try {
      const [pRes, rRes] = await Promise.all([personsApi.get(id as string), personsApi.getRelatives(id as string)]);
      person.value = pRes.data;
      relatives.value = rRes.data;
    } finally {
      loading.value = false;
    }
  }
);

function addRelative(type: string) {
  if (!person.value) return;
  emit('addRelative', { type, personId: person.value.id, personName: person.value.fullName, personGender: person.value.gender });
}

async function handleDelete() {
  if (!person.value || !confirm(`Xóa ${person.value.fullName}?`)) return;
  await personsApi.delete(person.value.id);
  emit('deleted');
  emit('close');
}

function formatDate(d: string) { return new Date(d).toLocaleDateString('vi-VN'); }
</script>

<style scoped>
.drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.25); z-index: 100; }
.drawer { position: fixed; right: 0; top: 0; height: 100vh; width: 380px; background: #ffffff; border-left: 1px solid #d0d7de; overflow-y: auto; padding: 24px; box-shadow: -4px 0 16px rgba(140,149,159,0.15); }
.close-btn { position: absolute; top: 12px; right: 12px; background: none; border: none; color: #57606a; font-size: 18px; cursor: pointer; }
.close-btn:hover { color: #24292f; }
.avatar-section { text-align: center; margin-bottom: 20px; padding-top: 16px; }
.avatar-img { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 10px; border: 2px solid #d0d7de; }
.avatar-placeholder { font-size: 64px; margin-bottom: 10px; }
h2 { font-size: 1.2rem; color: #24292f; font-weight: 700; }
.nickname { color: #57606a; font-style: italic; display: block; margin-bottom: 8px; }
.badges { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
.gen-badge { background: #ddf4ff; color: #0969da; border-radius: 10px; padding: 2px 10px; font-size: 11px; font-weight: 600; }
.deceased-badge { background: #ffebe9; color: #cf222e; border-radius: 10px; padding: 2px 10px; font-size: 11px; }
.info-section { margin: 16px 0; }
.info-row { display: flex; gap: 10px; margin-bottom: 10px; align-items: flex-start; font-size: 13px; color: #24292f; }
.phone-link { color: #0969da; text-decoration: none; }
.phone-link:hover { text-decoration: underline; }
.icon { font-size: 18px; }
.info-label { font-size: 10px; color: #57606a; margin-bottom: 1px; }
.bio-section { background: #f6f8fa; border-radius: 8px; padding: 12px; margin: 16px 0; border: 1px solid #d0d7de; }
.bio-section h3, .relatives-section h3 { font-size: 12px; color: #57606a; margin: 16px 0 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
.bio-section p { font-size: 13px; color: #24292f; line-height: 1.6; }
.rel-btn { background: #f6f8fa; border: 1px solid #d0d7de; color: #0969da; padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; margin: 0 4px 4px 0; }
.rel-btn:hover { background: #ddf4ff; border-color: #54aeff; }
.rel-row { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
.rel-row .rel-btn { margin: 0; flex: 1; }
.rel-media-btn { font-size: 14px; text-decoration: none; padding: 2px 6px; border-radius: 4px; background: #f6f8fa; border: 1px solid #d0d7de; cursor: pointer; flex-shrink: 0; }
.rel-media-btn:hover { background: #ddf4ff; border-color: #54aeff; }
.quick-add-section { margin-top: 20px; }
.quick-add-btns { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.btn-quick { background: #f6f8fa; border: 1px solid #d0d7de; color: #0969da; padding: 5px 11px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 500; }
.btn-quick:hover { background: #ddf4ff; border-color: #54aeff; }
.admin-actions { margin-top: 16px; display: flex; gap: 10px; }
.btn-edit { flex: 1; padding: 10px; background: #f6f8fa; border: 1px solid #d0d7de; color: #24292f; border-radius: 6px; cursor: pointer; font-weight: 500; }
.btn-edit:hover { background: #eaeef2; }
.btn-delete { flex: 1; padding: 10px; background: #fff0ee; border: 1px solid #ffcecb; color: #cf222e; border-radius: 6px; cursor: pointer; font-weight: 500; }
.btn-delete:hover { background: #ffebe9; }
.loading { text-align: center; padding: 40px; color: #57606a; }
.drawer-enter-active, .drawer-leave-active { transition: transform 0.3s ease; }
.drawer-enter-from, .drawer-leave-to { transform: translateX(100%); }
.media-link-row { margin-top: 12px; }
.btn-media { display: inline-block; padding: 8px 16px; background: #f6f8fa; border: 1px solid #d0d7de; color: #0969da; border-radius: 6px; font-size: 13px; text-decoration: none; font-weight: 500; }
.btn-media:hover { background: #ddf4ff; border-color: #54aeff; }
</style>
