<template>
  <div class="person-node" :class="{ deceased: data.isAlive === false, collapsed: data.isCollapsed }">
    <Handle type="target" :position="Position.Top" />
    <Handle type="source" :position="Position.Bottom" />

    <div class="gen-stripe" :style="{ background: genColor.accent }" />

    <div class="card-body">
      <div class="avatar">
        <img
          v-if="data.avatarUrl"
          :src="data.avatarUrl + '?v=' + new Date(data.updatedAt || 0).getTime()"
          :alt="data.fullName"
          :style="data.isAlive === false ? { filter: 'grayscale(1)' } : {}"
        />
        <div
          v-else
          class="avatar-initials"
          :style="{ background: data.isAlive === false ? '#8b9194' : avatarBg }"
        >{{ initials }}</div>
      </div>
      <div class="info">
        <div
          class="gen-badge"
          :style="{ background: genColor.badgeBg, color: genColor.accent }"
        >Thế hệ {{ data.generation }}</div>
        <div class="name">{{ data.fullName }}</div>
        <div class="nickname-row">
          <span v-if="data.nickname" class="nickname">"{{ data.nickname }}"</span>
          <span v-if="data.familyCount > 1 && data.hasChildren" class="family-size" :style="{ background: genColor.badgeBg, color: genColor.accent }">{{ data.familyCount }} người</span>
        </div>
        <a v-if="data.phone" :href="'tel:' + data.phone" class="detail phone-link" @click.stop>📞 {{ data.phone }}</a>
        <div v-if="data.birthDate" class="detail">🎂 {{ formatDate(data.birthDate) }}</div>
        <div v-if="data.deathDate" class="detail deceased-tag">✝ {{ formatDate(data.deathDate) }}</div>
      </div>
    </div>

    <div v-if="data.hasChildren" class="actions">
      <button
        class="btn-collapse"
        :class="{ 'is-collapsed': data.isCollapsed }"
        @click.stop="data.onToggleCollapse?.(data.id)"
        :title="data.isCollapsed ? 'Hiện ' + data.hiddenCount + ' người' : 'Thu gọn'"
      >
        {{ data.isCollapsed ? '▶ ' + data.hiddenCount : '▼' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Handle, Position } from '@vue-flow/core';

const props = defineProps<{ data: Record<string, any> }>();

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('vi-VN');
}

const GEN_COLORS = [
  { accent: '#2da44e', badgeBg: '#e6ffec' }, // gen 1 — green
  { accent: '#0969da', badgeBg: '#ddf4ff' }, // gen 2 — blue
  { accent: '#8250df', badgeBg: '#fbefff' }, // gen 3 — purple
  { accent: '#d4a72c', badgeBg: '#fffbe6' }, // gen 4 — amber
  { accent: '#cf222e', badgeBg: '#ffebe9' }, // gen 5+ — red
];

const genColor = computed(() => {
  const idx = Math.min((props.data.generation ?? 1) - 1, GEN_COLORS.length - 1);
  return GEN_COLORS[idx];
});

const initials = computed(() => {
  const parts = (props.data.fullName ?? '').trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
});

const avatarBg = computed(() => {
  const seed = props.data.id ?? props.data.fullName ?? '';
  const colors = ['#0969da', '#2da44e', '#9a3ecb', '#bc4c00', '#1b7c83', '#8250df'];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return colors[h % colors.length];
});
</script>

<style scoped>
.person-node {
  position: relative;
  background: #ffffff;
  border: 1.5px solid #d0d7de;
  border-radius: 10px;
  padding: 10px 10px 6px;
  width: 230px;
  cursor: default;
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-shadow: 0 2px 8px rgba(140,149,159,0.1);
}
.person-node:hover { border-color: #0969da; box-shadow: 0 4px 12px rgba(9,105,218,0.18); }
.person-node.deceased { opacity: 0.62; }
.person-node.collapsed { border-style: dashed; border-color: #57606a; }

.gen-stripe { position: absolute; top: 0; left: 0; right: 0; height: 3px; }

.card-body { display: flex; gap: 9px; align-items: flex-start; }

.avatar { flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.avatar img { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 2px solid #d0d7de; transition: filter 0.2s; }
.avatar-initials {
  width: 64px; height: 64px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;
  user-select: none; flex-shrink: 0;
}

.info { flex: 1; min-width: 0; padding-top: 1px; }
.gen-badge { border-radius: 10px; padding: 1px 7px; font-size: 10px; display: inline-block; margin-bottom: 2px; font-weight: 600; }
.name { font-weight: 700; font-size: 13px; color: #24292f; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nickname-row { display: flex; align-items: center; gap: 4px; min-height: 14px; }
.nickname { color: #444c56; font-size: 11px; font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 1; min-width: 0; }
.family-size { font-size: 10px; border-radius: 8px; padding: 0 5px; white-space: nowrap; flex-shrink: 0; }
.detail { color: #444c56; font-size: 11px; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
.phone-link { text-decoration: none; }
.phone-link:hover { color: #0969da; text-decoration: underline; }
.deceased-tag { color: #cf222e; }

.actions { margin-top: 5px; display: flex; }
.btn-collapse {
  width: 100%;
  background: #f6f8fa; color: #57606a; border: 1px solid #d0d7de;
  border-radius: 6px; padding: 3px 8px; font-size: 11px; cursor: pointer;
  white-space: nowrap; text-align: center;
}
.btn-collapse:hover { background: #eaeef2; color: #24292f; }
.btn-collapse.is-collapsed { background: #fff8c5; border-color: #d4a72c; color: #633c01; font-weight: 600; }
.btn-collapse.is-collapsed:hover { background: #fae17d; }
</style>
