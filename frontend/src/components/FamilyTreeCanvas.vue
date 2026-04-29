<template>
  <div class="canvas-wrap">
    <VueFlow
      id="family-tree"
      :nodes="displayNodes"
      :edges="displayEdges"
      :node-types="nodeTypes"
      :min-zoom="0.1"
      :max-zoom="2"
      @node-click="onNodeClick"
    >
      <Background pattern-color="#d0d7de" :gap="20" />
      <Controls />
      <MiniMap node-color="#0969da" mask-color="rgba(200,220,240,0.55)" />
    </VueFlow>

    <div v-if="loading" class="overlay">Đang tải gia phả...</div>
    <div v-if="error" class="overlay error-msg">{{ error }}</div>
    <div class="zoom-indicator">{{ Math.round(viewport.zoom * 100) }}%</div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, markRaw, nextTick } from 'vue';
import { VueFlow, useVueFlow, MarkerType } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import type { NodeMouseEvent } from '@vue-flow/core';
import PersonNode from './PersonNode.vue';
import SpouseConnector from './SpouseConnector.vue';
import FamilyGroupNode from './FamilyGroupNode.vue';
import { treeApi } from '../api';

const props = defineProps<{ focusPersonId?: string | null }>();
const emit = defineEmits<{ (e: 'selectPerson', id: string): void }>();

const { fitView, setCenter, viewport } = useVueFlow('family-tree');

const rawNodes = ref<any[]>([]);
const rawEdges = ref<any[]>([]);
const loading = ref(true);
const error = ref('');

// collapsed: set of person IDs whose children are hidden
const collapsed = reactive(new Set<string>());

// personId → direct child personIds (for collapse traversal)
const parentToChildren = ref(new Map<string, string[]>());
// connectorId → direct child personIds
const connectorChildren = ref(new Map<string, string[]>());
// connectorId → spouse parent personIds
const connectorParents = ref(new Map<string, string[]>());

const nodeTypes = {
  person: markRaw(PersonNode),
  spouseConnector: markRaw(SpouseConnector),
  familyGroup: markRaw(FamilyGroupNode),
};

// --- Relationship maps ---

function buildMaps(edges: any[]) {
  const cp = new Map<string, string[]>(); // connector → spouse parents
  const p2c = new Map<string, string[]>();
  const cc = new Map<string, string[]>();

  // Pass 1: connector → its parent persons (from spouse edges)
  for (const e of edges) {
    if (e.type === 'spouse') {
      if (!cp.has(e.target)) cp.set(e.target, []);
      cp.get(e.target)!.push(e.source);
    }
  }

  // Pass 2: person → children, connector → children
  for (const e of edges) {
    if (e.type !== 'parentChild') continue;
    if (e.source.startsWith('connector-')) {
      if (!cc.has(e.source)) cc.set(e.source, []);
      if (!cc.get(e.source)!.includes(e.target)) cc.get(e.source)!.push(e.target);
    }
    const parents = cp.get(e.source) ?? [e.source];
    for (const parentId of parents) {
      if (!p2c.has(parentId)) p2c.set(parentId, []);
      if (!p2c.get(parentId)!.includes(e.target)) p2c.get(parentId)!.push(e.target);
    }
  }

  connectorParents.value = cp;
  parentToChildren.value = p2c;
  connectorChildren.value = cc;
}

function getDescendants(id: string): Set<string> {
  const result = new Set<string>();
  const queue = [...(parentToChildren.value.get(id) ?? [])];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (result.has(cur)) continue;
    result.add(cur);
    for (const child of parentToChildren.value.get(cur) ?? []) queue.push(child);
  }
  return result;
}

function toggleCollapse(id: string) {
  if (collapsed.has(id)) {
    collapsed.delete(id);
  } else {
    collapsed.add(id);
  }
}

// --- Derived visibility ---

const hiddenPersonIds = computed<Set<string>>(() => {
  const hidden = new Set<string>();
  for (const id of collapsed) {
    for (const d of getDescendants(id)) hidden.add(d);
  }
  return hidden;
});

