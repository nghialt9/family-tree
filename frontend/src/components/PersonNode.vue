<template>
  <div class="person-node" :class="{ deceased: data.isAlive === false }">
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
      <div v-if="data.phone" class="detail">📞 {{ data.phone }}</div>
    </div>

    <div class="actions">
      <button class="btn-detail" @click.stop="$emit('openDetail', data.id)">Chi tiết ▼</button>
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
.person-node { background: #161b22; border: 2px solid #30363d; border-radius: 10px; padding: 12px; width: 220px; cursor: default; transition: border-color 0.2s; }
.person-node:hover { border-color: #58a6ff; }
.person-node.deceased { border-color: #6e7681; opacity: 0.75; }
.avatar { text-align: center; font-size: 36px; margin-bottom: 8px; }
.avatar img { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; }
.gen-badge { background: #0f3460; color: #58a6ff; border-radius: 10px; padding: 1px 8px; font-size: 10px; display: inline-block; margin-bottom: 4px; }
.name { font-weight: bold; font-size: 13px; color: #e94560; }
.nickname { color: #8b949e; font-size: 11px; font-style: italic; }
.detail { color: #8b949e; font-size: 11px; margin-top: 2px; }
.deceased-tag { color: #f85149; }
.actions { margin-top: 8px; text-align: center; }
.btn-detail { background: #21262d; color: #8b949e; border: 1px solid #30363d; border-radius: 6px; padding: 3px 10px; font-size: 11px; cursor: pointer; }
.btn-detail:hover { background: #30363d; color: #e6edf3; }
</style>
