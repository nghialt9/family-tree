<template>
  <div class="person-node" :class="{ deceased: data.isAlive === false, collapsed: data.isCollapsed }">
    <Handle type="target" :position="Position.Top" />
    <Handle type="source" :position="Position.Bottom" />

    <div class="avatar">
      <img v-if="data.avatarUrl" :src="data.avatarUrl" :alt="data.fullName" />
      <span v-else>{{ data.gender === 'female' ? '👩' : '👨' }}</span>
    </div>

    <div class="info">
      <div class="gen-badge">Thế hệ {{ data.generation }}</div>
      <div class="name">{{ data.fullName }}</div>
      <div v-if="data.nickname" class="nickname">"{{ data.nickname }}"</div>
      <div v-if="data.birthDate" class="detail">🎂 {{ formatDate(data.birthDate) }}</div>
      <div v-if="data.deathDate" class="detail deceased-tag">✝ {{ formatDate(data.deathDate) }}</div>
    </div>

    <div class="actions">
      <button class="btn-detail" @click.stop="$emit('openDetail', data.id)">Chi tiết</button>
      <button
        v-if="data.hasChildren"
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
import { Handle, Position } from '@vue-flow/core';

defineProps<{ data: Record<string, any> }>();
defineEmits<{ (e: 'openDetail', id: string): void }>();

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('vi-VN');
}
</script>

<style scoped>
.person-node {
  background: #ffffff;
  border: 2px solid #d0d7de;
  border-radius: 10px;
  padding: 10px 12px 8px;
  width: 220px;
  cursor: default;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-shadow: 0 2px 8px rgba(140,149,159,0.1);
}
.person-node:hover { border-color: #0969da; box-shadow: 0 4px 12px rgba(9,105,218,0.15); }
.person-node.deceased { border-color: #d0d7de; opacity: 0.65; }
.person-node.collapsed { border-style: dashed; border-color: #57606a; }
.avatar { text-align: center; font-size: 36px; margin-bottom: 6px; }
.avatar img { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 2px solid #d0d7de; }
.gen-badge { background: #ddf4ff; color: #0969da; border-radius: 10px; padding: 1px 8px; font-size: 10px; display: inline-block; margin-bottom: 4px; font-weight: 600; }
.name { font-weight: 700; font-size: 13px; color: #24292f; }
.nickname { color: #57606a; font-size: 11px; font-style: italic; }
.detail { color: #57606a; font-size: 11px; margin-top: 2px; }
.deceased-tag { color: #cf222e; }
.actions { margin-top: 8px; display: flex; gap: 6px; }
.btn-detail {
  flex: 1;
  background: #f6f8fa; color: #57606a; border: 1px solid #d0d7de;
  border-radius: 6px; padding: 3px 6px; font-size: 11px; cursor: pointer;
}
.btn-detail:hover { background: #eaeef2; color: #24292f; }
.btn-collapse {
  background: #f6f8fa; color: #57606a; border: 1px solid #d0d7de;
  border-radius: 6px; padding: 3px 8px; font-size: 11px; cursor: pointer;
  white-space: nowrap;
}
.btn-collapse:hover { background: #eaeef2; color: #24292f; }
.btn-collapse.is-collapsed { background: #fff8c5; border-color: #d4a72c; color: #633c01; font-weight: 600; }
.btn-collapse.is-collapsed:hover { background: #fae17d; }
</style>
