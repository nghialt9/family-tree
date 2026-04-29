import dagre from '@dagrejs/dagre';
import { Person, Relationship } from '@prisma/client';

const NODE_WIDTH = 230;
const NODE_HEIGHT = 120;
const CONNECTOR_WIDTH = 30;
const CONNECTOR_HEIGHT = 30;
const SPOUSE_CONN_GAP = 10;
const COMP_GAP_X = 80;  // horizontal gap between family clusters
const COMP_GAP_Y = 100; // vertical gap between rows of clusters
const MAX_ROW_WIDTH = 3000;

export interface TreeNode {
  id: string;
  type: 'person' | 'spouseConnector';
  position: { x: number; y: number };
  data: Partial<Person> & { label?: string };
}

export interface TreeEdge {
  id: string;
  source: string;
  target: string;
  type: 'parentChild' | 'spouse';
}

// Union-Find: group persons into connected components via any relationship
function findComponents(personIds: string[], relationships: Relationship[]): Map<string, string> {
  const parent = new Map<string, string>(personIds.map(id => [id, id]));

  function find(id: string): string {
    const p = parent.get(id);
    if (p === undefined || p === id) return id;
    const root = find(p);
    parent.set(id, root);
    return root;
  }

  function union(a: string, b: string) {
    if (!parent.has(a) || !parent.has(b)) return;
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (const r of relationships) union(r.personAId, r.personBId);
  return new Map(personIds.map(id => [id, find(id)]));
}

// Layout one connected family cluster with its own dagre instance.
// Returns positions relative to (0,0) plus the bounding box.
function layoutCluster(
  persons: Person[],
  spouseRels: Relationship[],
  parentChildRels: Relationship[],
): {
  nodePositions: Map<string, { x: number; y: number }>;
  connectorNodes: Array<{ id: string; position: { x: number; y: number } }>;
  visualEdges: TreeEdge[];
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
} {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 80, marginx: 40, marginy: 40 });

  // Only person nodes — connector nodes in dagre create extra ranks and break layout
  for (const p of persons) {
    g.setNode(p.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // Build connector map (visual only, never added to dagre)
  const connectorMap = new Map<string, string>();   // sorted-key → connId
  const connectorPersons = new Map<string, [string, string]>(); // connId → [pA, pB]
  for (const rel of spouseRels) {
    const key = [rel.personAId, rel.personBId].sort().join('-');
    if (!connectorMap.has(key)) {
      const connId = `connector-${key}`;
      connectorMap.set(key, connId);
      connectorPersons.set(connId, [rel.personAId, rel.personBId]);
    }
  }

  const visualEdges: TreeEdge[] = [];

  // Visual spouse edges: person → connector ← person
  for (const rel of spouseRels) {
    const connId = connectorMap.get([rel.personAId, rel.personBId].sort().join('-'))!;
    visualEdges.push({ id: `spouse-a-${rel.id}`, source: rel.personAId, target: connId, type: 'spouse' });
    visualEdges.push({ id: `spouse-b-${rel.id}`, source: rel.personBId, target: connId, type: 'spouse' });
  }

  // Build child → parents map
  const childParents = new Map<string, string[]>();
  for (const rel of parentChildRels) {
    if (!childParents.has(rel.personBId)) childParents.set(rel.personBId, []);
    if (!childParents.get(rel.personBId)!.includes(rel.personAId)) {
      childParents.get(rel.personBId)!.push(rel.personAId);
    }
  }

  // Add direct parent→child edges to dagre (no connectors)
  const addedDagreEdges = new Set<string>();
  const addedVisualEdges = new Set<string>();
  for (const [childId, parentIds] of childParents) {
    for (const parentId of parentIds) {
      const dk = `${parentId}->${childId}`;
      if (!addedDagreEdges.has(dk)) {
        addedDagreEdges.add(dk);
        g.setEdge(parentId, childId);
      }
    }
    // Visual edge source: connector if couple known, else single parent
    let sourceId: string;
    if (parentIds.length >= 2) {
      const key = [...parentIds].sort().join('-');
      sourceId = connectorMap.get(key) ?? parentIds[0];
    } else {
      const parentId = parentIds[0];
      const spouseRel = spouseRels.find(s => s.personAId === parentId || s.personBId === parentId);
      const connKey = spouseRel ? [spouseRel.personAId, spouseRel.personBId].sort().join('-') : null;
      sourceId = (connKey && connectorMap.get(connKey)) ?? parentId;
    }
    const vk = `${sourceId}->${childId}`;
    if (!addedVisualEdges.has(vk)) {
      addedVisualEdges.add(vk);
      visualEdges.push({ id: `pc-${sourceId}-${childId}`, source: sourceId, target: childId, type: 'parentChild' });
    }
  }

  dagre.layout(g);

  // Collect dagre positions for person nodes
  const nodePositions = new Map<string, { x: number; y: number }>();
  for (const p of persons) {
    const node = g.node(p.id);
    if (node) nodePositions.set(p.id, { x: node.x - NODE_WIDTH / 2, y: node.y - NODE_HEIGHT / 2 });
  }

  // Adjust spouse pairs to be adjacent, with connector between them
  const adjustedPersons = new Set<string>();
  for (const [, [pA, pB]] of connectorPersons) {
    const nA = g.node(pA);
    const nB = g.node(pB);
    if (!nA || !nB || adjustedPersons.has(pA) || adjustedPersons.has(pB)) continue;
    adjustedPersons.add(pA);
    adjustedPersons.add(pB);

    const cx = (nA.x + nB.x) / 2;
    const [leftId, rightId] = nA.x <= nB.x ? [pA, pB] : [pB, pA];
    const leftY  = (nA.x <= nB.x ? nA : nB).y - NODE_HEIGHT / 2;
    const rightY = (nA.x <= nB.x ? nB : nA).y - NODE_HEIGHT / 2;
    nodePositions.set(leftId,  { x: cx - NODE_WIDTH - CONNECTOR_WIDTH / 2 - SPOUSE_CONN_GAP, y: leftY });
    nodePositions.set(rightId, { x: cx + CONNECTOR_WIDTH / 2 + SPOUSE_CONN_GAP, y: rightY });
  }

  // Connector positions based on final adjusted spouse positions
  const connectorNodes: Array<{ id: string; position: { x: number; y: number } }> = [];
  for (const [connId, [pA, pB]] of connectorPersons) {
    const posA = nodePositions.get(pA);
    const posB = nodePositions.get(pB);
    if (!posA || !posB) continue;
    const [leftPos] = posA.x <= posB.x ? [posA, posB] : [posB, posA];
    const connX = leftPos.x + NODE_WIDTH + SPOUSE_CONN_GAP;
    const connY = Math.min(posA.y, posB.y) + (NODE_HEIGHT - CONNECTOR_HEIGHT) / 2;
    connectorNodes.push({ id: connId, position: { x: connX, y: connY } });
  }

  // Compute bounding box over all nodes in this cluster
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pos of nodePositions.values()) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + NODE_WIDTH);
    maxY = Math.max(maxY, pos.y + NODE_HEIGHT);
  }
  for (const cn of connectorNodes) {
    minX = Math.min(minX, cn.position.x);
    minY = Math.min(minY, cn.position.y);
    maxX = Math.max(maxX, cn.position.x + CONNECTOR_WIDTH);
    maxY = Math.max(maxY, cn.position.y + CONNECTOR_HEIGHT);
  }

  return { nodePositions, connectorNodes, visualEdges, bbox: { minX, minY, maxX, maxY } };
}

