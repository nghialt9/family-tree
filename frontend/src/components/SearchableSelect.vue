<template>
  <div class="ss" ref="rootEl">
    <div class="ss-row">
      <input
        ref="inputEl"
        v-model="query"
        class="ss-input"
        :placeholder="placeholder || '-- Tìm hoặc chọn --'"
        autocomplete="off"
        @focus="onFocus"
        @blur="onBlur"
        @input="highlightIdx = 0"
        @keydown.escape.prevent="close"
        @keydown.enter.prevent="confirmHighlighted"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
      />
      <button v-if="modelValue" type="button" class="ss-clear" @mousedown.prevent="clear">×</button>
    </div>

    <Teleport to="body">
      <ul v-if="open && filtered.length" class="ss-list" :style="listStyle">
        <li
          v-for="(opt, i) in filtered"
          :key="opt.value"
          :class="{ 'ss-active': i === highlightIdx }"
          @mousedown.prevent="pick(opt)"
          @mousemove="highlightIdx = i"
        >
          {{ opt.label }}
        </li>
      </ul>
      <div v-else-if="open && query && !filtered.length" class="ss-empty" :style="listStyle">
        Không tìm thấy
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

interface Opt { value: string; label: string; }

const props = defineProps<{ modelValue: string; options: Opt[]; placeholder?: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const rootEl = ref<HTMLDivElement | null>(null);
const inputEl = ref<HTMLInputElement | null>(null);
const query = ref('');
const open = ref(false);
const highlightIdx = ref(0);
const listStyle = ref<Record<string, string>>({});

function removeAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd');
}

function normalize(s: string): string {
  return removeAccents(s.toLowerCase().trim());
}

function labelOf(val: string) {
  return props.options.find(o => o.value === val)?.label ?? '';
}

watch(() => props.modelValue, (val) => {
  query.value = val ? labelOf(val) : '';
}, { immediate: true });

// Re-sync label when options list loads asynchronously
watch(() => props.options, () => {
  if (props.modelValue) query.value = labelOf(props.modelValue);
});

const filtered = computed(() => {
  const q = normalize(query.value);
  // If query matches the current selection exactly, show all options
  if (props.modelValue && q === normalize(labelOf(props.modelValue))) return props.options;
  if (!q) return props.options;
  return props.options.filter(o => normalize(o.label).includes(q));
});

function updatePosition() {
  const rect = inputEl.value?.getBoundingClientRect();
  if (!rect) return;
  listStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 2}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    zIndex: '9999',
  };
}

function onFocus() {
  updatePosition();
  open.value = true;
  highlightIdx.value = 0;
  inputEl.value?.select();
}

function onBlur() {
  setTimeout(() => {
    open.value = false;
    query.value = props.modelValue ? labelOf(props.modelValue) : '';
  }, 200);
}

function close() {
  open.value = false;
  query.value = props.modelValue ? labelOf(props.modelValue) : '';
  inputEl.value?.blur();
}

function pick(opt: Opt) {
  emit('update:modelValue', opt.value);
  query.value = opt.label;
  open.value = false;
}

function clear() {
  emit('update:modelValue', '');
  query.value = '';
  open.value = false;
}

function confirmHighlighted() {
  const opt = filtered.value[highlightIdx.value];
  if (opt) pick(opt);
  else close();
}

function move(dir: 1 | -1) {
  const len = filtered.value.length;
  if (!len) return;
  highlightIdx.value = (highlightIdx.value + dir + len) % len;
}
</script>

<style scoped>
.ss { position: relative; width: 100%; }
.ss-row { position: relative; display: flex; align-items: center; }
.ss-input {
  background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px;
  padding: 8px 28px 8px 10px; color: #24292f; font-size: 13px;
  width: 100%; box-sizing: border-box;
}
.ss-input:focus { outline: none; border-color: #0969da; box-shadow: 0 0 0 3px rgba(9,105,218,0.1); }
.ss-clear {
  position: absolute; right: 7px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; color: #57606a;
  font-size: 16px; line-height: 1; padding: 2px 4px;
}
.ss-clear:hover { color: #cf222e; }
</style>

<style>
.ss-list {
  background: #fff; border: 1px solid #d0d7de; border-radius: 6px;
  max-height: 200px; overflow-y: auto; list-style: none;
  padding: 4px 0; margin: 0;
  box-shadow: 0 4px 12px rgba(140,149,159,0.2);
}
.ss-list li {
  padding: 7px 12px; font-size: 13px; cursor: pointer; color: #24292f; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ss-list li:hover, .ss-active { background: #f0f6ff; color: #0969da; }
.ss-empty {
  background: #fff; border: 1px solid #d0d7de; border-radius: 6px;
  padding: 10px 12px; font-size: 13px; color: #57606a;
  box-shadow: 0 4px 12px rgba(140,149,159,0.2);
}
</style>
