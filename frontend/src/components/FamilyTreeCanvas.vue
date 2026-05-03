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
import { ref, reactive, computed, onMounted, markRaw, nextTick, readonly } from 'vue';
import { VueFlow, useVueFlow, MarkerType } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import type { NodeMouseEvent } from '@vue-flow/core';
import PersonNode from './PersonNode.vue';
import SpouseConnector from './SpouseConnector.vue';
import FamilyGroupNode from './FamilyGroupNode.vue';
import { treeApi } from '../api';
import { useRouter } from 'vue-router';

// defineProps với TypeScript generic — khai báo kiểu prop mà không cần runtime validator
const props = defineProps<{ focusPersonId?: string | null }>();
// defineEmits với TypeScript generic — khai báo event emit type-safe
const emit = defineEmits<{ (e: 'selectPerson', id: string): void }>();

// Destructure API từ VueFlow instance theo id 'family-tree' (khớp với id trên <VueFlow>)
const { fitView, setCenter, viewport } = useVueFlow('family-tree');
const router = useRouter();

// ref() bọc array/primitive — truy cập qua .value, Vue theo dõi thay đổi toàn bộ .value
const rawNodes = ref<any[]>([]);
const rawEdges = ref<any[]>([]);
const loading = ref(true);
const error = ref('');

// reactive() dùng thay vì ref() vì Set được mutate tại chỗ (.add/.delete), không cần thay .value
// Tập hợp ID của những người mà cây con bên dưới họ đang bị ẩn
const collapsed = reactive(new Set<string>());

// ref() vì buildMaps gán toàn bộ Map mới vào .value — Vue cần bắt được sự thay thế này
// personId → danh sách ID con trực tiếp (xây từ edges, dùng cho BFS thu gọn)
const parentToChildren = ref(new Map<string, string[]>());
// connectorId → danh sách ID con trực tiếp của connector đó
const connectorChildren = ref(new Map<string, string[]>());
// connectorId → danh sách ID bố/mẹ vợ chồng (những người "sở hữu" node connector)
const connectorParents = ref(new Map<string, string[]>());

// markRaw ngăn Vue theo dõi reactive cho các component type (yêu cầu của VueFlow)
const nodeTypes = {
  person: markRaw(PersonNode),
  spouseConnector: markRaw(SpouseConnector),
  familyGroup: markRaw(FamilyGroupNode),
};

// --- Relationship maps ---

