<template>
  <div class="spouse-connector">
    <Handle type="target" :position="Position.Left" />
    <Handle type="target" :position="Position.Right" />
    <Handle type="source" :position="Position.Bottom" />
    <span class="icon">💍</span>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';
</script>

<style scoped>
.spouse-connector {
  width: 30px;
  height: 30px;
  background: #fff;
  border: 2px solid #d0d7de;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 4px rgba(140,149,159,0.2);
}
.icon { font-size: 13px; line-height: 1; }
</style>
