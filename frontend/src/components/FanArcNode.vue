<template>
  <div class="fan-arc-node" :class="{ deceased: data.isAlive === false }">
    <div class="fan-avatar">
      <img v-if="data.avatarUrl" :src="data.avatarUrl" :alt="data.fullName" class="fan-img" />
      <div v-else class="fan-initials" :style="{ background: avatarBg }">{{ initials }}</div>
    </div>
    <div class="fan-name">{{ shortName }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ data: Record<string, any> }>();

const initials = computed(() => {
  const parts = (props.data.fullName ?? '').trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
});

const shortName = computed(() => {
  const name: string = props.data.fullName ?? '';
  return name.length > 12 ? name.slice(0, 11) + '…' : name;
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
.fan-arc-node {
  width: 60px;
  background: #ffffff;
  border: 1.5px solid #d0d7de;
  border-radius: 8px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  cursor: default;
  box-shadow: 0 1px 4px rgba(140,149,159,0.1);
  transition: border-color 0.15s;
}
.fan-arc-node:hover { border-color: #0969da; }
.fan-arc-node.deceased { opacity: 0.62; }
.fan-img { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
.fan-initials {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 10px; font-weight: 700;
}
.fan-name {
  font-size: 9px; font-weight: 600; color: #24292f;
  text-align: center; line-height: 1.2;
  max-width: 54px; overflow: hidden;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
</style>
