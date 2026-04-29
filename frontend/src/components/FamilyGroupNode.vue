<template>
  <div class="fg-box" :style="boxStyle" />
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ data: { width: number; height: number } }>();

const boxStyle = computed(() => ({
  width:  `${props.data.width}px`,
  height: `${props.data.height}px`,
}));
</script>

<style scoped>
.fg-box {
  background: rgba(9, 105, 218, 0.04);
  border: 1.5px dashed #b6d4fb;
  border-radius: 16px;
  pointer-events: none;
}
</style>
