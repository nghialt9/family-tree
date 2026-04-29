import dagre from '@dagrejs/dagre';
import { Person, Relationship } from '@prisma/client';

const NODE_WIDTH = 230;
const NODE_HEIGHT = 120;
const CONNECTOR_WIDTH = 30;
const CONNECTOR_HEIGHT = 30;
const SPOUSE_CONN_GAP = 10;

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

export function buildTree(persons: Person[], relationships: Relationship[]): { nodes: TreeNode[]; edges: TreeEdge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 80, marginx: 40, marginy: 40 });

  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];

  // Only person nodes go into dagre — connector nodes are purely visual.
  // Connector nodes in dagre create an extra intermediate rank between parents and
  // children (parent → connector → child = 3 ranks), which breaks the generation layout.
  for (const p of persons) {
    g.setNode(p.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  const spouseRels = relationships.filter(r => r.type === 'spouse');
  const parentChildRels = relationships.filter(r => r.type === 'parent_child');

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

  // Visual spouse edges: person → connector ← person
  for (const rel of spouseRels) {
    const connId = connectorMap.get([rel.personAId, rel.personBId].sort().join('-'))!;
    edges.push({ id: `spouse-a-${rel.id}`, source: rel.personAId, target: connId, type: 'spouse' });
    edges.push({ id: `spouse-b-${rel.id}`, source: rel.personBId, target: connId, type: 'spouse' });
  }

  // Build child → parents map
  const childParents = new Map<string, string[]>();
  for (const rel of parentChildRels) {
    if (!childParents.has(rel.personBId)) childParents.set(rel.personBId, []);
    if (!childParents.get(rel.personBId)!.includes(rel.personAId)) {
      childParents.get(rel.personBId)!.push(rel.personAId);
    }
  }

  // Add direct parent→child edges to dagre (no connectors — each parent links directly)
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
    // Visual edge source: connector if couple is known, else single parent
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
      edges.push({ id: `pc-${sourceId}-${childId}`, source: sourceId, target: childId, type: 'parentChild' });
    }
  }

  dagre.layout(g);

  // Compute generation via BFS (roots = no parents → gen 1)
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

  // Detect which persons have at least one relationship
  const personIdsInRelationships = new Set<string>();
  for (const r of relationships) {
    personIdsInRelationships.add(r.personAId);
    personIdsInRelationships.add(r.personBId);
  }

  // Person positions from dagre (connected persons only)
  const personPositions = new Map<string, { x: number; y: number }>();
  let maxTreeY = 0;
  for (const p of persons) {
    if (!personIdsInRelationships.has(p.id)) continue;
    const node = g.node(p.id);
    if (!node) continue;
    const y = node.y - NODE_HEIGHT / 2;
    personPositions.set(p.id, { x: node.x - NODE_WIDTH / 2, y });
    maxTreeY = Math.max(maxTreeY, y + NODE_HEIGHT);
  }

  // Move spouse pairs to be adjacent, anchored at dagre's midpoint between them
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
    personPositions.set(leftId,  { x: cx - NODE_WIDTH - CONNECTOR_WIDTH / 2 - SPOUSE_CONN_GAP, y: leftY });
    personPositions.set(rightId, { x: cx + CONNECTOR_WIDTH / 2 + SPOUSE_CONN_GAP, y: rightY });
  }

  // Connector positions based on final (post-adjustment) spouse positions
  for (const [connId, [pA, pB]] of connectorPersons) {
    const posA = personPositions.get(pA);
    const posB = personPositions.get(pB);
    if (!posA || !posB) continue;
    const [leftPos, rightPos] = posA.x <= posB.x ? [posA, posB] : [posB, posA];
    const connX = leftPos.x + NODE_WIDTH + SPOUSE_CONN_GAP;
    const connY = Math.min(leftPos.y, rightPos.y) + (NODE_HEIGHT - CONNECTOR_HEIGHT) / 2;
    nodes.push({ id: connId, type: 'spouseConnector', position: { x: connX, y: connY }, data: {} });
  }

  // Isolated persons (no relationships): arrange in a √n × √n grid below the tree
  const isolated = persons.filter(p => !personIdsInRelationships.has(p.id));
  if (isolated.length > 0) {
    const cols = Math.max(1, Math.ceil(Math.sqrt(isolated.length)));
    const startY = maxTreeY > 0 ? maxTreeY + 100 : 40;
    let treeMinX = Infinity, treeMaxX = -Infinity;
    for (const pos of personPositions.values()) {
      treeMinX = Math.min(treeMinX, pos.x);
      treeMaxX = Math.max(treeMaxX, pos.x + NODE_WIDTH);
    }
    const treeCenterX = treeMinX < Infinity ? (treeMinX + treeMaxX) / 2 : null;
    const gridWidth = cols * (NODE_WIDTH + 20) - 20;
    const gridStartX = treeCenterX != null ? Math.max(40, treeCenterX - gridWidth / 2) : 40;
    isolated.forEach((p, i) => {
      personPositions.set(p.id, {
        x: gridStartX + (i % cols) * (NODE_WIDTH + 20),
        y: startY + Math.floor(i / cols) * (NODE_HEIGHT + 80),
      });
    });
  }

  // Push all person nodes
  for (const p of persons) {
    const pos = personPositions.get(p.id);
    if (!pos) continue;
    nodes.push({
      id: p.id,
      type: 'person',
      position: pos,
      data: { ...p, generation: computedGen.get(p.id) ?? p.generation },
    });
  }

  return { nodes, edges };
}
