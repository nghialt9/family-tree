<template>
  <div class="canvas-wrap">
    <VueFlow
      :nodes="nodes"
      :edges="edges"
      :node-types="nodeTypes"
      fit-view-on-init
      @node-click="onNodeClick"
    >
      <Background pattern-color="#d0d7de" :gap="20" />
      <Controls />
      <MiniMap node-color="#ffffff" mask-color="rgba(246,248,250,0.8)" />
    </VueFlow>

    <div v-if="loading" class="overlay">Đang tải gia phả...</div>
    <div v-if="error" class="overlay error-msg">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, markRaw } from 'vue';
import { VueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import type { NodeMouseEvent } from '@vue-flow/core';
import PersonNode from './PersonNode.vue';
import SpouseConnector from './SpouseConnector.vue';
import { treeApi } from '../api';

const emit = defineEmits<{ (e: 'selectPerson', id: string): void }>();

const nodes = ref<any[]>([]);
const edges = ref<any[]>([]);
const loading = ref(true);
const error = ref('');

const nodeTypes = {
  person: markRaw(PersonNode),
  spouseConnector: markRaw(SpouseConnector),
};

async function loadTree() {
  loading.value = true;
  error.value = '';
  try {
    const res = await treeApi.get();
    nodes.value = res.data.nodes;
    edges.value = res.data.edges;
  } catch {
    error.value = 'Không tải được dữ liệu gia phả.';
  } finally {
    loading.value = false;
  }
}

onMounted(loadTree);
defineExpose({ reload: loadTree });

function onNodeClick(event: NodeMouseEvent) {
  if (event.node.type === 'person') emit('selectPerson', event.node.id);
}
</script>

<style scoped>
.canvas-wrap { width: 100%; height: calc(100vh - 52px); position: relative; background: #f6f8fa; }
.overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #ffffff; border: 1px solid #d0d7de; padding: 20px 32px; border-radius: 8px; font-size: 1rem; color: #24292f; box-shadow: 0 4px 12px rgba(140,149,159,0.15); }
.error-msg { color: #cf222e; border-color: #ffcecb; background: #ffebe9; }
</style>
