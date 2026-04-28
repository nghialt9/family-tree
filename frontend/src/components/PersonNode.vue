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
.person-node { background: #ffffff; border: 2px solid #d0d7de; border-radius: 10px; padding: 12px; width: 220px; cursor: default; transition: border-color 0.2s, box-shadow 0.2s; box-shadow: 0 2px 8px rgba(140,149,159,0.1); }
.person-node:hover { border-color: #0969da; box-shadow: 0 4px 12px rgba(9,105,218,0.15); }
.person-node.deceased { border-color: #d0d7de; opacity: 0.6; }
.avatar { text-align: center; font-size: 36px; margin-bottom: 8px; }
.avatar img { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; }
.gen-badge { background: #ddf4ff; color: #0969da; border-radius: 10px; padding: 1px 8px; font-size: 10px; display: inline-block; margin-bottom: 4px; font-weight: 600; }
.name { font-weight: 700; font-size: 13px; color: #24292f; }
.nickname { color: #57606a; font-size: 11px; font-style: italic; }
.detail { color: #57606a; font-size: 11px; margin-top: 2px; }
.deceased-tag { color: #cf222e; }
.actions { margin-top: 8px; text-align: center; }
.btn-detail { background: #f6f8fa; color: #57606a; border: 1px solid #d0d7de; border-radius: 6px; padding: 3px 10px; font-size: 11px; cursor: pointer; }
.btn-detail:hover { background: #eaeef2; color: #24292f; }
</style>