// Duyệt edges 2 lần để xây 3 map tra cứu:
//   Lần 1: edge vợ chồng (person → connector) → đảo ngược thành connector → [danh sách vợ/chồng]
//   Lần 2: edge cha/mẹ-con → điền person→children và connector→children
// Ba map này cho phép tìm toàn bộ hậu duệ của bất kỳ người nào để phục vụ logic thu gọn.
function buildMaps(edges: any[]) {
  const cp = new Map<string, string[]>(); // connector → các bố/mẹ vợ chồng
  const p2c = new Map<string, string[]>(); // person → con trực tiếp
  const cc = new Map<string, string[]>();  // connector → con trực tiếp

  // Lần 1: mỗi edge vợ chồng đi person → connector; đảo lại thành connector → [persons]
  for (const e of edges) {
    if (e.type === 'spouse') {
      if (!cp.has(e.target)) cp.set(e.target, []);
      cp.get(e.target)!.push(e.source);
    }
  }

  // Lần 2: edge parentChild có thể xuất phát từ connector hoặc từ một người đơn lẻ
  for (const e of edges) {
    if (e.type !== 'parentChild') continue;
    if (e.source.startsWith('connector-')) {
      if (!cc.has(e.source)) cc.set(e.source, []);
      if (!cc.get(e.source)!.includes(e.target)) cc.get(e.source)!.push(e.target);
    }
    // Ánh xạ từng người bố/mẹ (hoặc bố/mẹ đơn) sang con để BFS thu gọn hoạt động đúng
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

// BFS qua parentToChildren để lấy TẤT CẢ hậu duệ của một người (không chỉ con trực tiếp)
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

// computed<Set<string>>() — generic type rõ ràng giúp TypeScript suy luận đúng kiểu trả về
// computed() cache kết quả, chỉ tính lại khi collapsed hoặc parentToChildren thay đổi
const hiddenPersonIds = computed<Set<string>>(() => {
  const hidden = new Set<string>();
  for (const id of collapsed) {
    for (const d of getDescendants(id)) hidden.add(d);
  }
  return hidden;
});

// Một connector bị ẩn khi:
//   - bất kỳ người bố/mẹ vợ chồng nào của nó bị ẩn (cặp vợ chồng biến mất cùng nhau), HOẶC
//   - nó có con nhưng tất cả con đều đã bị ẩn (connector sẽ bị treo lơ lửng)
const hiddenConnectorIds = computed<Set<string>>(() => {
  const hidden = new Set<string>();
  for (const [connId, spouseIds] of connectorParents.value) {
    if (spouseIds.some(s => hiddenPersonIds.value.has(s))) {
      hidden.add(connId);
      continue;
    }
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

// computed() merge rawNodes + trạng thái collapse thành node array cho VueFlow
// .map() không mutate rawNodes — tạo array mới mỗi lần tính
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
    // hiddenCount hiển thị trên nút thu gọn để người dùng biết có bao nhiêu node đang bị ẩn
    const hiddenCount = isCollapsed ? getDescendants(n.id).size : 0;
    return {
      ...n,
      hidden: isHidden(n.id),
      data: {
        ...n.data,
        hasChildren,
        isCollapsed,
        hiddenCount,
        // Truyền callback qua data để PersonNode có thể kích hoạt mà không cần biết component cha
        onToggleCollapse: toggleCollapse,
        isCurrentUser: n.id === props.focusPersonId,
      },
    };
  })
);

const displayEdges = computed(() =>
  rawEdges.value.map(e => ({
    ...e,
    hidden: isHidden(e.source) || isHidden(e.target),
    // VueFlow dùng tên kiểu string: 'default' = đường cong bezier, 'straight' = đường thẳng
    type: e.type === 'parentChild' ? 'default' : 'straight',
    style: e.type === 'parentChild'
      ? { stroke: '#0969da', strokeWidth: 2 }
      : { stroke: '#c8d1d9', strokeWidth: 2 },
    markerEnd: e.type === 'parentChild'
      ? { type: MarkerType.ArrowClosed, color: '#0969da', width: 14, height: 14 }
      : undefined,
    animated: false,
  }))
);

// --- Load & fit ---

// requestAnimationFrame — callback chạy ngay trước khi browser vẽ frame tiếp theo
// Lồng 2 lần để đảm bảo VueFlow đã đo kích thước node SAU KHI layout lần đầu hoàn tất
// Chờ 2 animation frame để VueFlow đo xong kích thước node trước khi gọi fitView/setCenter
function rAF() { return new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))); }

function focusOnNode(id: string) {
  const target = rawNodes.value.find(n => n.type === 'person' && n.id === id);
  if (target) setCenter(target.position.x + 115, target.position.y + 60, { zoom: 1.2, duration: 600 });
}

const personNodes = computed(() => rawNodes.value.filter(n => n.type === 'person'));

// Nếu người dùng đăng nhập có liên kết với một người trong cây, ưu tiên focus vào card đó.
// Nếu không thì fall back sang các node thế hệ 1, cuối cùng mới fitView toàn cây.
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
    .map(n => n.id);
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
    // nextTick chờ Vue cập nhật DOM xong; hai rAF tiếp theo chờ VueFlow hoàn thành layout
    await nextTick();
    await rAF();
    focusOnPerson();
  } catch {
    error.value = 'Không tải được dữ liệu gia phả.';
  } finally {
    loading.value = false;
  }
}

// onMounted — Vue lifecycle hook, chạy sau khi component được gắn vào DOM
onMounted(loadTree);
// defineExpose() cần thiết với <script setup> để component cha dùng ref template truy cập được
// readonly() bọc computed thành read-only, tránh component cha vô tình mutate
// Expose reload cho TreePage (gọi sau khi lưu), focusOnNode cho tìm kiếm, personNodes cho thống kê
defineExpose({ reload: loadTree, focusOnNode, personNodes: readonly(personNodes) });

function onNodeClick(event: NodeMouseEvent) {
  // Click vào connector vợ chồng sẽ điều hướng đến trang media chung của cặp đó
  if (event.node.type === 'spouseConnector') {
    const relId = event.node.id.replace('connector-', '');
    router.push(`/relationships/${relId}/media`);
    return;
  }
  if (event.node.type === 'person') emit('selectPerson', event.node.id);
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
