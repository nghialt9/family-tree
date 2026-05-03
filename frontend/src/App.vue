<template>
  <RouterView />
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', sans-serif; background: #f6f8fa; color: #24292f; }
/* Bootstrap overrides svg { overflow: hidden } which breaks VueFlow edge lines */
.vue-flow svg { overflow: visible; vertical-align: initial; }
</style>
