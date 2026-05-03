<template>
  <div class="fan-wrap">
    <VueFlow
      id="fan-chart"
      :nodes="fanLayout.nodes"
      :edges="fanLayout.edges"
      :node-types="nodeTypes"
      :min-zoom="0.1"
      :max-zoom="2"
      @node-click="onNodeClick"
      @node-double-click="onNodeDblClick"
    >
      <Background pattern-color="#d0d7de" :gap="20" />
      <Controls />
      <MiniMap node-color="#0969da" mask-color="rgba(200,220,240,0.55)" />
    </VueFlow>

    <div v-if="loading" class="overlay">Đang tải gia phả...</div>
    <div v-else-if="error" class="overlay error-msg">{{ error }}</div>
    <div v-else-if="!defaultCenter" class="overlay">
      Tài khoản chưa được liên kết với người trong gia phả
    </div>

    <div v-if="defaultCenter" class="fan-controls">
      <span class="gen-label">Thế hệ: {{ fanGenerations }}</span>
      <input type="range" min="1" max="5" v-model.number="fanGenerations" class="gen-slider" />
      <button
        v-if="fanCenter !== defaultCenter"
        class="btn-reset"
        @click="fanCenter = defaultCenter!"
      >⌂ Về tôi</button>
    </div>

    <div class="zoom-indicator">{{ Math.round(viewport.zoom * 100) }}%</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, markRaw, nextTick, readonly } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import type { NodeMouseEvent } from '@vue-flow/core';
import PersonNode from './PersonNode.vue';
import FanArcNode from './FanArcNode.vue';
import { treeApi } from '../api';
import { useAuthStore } from '../stores/auth';

const emit = defineEmits<{ (e: 'selectPerson', id: string): void }>();

const { fitView, setCenter, viewport } = useVueFlow('fan-chart');
const auth = useAuthStore();

const rawNodes = ref<any[]>([]);
const loading = ref(true);
const error = ref('');

const nodeTypes = {
  person: markRaw(PersonNode),
  fanArc: markRaw(FanArcNode),
};

const defaultCenter = computed<string | null>(() => auth.linkedPersonId ?? null);
const fanCenter = ref<string | null>(null);
const fanGenerations = ref(3);

const descendantMap = ref(new Map<string, string[]>());
const ancestorMap = ref(new Map<string, string[]>());

function buildMaps(edges: any[]) {
  const connectorParents = new Map<string, string[]>();
  const pToC = new Map<string, string[]>();

  for (const e of edges) {
    if (e.type === 'spouse') {
      if (!connectorParents.has(e.target)) connectorParents.set(e.target, []);
      connectorParents.get(e.target)!.push(e.source);
    }
  }
  for (const e of edges) {
    if (e.type !== 'parentChild') continue;
    const parents = connectorParents.get(e.source) ?? [e.source];
    for (const parentId of parents) {
      if (parentId.startsWith('connector-')) continue;
      if (!pToC.has(parentId)) pToC.set(parentId, []);
      if (!pToC.get(parentId)!.includes(e.target)) pToC.get(parentId)!.push(e.target);
    }
  }

  const cToP = new Map<string, string[]>();
  for (const [parentId, children] of pToC) {
    for (const childId of children) {
      if (!cToP.has(childId)) cToP.set(childId, []);
      if (!cToP.get(childId)!.includes(parentId)) cToP.get(childId)!.push(parentId);
    }
  }

  descendantMap.value = pToC;
  ancestorMap.value = cToP;
}

const BASE_RING_RADIUS = 260;
const MIN_NODE_ARC_PX = 250; // minimum arc spacing per node to prevent overlap

