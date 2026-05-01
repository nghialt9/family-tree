<template>
  <div class="fg-box" :style="boxStyle">
    <span v-if="data.memberCount" class="fg-count">{{ data.memberCount }} người</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ data: { width: number; height: number; memberCount?: number } }>();

const boxStyle = computed(() => ({
  width:  `${props.data.width}px`,
  height: `${props.data.height}px`,
}));
</script>

<style scoped>
.fg-box {
  position: relative;
  background: rgba(9, 105, 218, 0.04);
  border: 1.5px dashed #b6d4fb;
  border-radius: 16px;
  pointer-events: none;
}
.fg-count {
  position: absolute;
  bottom: 10px;
  right: 14px;
  background: rgba(9, 105, 218, 0.08);
  color: #0969da;
  font-size: 10px;
  font-weight: 600;
  border-radius: 8px;
  padding: 2px 8px;
  border: 1px solid #b6d4fb;
  pointer-events: none;
  white-space: nowrap;
}
</style>