const hiddenConnectorIds = computed<Set<string>>(() => {
  const hidden = new Set<string>();
  for (const [connId, spouseIds] of connectorParents.value) {
    // Hide connector if any spouse-parent is hidden
    if (spouseIds.some(s => hiddenPersonIds.value.has(s))) {
      hidden.add(connId);
      continue;
    }
    // Also hide if connector has children and all of them are hidden
    const children = connectorChildren.value.get(connId) ?? [];
    if (children.length > 0 && children.every(c => hiddenPersonIds.value.has(c))) {
      hidden.add(connId);
    }
  }
  return hidden;
});

function isHidden(id: string): boolean {
  return id.startsWith('connector-')
    ? hiddenConnectorIds.value.has(id)
    : hiddenPersonIds.value.has(id);
}

// --- Computed display data ---

const displayNodes = computed(() =>
  rawNodes.value.map(n => {
    // Family group background panel — always visible, non-interactive, renders behind
    if (n.type === 'familyGroup') {
      return {
        ...n,
        zIndex: -1,
        draggable: false,
        selectable: false,
        connectable: false,
        focusable: false,
      };
    }
    if (n.type !== 'person') {
      return { ...n, hidden: isHidden(n.id) };
    }
    const hasChildren = (parentToChildren.value.get(n.id) ?? []).length > 0;
    const isCollapsed = collapsed.has(n.id);
    const hiddenCount = isCollapsed ? getDescendants(n.id).size : 0;
    return {
      ...n,
      hidden: isHidden(n.id),
      data: {
        ...n.data,
        hasChildren,
        isCollapsed,
        hiddenCount,
        onToggleCollapse: toggleCollapse,
      },
    };
  })
);

const displayEdges = computed(() =>
  rawEdges.value.map(e => ({
    ...e,
    hidden: isHidden(e.source) || isHidden(e.target),
    type: e.type === 'parentChild' ? 'smoothstep' : 'straight',
    style: e.type === 'parentChild'
      ? { stroke: '#0969da', strokeWidth: 1.5 }
      : { stroke: '#c8d1d9', strokeWidth: 1.5 },
    markerEnd: e.type === 'parentChild'
      ? { type: MarkerType.ArrowClosed, color: '#0969da', width: 14, height: 14 }
      : undefined,
    animated: false,
  }))
);

// --- Load & fit ---

function rAF() { return new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(r))); }

function focusOnPerson() {
  const focusId = props.focusPersonId;
  if (focusId) {
    const target = rawNodes.value.find(n => n.type === 'person' && n.id === focusId);
    if (target) {
      setCenter(target.position.x + 115, target.position.y + 60, { zoom: 1.2, duration: 0 });
      return;
    }
  }
  const roots = rawNodes.value
    .filter(n => n.type === 'person' && n.data?.generation === 1)
    .map(n => ({ id: n.id }));
  fitView({ nodes: roots.length > 0 ? roots : undefined, padding: 0.3, duration: 0 });
}

async function loadTree() {
  loading.value = true;
  error.value = '';
  collapsed.clear();
  try {
    const res = await treeApi.get();
    rawNodes.value = res.data.nodes;
    rawEdges.value = res.data.edges;
    buildMaps(res.data.edges);
    // Wait for Vue to flush DOM updates, then two paint frames for VueFlow to measure nodes
    await nextTick();
    await rAF();
    focusOnPerson();
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
  // familyGroup and spouseConnector clicks are intentionally ignored
}
</script>

<style scoped>
.canvas-wrap {
  flex: 1;
  min-height: 0;
  width: 100%;
  position: relative;
  background: #f6f8fa;
}
.overlay {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: #ffffff; border: 1px solid #d0d7de; padding: 20px 32px;
  border-radius: 8px; font-size: 1rem; color: #24292f;
  box-shadow: 0 4px 12px rgba(140,149,159,0.15);
}
.error-msg { color: #cf222e; border-color: #ffcecb; background: #ffebe9; }
:deep(.vue-flow__minimap) {
  background: #f6f8fa;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(140,149,159,0.2);
}
.zoom-indicator {
  position: absolute; bottom: 52px; right: 12px;
  background: rgba(255,255,255,0.9); border: 1px solid #d0d7de;
  border-radius: 6px; padding: 3px 8px; font-size: 11px; color: #57606a;
  pointer-events: none; z-index: 5;
}
</style>
