<template>
  <div class="person-node" :class="{ deceased: data.isAlive === false, collapsed: data.isCollapsed }">
    <Handle type="target" :position="Position.Top" />
    <Handle type="source" :position="Position.Bottom" />

    <div class="card-body">
      <div class="avatar">
        <img v-if="data.avatarUrl" :src="data.avatarUrl + '?v=' + new Date(data.updatedAt || 0).getTime()" :alt="data.fullName" />
        <span v-else>{{ data.gender === 'female' ? '👩' : '👨' }}</span>
      </div>
      <div class="info">
        <div class="gen-badge">Thế hệ {{ data.generation }}</div>
        <div class="name">{{ data.fullName }}</div>
        <div v-if="data.nickname" class="nickname">"{{ data.nickname }}"</div>
        <div v-if="data.phone" class="detail">📞 {{ data.phone }}</div>
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
import { Handle, Position } from '@vue-flow/core';

defineProps<{ data: Record<string, any> }>();

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('vi-VN');
}
</script>

<style scoped>
.person-node {
  background: #ffffff;
  border: 2px solid #d0d7de;
  border-radius: 10px;
  padding: 8px 10px 6px;
  width: 230px;
  cursor: default;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-shadow: 0 2px 8px rgba(140,149,159,0.1);
}
.person-node:hover { border-color: #0969da; box-shadow: 0 4px 12px rgba(9,105,218,0.15); }
.person-node.deceased { border-color: #d0d7de; opacity: 0.65; }
.person-node.collapsed { border-style: dashed; border-color: #57606a; }

.card-body { display: flex; gap: 9px; align-items: flex-start; }

.avatar { flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.avatar img { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 2px solid #d0d7de; }
.avatar span { font-size: 44px; line-height: 1; }

.info { flex: 1; min-width: 0; padding-top: 1px; }
.gen-badge { background: #ddf4ff; color: #0969da; border-radius: 10px; padding: 1px 7px; font-size: 10px; display: inline-block; margin-bottom: 2px; font-weight: 600; }
.name { font-weight: 700; font-size: 13px; color: #24292f; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nickname { color: #57606a; font-size: 11px; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.detail { color: #57606a; font-size: 11px; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