function computeLayout(): { nodes: any[]; edges: any[] } {
  const centerId = fanCenter.value;
  if (!centerId) return { nodes: [], edges: [] };

  const nodeById = new Map(rawNodes.value.filter(n => n.type === 'person').map(n => [n.id, n]));
  if (!nodeById.has(centerId)) return { nodes: [], edges: [] };

  const placed = new Set<string>();
  const resultNodes: any[] = [];
  const resultEdges: any[] = [];

  const centerNode = nodeById.get(centerId)!;
  resultNodes.push({
    ...centerNode,
    type: 'person',
    position: { x: -115, y: -40 },
    data: { ...centerNode.data, hasChildren: false, onToggleCollapse: undefined },
    zIndex: 2,
  });
  placed.add(centerId);

  function placeRing(
    ids: string[],
    ring: number,
    startAngle: number,
    endAngle: number,
    edgeSourceMap: Map<string, string>,
  ) {
    if (ids.length === 0) return;
    const isOuter = ring >= 3;
    const offsetX = isOuter ? -30 : -115;
    const offsetY = isOuter ? -26 : -40;
    const step = (endAngle - startAngle) / ids.length;

    // Expand radius when many nodes would overlap in the arc
    const arcRad = ((endAngle - startAngle) * Math.PI) / 180;
    const minR = ids.length > 1 ? (ids.length * MIN_NODE_ARC_PX) / arcRad : ring * BASE_RING_RADIUS;
    const r = Math.max(ring * BASE_RING_RADIUS, minR);

    ids.forEach((id, i) => {
      const angle = startAngle + step * (i + 0.5);
      const rad = (angle * Math.PI) / 180;
      const node = nodeById.get(id);
      if (!node) return;

      resultNodes.push({
        ...node,
        type: isOuter ? 'fanArc' : 'person',
        position: { x: r * Math.cos(rad) + offsetX, y: r * Math.sin(rad) + offsetY },
        data: { ...node.data, hasChildren: false, onToggleCollapse: undefined },
        zIndex: 1,
      });
      placed.add(id);

      const sourceId = edgeSourceMap.get(id);
      if (sourceId) {
        resultEdges.push({
          id: `fan-${sourceId}-${id}`,
          source: sourceId,
          target: id,
          type: 'straight',
          style: { stroke: '#d0d7de', strokeWidth: 1.5 },
          animated: false,
        });
      }
    });
  }

  // Ancestors: semicircle 180°–360° (sin negative → y negative → above center)
  let ancestorLayer = [centerId];
  for (let ring = 1; ring <= fanGenerations.value; ring++) {
    const nextLayer: string[] = [];
    const edgeMap = new Map<string, string>();
    for (const personId of ancestorLayer) {
      for (const parentId of (ancestorMap.value.get(personId) ?? [])) {
        if (!placed.has(parentId) && !nextLayer.includes(parentId)) {
          nextLayer.push(parentId);
          edgeMap.set(parentId, personId);
        }
      }
    }
    placeRing(nextLayer, ring, 180, 360, edgeMap);
    ancestorLayer = nextLayer;
  }

  // Descendants: semicircle 0°–180° (sin positive → y positive → below center)
  let descendantLayer = [centerId];
  for (let ring = 1; ring <= fanGenerations.value; ring++) {
    const nextLayer: string[] = [];
    const edgeMap = new Map<string, string>();
    for (const personId of descendantLayer) {
      for (const childId of (descendantMap.value.get(personId) ?? [])) {
        if (!placed.has(childId) && !nextLayer.includes(childId)) {
          nextLayer.push(childId);
          edgeMap.set(childId, personId);
        }
      }
    }
    placeRing(nextLayer, ring, 0, 180, edgeMap);
    descendantLayer = nextLayer;
  }

  return { nodes: resultNodes, edges: resultEdges };
}

const fanLayout = computed(() => computeLayout());

const personNodes = computed(() => rawNodes.value.filter(n => n.type === 'person'));

function rAF() { return new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(r))); }

async function loadTree() {
  initialLoadDone = false;
  loading.value = true;
  error.value = '';
  try {
    const res = await treeApi.get();
    rawNodes.value = res.data.nodes;
    buildMaps(res.data.edges);
    fanCenter.value = defaultCenter.value;
    await nextTick();
    await rAF();
    fitView({ padding: 0.3, duration: 0 });
  } catch {
    error.value = 'Không tải được dữ liệu gia phả.';
  } finally {
    loading.value = false;
    initialLoadDone = true;
  }
}

function focusOnNode(id: string) {
  const node = fanLayout.value.nodes.find(n => n.id === id);
  if (!node) return;
  const cx = node.type === 'fanArc' ? node.position.x + 30 : node.position.x + 115;
  const cy = node.type === 'fanArc' ? node.position.y + 26 : node.position.y + 40;
  setCenter(cx, cy, { zoom: 1.2, duration: 600 });
}

let initialLoadDone = false;

watch([fanCenter, fanGenerations], async () => {
  if (!initialLoadDone) return;
  await nextTick();
  await rAF();
  fitView({ padding: 0.3, duration: 400 });
});

onMounted(loadTree);
defineExpose({ reload: loadTree, focusOnNode, personNodes: readonly(personNodes) });

function onNodeClick(event: NodeMouseEvent) {
  if (event.node.type === 'person' || event.node.type === 'fanArc') {
    emit('selectPerson', event.node.id);
  }
}

function onNodeDblClick(event: NodeMouseEvent) {
  if (event.node.type === 'person' || event.node.type === 'fanArc') {
    fanCenter.value = event.node.id;
  }
}
</script>

<style scoped>
.fan-wrap {
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
  box-shadow: 0 4px 12px rgba(140,149,159,0.15); text-align: center;
}
.error-msg { color: #cf222e; border-color: #ffcecb; background: #ffebe9; }
.fan-controls {
  position: absolute; top: 52px; right: 12px;
  background: rgba(255,255,255,0.95); border: 1px solid #d0d7de;
  border-radius: 8px; padding: 8px 12px;
  display: flex; flex-direction: column; gap: 6px;
  z-index: 5; box-shadow: 0 2px 8px rgba(140,149,159,0.15); min-width: 140px;
}
.gen-label { font-size: 12px; color: #57606a; font-weight: 500; }
.gen-slider { width: 100%; cursor: pointer; accent-color: #0969da; }
.btn-reset {
  background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px;
  padding: 4px 8px; font-size: 11px; color: #0969da; cursor: pointer; text-align: center;
}
.btn-reset:hover { background: #ddf4ff; border-color: #0969da; }
:deep(.vue-flow__minimap) {
  background: #f6f8fa; border: 1px solid #d0d7de;
  border-radius: 8px; box-shadow: 0 2px 8px rgba(140,149,159,0.2);
}
.zoom-indicator {
  position: absolute; bottom: 52px; right: 12px;
  background: rgba(255,255,255,0.9); border: 1px solid #d0d7de;
  border-radius: 6px; padding: 3px 8px; font-size: 11px; color: #57606a;
  pointer-events: none; z-index: 5;
}
</style>
