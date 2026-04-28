<template>
  <div class="spouse-connector">
    <Handle type="target" :position="Position.Left" />
    <Handle type="target" :position="Position.Right" />
    <Handle type="source" :position="Position.Bottom" />
    <span>💍</span>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
</script>

<style scoped>
.spouse-connector { background: transparent; border: none; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 16px; }
</style>
