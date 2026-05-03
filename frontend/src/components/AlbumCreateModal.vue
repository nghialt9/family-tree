<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <button class="close-btn" @click="$emit('close')">✕</button>
      <h3>Tạo album mới</h3>

      <div v-if="!done">
        <input v-model="title" type="text" placeholder="Tên album *" class="field" maxlength="100" />
        <textarea v-model="description" placeholder="Mô tả (tuỳ chọn)" class="field textarea" rows="3" maxlength="500" />

        <div class="field-group">
          <label class="field-label">Gắn với người (tuỳ chọn)</label>
          <input
            v-model="personSearch"
            type="text"
            placeholder="Tìm tên..."
            class="field"
            @input="filterPersons"
            :disabled="!!presetPersonId"
          />
          <div v-if="personResults.length && !selectedPerson" class="person-dropdown">
            <button
              v-for="p in personResults"
              :key="p.id"
              class="person-item"
              @mousedown.prevent="selectPerson(p)"
            >{{ p.fullName }}</button>
          </div>
          <div v-if="selectedPerson" class="selected-person">
            {{ selectedPerson.fullName }}
            <button v-if="!presetPersonId" @click="clearPerson" class="clear-btn">✕</button>
          </div>
        </div>

        <div v-if="error" class="error-msg">{{ error }}</div>

        <button class="btn-submit" :disabled="!title.trim() || submitting" @click="submit">
          {{ submitting ? 'Đang tạo...' : 'Tạo album' }}
        </button>
      </div>

      <div v-else class="done-msg">
        Album đã tạo — đang chờ admin duyệt
        <br />
        <button class="btn-submit" @click="$emit('close')">Đóng</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { albumsApi, personsApi } from '../api';

const props = defineProps<{ presetPersonId?: string }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'created', album: any): void }>();

const title = ref('');
const description = ref('');
const personSearch = ref('');
const personResults = ref<any[]>([]);
const selectedPerson = ref<any>(null);
const submitting = ref(false);
const done = ref(false);
const error = ref('');

let allPersons: any[] = [];

onMounted(async () => {
  if (props.presetPersonId) {
    const res = await personsApi.get(props.presetPersonId);
    selectedPerson.value = res.data;
    personSearch.value = res.data.fullName;
  } else {
    const res = await personsApi.list();
    allPersons = res.data;
  }
});

function filterPersons() {
  const q = personSearch.value.trim().toLowerCase();
  if (!q) { personResults.value = []; return; }
  personResults.value = allPersons
    .filter(p => p.fullName.toLowerCase().includes(q))
    .slice(0, 6);
}

function selectPerson(p: any) {
  selectedPerson.value = p;
  personSearch.value = p.fullName;
  personResults.value = [];
}

function clearPerson() {
  selectedPerson.value = null;
  personSearch.value = '';
}

async function submit() {
  if (!title.value.trim()) return;
  submitting.value = true;
  error.value = '';
  try {
    const album = await albumsApi.create({
      title: title.value.trim(),
      description: description.value.trim() || undefined,
      personId: selectedPerson.value?.id || undefined,
    });
    done.value = true;
    emit('created', album.data);
  } catch (e: any) {
    error.value = e.response?.data?.error ?? 'Đã có lỗi xảy ra.';
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 200; display: flex; align-items: center; justify-content: center; }
.modal { background: #fff; border-radius: 12px; padding: 28px; width: 420px; max-width: 92vw; position: relative; }
.close-btn { position: absolute; top: 12px; right: 12px; background: none; border: none; font-size: 18px; cursor: pointer; color: #57606a; }
h3 { margin: 0 0 18px; font-size: 16px; color: #24292f; }
.field { width: 100%; box-sizing: border-box; border: 1px solid #d0d7de; border-radius: 6px; padding: 8px 10px; font-size: 13px; margin-bottom: 10px; outline: none; }
.field:focus { border-color: #0969da; }
.textarea { resize: vertical; font-family: inherit; }
.field-group { position: relative; margin-bottom: 10px; }
.field-label { display: block; font-size: 11px; color: #57606a; margin-bottom: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
.field-group .field { margin-bottom: 0; }
.person-dropdown { position: absolute; left: 0; right: 0; background: #fff; border: 1px solid #d0d7de; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 10; max-height: 200px; overflow-y: auto; }
.person-item { display: block; width: 100%; padding: 8px 12px; background: none; border: none; border-bottom: 1px solid #f0f0f0; cursor: pointer; text-align: left; font-size: 13px; }
.person-item:last-child { border-bottom: none; }
.person-item:hover { background: #f6f8fa; }
.selected-person { display: flex; align-items: center; justify-content: space-between; background: #ddf4ff; border: 1px solid #54aeff; border-radius: 6px; padding: 6px 10px; font-size: 13px; color: #0969da; margin-top: 4px; }
.clear-btn { background: none; border: none; cursor: pointer; font-size: 12px; color: #57606a; padding: 0 2px; }
.error-msg { color: #cf222e; font-size: 13px; margin-bottom: 10px; }
.btn-submit { width: 100%; padding: 10px; background: #0969da; color: #fff; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; margin-top: 4px; }
.btn-submit:disabled { background: #8c959f; cursor: not-allowed; }
.btn-submit:hover:not(:disabled) { background: #0860ca; }
.done-msg { text-align: center; color: #2da44e; font-size: 14px; padding: 12px 0; line-height: 1.8; }
</style>
