import dagre from '@dagrejs/dagre';
import { Person, Relationship } from '@prisma/client';

const NODE_WIDTH = 230;
const NODE_HEIGHT = 120;
const CONNECTOR_WIDTH = 30;
const CONNECTOR_HEIGHT = 30;
// Horizontal gap between spouse node edge and connector edge
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

  for (const p of persons) {
    g.setNode(p.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  const spouseRels = relationships.filter(r => r.type === 'spouse');
  const parentChildRels = relationships.filter(r => r.type === 'parent_child');

  const connectorMap = new Map<string, string>();
  const connectorPersons = new Map<string, [string, string]>(); // connId → [pA, pB]

  for (const rel of spouseRels) {
    const key = [rel.personAId, rel.personBId].sort().join('-');
    if (!connectorMap.has(key)) {
      const connId = `connector-${key}`;
      connectorMap.set(key, connId);
      connectorPersons.set(connId, [rel.personAId, rel.personBId]);
      g.setNode(connId, { width: CONNECTOR_WIDTH, height: CONNECTOR_HEIGHT });
      g.setEdge(rel.personAId, connId);
      g.setEdge(rel.personBId, connId);
      edges.push({ id: `spouse-a-${rel.id}`, source: rel.personAId, target: connId, type: 'spouse' });
      edges.push({ id: `spouse-b-${rel.id}`, source: rel.personBId, target: connId, type: 'spouse' });
    }
  }

  // Build child→parents map to deduplicate edges and pick correct connector
  const childParents = new Map<string, string[]>();
  for (const rel of parentChildRels) {
    if (!childParents.has(rel.personBId)) childParents.set(rel.personBId, []);
    if (!childParents.get(rel.personBId)!.includes(rel.personAId)) {
      childParents.get(rel.personBId)!.push(rel.personAId);
    }
  }

  const addedEdges = new Set<string>();
  for (const [childId, parentIds] of childParents) {
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
    const edgeKey = `${sourceId}->${childId}`;
    if (!addedEdges.has(edgeKey)) {
      addedEdges.add(edgeKey);
      g.setEdge(sourceId, childId);
      edges.push({ id: `pc-${sourceId}-${childId}`, source: sourceId, target: childId, type: 'parentChild' });
    }
  }

  dagre.layout(g);

  // Compute generation from relationship graph (roots = persons with no parents → gen 1)
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

  // Compute person positions from dagre, then adjust spouse pairs to be adjacent
  // Dagre places isolated nodes (no edges) all at the same coordinates — handle separately.
  const nodesWithEdges = new Set<string>();
  for (const { v, w } of g.edges()) {
    nodesWithEdges.add(v);
    nodesWithEdges.add(w);
  }

  const personPositions = new Map<string, { x: number; y: number }>();
  let maxTreeY = 0;
  for (const p of persons) {
    if (!nodesWithEdges.has(p.id)) continue;
    const node = g.node(p.id);
    if (!node) continue;
    const y = node.y - NODE_HEIGHT / 2;
    personPositions.set(p.id, { x: node.x - NODE_WIDTH / 2, y });
    maxTreeY = Math.max(maxTreeY, y + NODE_HEIGHT);
  }

  // Place isolated persons grouped by computed generation, centered under the main tree
  const isolated = persons.filter(p => !nodesWithEdges.has(p.id));
  if (isolated.length > 0) {
    const byGen = new Map<number, Person[]>();
    for (const p of isolated) {
      const gen = computedGen.get(p.id) ?? p.generation;
      if (!byGen.has(gen)) byGen.set(gen, []);
      byGen.get(gen)!.push(p);
    }
    const sortedGens = [...byGen.keys()].sort((a, b) => a - b);

    let treeMinX = Infinity, treeMaxX = -Infinity;
    for (const pos of personPositions.values()) {
      treeMinX = Math.min(treeMinX, pos.x);
      treeMaxX = Math.max(treeMaxX, pos.x + NODE_WIDTH);
    }
    const treeCenterX = treeMinX < Infinity ? (treeMinX + treeMaxX) / 2 : null;

    const startY = maxTreeY > 0 ? maxTreeY + 100 : 40;
    sortedGens.forEach((gen, row) => {
      const rowPersons = byGen.get(gen)!;
      const rowWidth = rowPersons.length * (NODE_WIDTH + 20) - 20;
      const cx = treeCenterX ?? (40 + rowWidth / 2);
      const rowStartX = Math.max(40, cx - rowWidth / 2);
      rowPersons.forEach((p, col) => {
        personPositions.set(p.id, {
          x: rowStartX + col * (NODE_WIDTH + 20),
          y: startY + row * (NODE_HEIGHT + 80),
        });
      });
    });
  }

  const adjustedPersons = new Set<string>();
  for (const [connId, [pA, pB]] of connectorPersons) {
    const connNode = g.node(connId);
    if (!connNode) continue;
    const nA = g.node(pA);
    const nB = g.node(pB);

    // Connector center X = midpoint between spouses (from dagre)
    const cx = nA && nB ? (nA.x + nB.x) / 2 : connNode.x;

    nodes.push({
      id: connId,
      type: 'spouseConnector',
      position: { x: cx - CONNECTOR_WIDTH / 2, y: connNode.y - CONNECTOR_HEIGHT / 2 },
      data: { label: '' },
    });

    // Move spouses to sit side-by-side around the connector (only if neither already adjusted)
    if (nA && nB && !adjustedPersons.has(pA) && !adjustedPersons.has(pB)) {
      adjustedPersons.add(pA);
      adjustedPersons.add(pB);
      const [leftId, rightId] = nA.x <= nB.x ? [pA, pB] : [pB, pA];
      const leftY = (nA.x <= nB.x ? nA : nB).y - NODE_HEIGHT / 2;
      const rightY = (nA.x <= nB.x ? nB : nA).y - NODE_HEIGHT / 2;
      personPositions.set(leftId, { x: cx - NODE_WIDTH - CONNECTOR_WIDTH / 2 - SPOUSE_CONN_GAP, y: leftY });
      personPositions.set(rightId, { x: cx + CONNECTOR_WIDTH / 2 + SPOUSE_CONN_GAP, y: rightY });
    }
  }

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