export function buildTree(persons: Person[], relationships: Relationship[]): { nodes: TreeNode[]; edges: TreeEdge[] } {
  if (persons.length === 0) return { nodes: [], edges: [] };

  const spouseRels = relationships.filter(r => r.type === 'spouse');
  const parentChildRels = relationships.filter(r => r.type === 'parent_child');

  // Compute generations via BFS (roots = persons with no parents → gen 1)
  const personChildrenMap = new Map<string, string[]>();
  const personParentsMap = new Map<string, string[]>();
  for (const rel of parentChildRels) {
    if (!personChildrenMap.has(rel.personAId)) personChildrenMap.set(rel.personAId, []);
    personChildrenMap.get(rel.personAId)!.push(rel.personBId);
    if (!personParentsMap.has(rel.personBId)) personParentsMap.set(rel.personBId, []);
    personParentsMap.get(rel.personBId)!.push(rel.personAId);
  }
  const computedGen = new Map<string, number>();
  const genQueue: string[] = [];
  for (const p of persons) {
    if ((personParentsMap.get(p.id)?.length ?? 0) === 0) {
      computedGen.set(p.id, 1);
      genQueue.push(p.id);
    }
  }
  while (genQueue.length > 0) {
    const id = genQueue.shift()!;
    const gen = computedGen.get(id)!;
    for (const childId of personChildrenMap.get(id) ?? []) {
      if ((computedGen.get(childId) ?? 0) < gen + 1) {
        computedGen.set(childId, gen + 1);
        genQueue.push(childId);
      }
    }
  }
  for (const p of persons) {
    if (!computedGen.has(p.id)) computedGen.set(p.id, 1);
  }

  // Group persons into connected components (families)
  const compMap = findComponents(persons.map(p => p.id), relationships);
  const componentGroups = new Map<string, Person[]>();
  for (const p of persons) {
    const compId = compMap.get(p.id)!;
    if (!componentGroups.has(compId)) componentGroups.set(compId, []);
    componentGroups.get(compId)!.push(p);
  }

  // Sort: largest families first, isolated singles last
  const sortedClusters = [...componentGroups.values()].sort((a, b) => b.length - a.length);

  const allNodes: TreeNode[] = [];
  const allEdges: TreeEdge[] = [];
  const personMap = new Map(persons.map(p => [p.id, p]));

  // Pack clusters left-to-right, wrapping into new rows when MAX_ROW_WIDTH exceeded
  let curX = 40;
  let curY = 40;
  let rowMaxHeight = 0;

  for (const clusterPersons of sortedClusters) {
    const clusterIds = new Set(clusterPersons.map(p => p.id));
    const clusterSpouseRels = spouseRels.filter(r => clusterIds.has(r.personAId) && clusterIds.has(r.personBId));
    const clusterParentChildRels = parentChildRels.filter(r => clusterIds.has(r.personAId) && clusterIds.has(r.personBId));

    const result = layoutCluster(clusterPersons, clusterSpouseRels, clusterParentChildRels);
    const clusterW = result.bbox.maxX - result.bbox.minX;
    const clusterH = result.bbox.maxY - result.bbox.minY;

    // Wrap to next row if this cluster doesn't fit
    if (curX > 40 && curX + clusterW > MAX_ROW_WIDTH) {
      curX = 40;
      curY += rowMaxHeight + COMP_GAP_Y;
      rowMaxHeight = 0;
    }

    // Translate all positions so this cluster's bbox origin lands at (curX, curY)
    const offsetX = curX - result.bbox.minX;
    const offsetY = curY - result.bbox.minY;

    for (const [id, pos] of result.nodePositions) {
      const p = personMap.get(id)!;
      allNodes.push({
        id,
        type: 'person',
        position: { x: pos.x + offsetX, y: pos.y + offsetY },
        data: { ...p, generation: computedGen.get(id) ?? p.generation },
      });
    }

    for (const cn of result.connectorNodes) {
      allNodes.push({
        id: cn.id,
        type: 'spouseConnector',
        position: { x: cn.position.x + offsetX, y: cn.position.y + offsetY },
        data: {},
      });
    }

    allEdges.push(...result.visualEdges);

    curX += clusterW + COMP_GAP_X;
    rowMaxHeight = Math.max(rowMaxHeight, clusterH);
  }

  return { nodes: allNodes, edges: allEdges };
}
