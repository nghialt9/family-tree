import dagre from '@dagrejs/dagre';
import { Person, Relationship } from '@prisma/client';

const NODE_WIDTH = 230;
const NODE_HEIGHT = 120;
const CONNECTOR_WIDTH = 30;
const CONNECTOR_HEIGHT = 30;
const SPOUSE_CONN_GAP = 10;
// A couple shares one wide dagre node so dagre treats them as a unit.
// Width = left-person + gap + connector + gap + right-person
const COUPLE_DAGRE_WIDTH = NODE_WIDTH * 2 + CONNECTOR_WIDTH + 2 * SPOUSE_CONN_GAP;

const COMP_GAP_X = 80;
const COMP_GAP_Y = 100;
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

/**
 * Layout one connected family cluster.
 *
 * Key idea: each married couple becomes a single wide dagre node (COUPLE_DAGRE_WIDTH).
 * Dagre therefore treats the couple as one unit and places their children correctly
 * beneath them — no post-layout position adjustment, no overlap introduced.
 */
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
  g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80, marginx: 40, marginy: 40 });

  const visualEdges: TreeEdge[] = [];

  // Build connector map
  const connectorMap = new Map<string, string>();          // sortedKey → connId
  const connectorPersons = new Map<string, [string, string]>(); // connId → [pA, pB]
  const connectorToCoupleNode = new Map<string, string>(); // connId → dagreCoupleNodeId

  for (const rel of spouseRels) {
    const key = [rel.personAId, rel.personBId].sort().join('-');
    if (!connectorMap.has(key)) {
      const connId = `connector-${key}`;
      connectorMap.set(key, connId);
      connectorPersons.set(connId, [rel.personAId, rel.personBId]);
      connectorToCoupleNode.set(connId, `couple-${key}`);
    }
  }

  // Map each person to their dagre node id.
  // Coupled persons share a wide couple node; singles use their own id.
  // If a person is in multiple couples (remarried), we take the first couple encountered.
  const personToDagreNode = new Map<string, string>();
  for (const [connId, [pA, pB]] of connectorPersons) {
    const coupleId = connectorToCoupleNode.get(connId)!;
    if (!personToDagreNode.has(pA)) personToDagreNode.set(pA, coupleId);
    if (!personToDagreNode.has(pB)) personToDagreNode.set(pB, coupleId);
  }
  for (const p of persons) {
    if (!personToDagreNode.has(p.id)) personToDagreNode.set(p.id, p.id);
  }

  // Add dagre nodes (couple nodes are wide; single person nodes are standard width)
  const addedDagreNodes = new Set<string>();
  for (const p of persons) {
    const dagreId = personToDagreNode.get(p.id)!;
    if (!addedDagreNodes.has(dagreId)) {
      addedDagreNodes.add(dagreId);
      const isCoupleNode = dagreId !== p.id;
      g.setNode(dagreId, { width: isCoupleNode ? COUPLE_DAGRE_WIDTH : NODE_WIDTH, height: NODE_HEIGHT });
    }
  }

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

  const addedDagreEdges = new Set<string>();
  const addedVisualEdges = new Set<string>();

  for (const [childId, parentIds] of childParents) {
    const childDagreId = personToDagreNode.get(childId)!;

    // Determine the dagre source and the visual edge source
    let parentDagreId: string;
    let visualSourceId: string;

    if (parentIds.length >= 2) {
      const sortedKey = [...parentIds].sort().join('-');
      const connId = connectorMap.get(sortedKey);
      if (connId) {
        // Both parents are a recognized couple
        parentDagreId = connectorToCoupleNode.get(connId)!;
        visualSourceId = connId; // visual edge from connector
      } else {
        // Two parents but not a couple — add edges from each parent individually
        for (const pid of parentIds) {
          const pDagre = personToDagreNode.get(pid)!;
          if (pDagre !== childDagreId) {
            const dk = `${pDagre}->${childDagreId}`;
            if (!addedDagreEdges.has(dk)) { addedDagreEdges.add(dk); g.setEdge(pDagre, childDagreId); }
          }
          const vk = `${pid}->${childId}`;
          if (!addedVisualEdges.has(vk)) {
            addedVisualEdges.add(vk);
            visualEdges.push({ id: `pc-${pid}-${childId}`, source: pid, target: childId, type: 'parentChild' });
          }
        }
        continue; // skip the generic add below
      }
    } else {
      const parentId = parentIds[0];
      parentDagreId = personToDagreNode.get(parentId)!;
      // Visual edge always comes from the actual parent person (not connector)
      // even when the parent is part of a couple — the other spouse isn't a parent here
      visualSourceId = parentId;
    }

    if (parentDagreId !== childDagreId) {
      const dk = `${parentDagreId}->${childDagreId}`;
      if (!addedDagreEdges.has(dk)) { addedDagreEdges.add(dk); g.setEdge(parentDagreId, childDagreId); }
    }

    const vk = `${visualSourceId}->${childId}`;
    if (!addedVisualEdges.has(vk)) {
      addedVisualEdges.add(vk);
      visualEdges.push({ id: `pc-${visualSourceId}-${childId}`, source: visualSourceId, target: childId, type: 'parentChild' });
    }
  }

  dagre.layout(g);

  // Compute final person positions from their dagre nodes
  const nodePositions = new Map<string, { x: number; y: number }>();

  // Couple nodes: split the wide node into left/right person positions
  for (const [connId, [pA, pB]] of connectorPersons) {
    const coupleId = connectorToCoupleNode.get(connId)!;
    const node = g.node(coupleId);
    if (!node) continue;
    const left = node.x - node.width / 2;
    const top  = node.y - NODE_HEIGHT / 2;
    nodePositions.set(pA, { x: left, y: top });
    nodePositions.set(pB, { x: left + NODE_WIDTH + CONNECTOR_WIDTH + 2 * SPOUSE_CONN_GAP, y: top });
  }

  // Single-person nodes
  for (const p of persons) {
    if (!nodePositions.has(p.id)) {
      const node = g.node(p.id);
      if (node) nodePositions.set(p.id, { x: node.x - NODE_WIDTH / 2, y: node.y - NODE_HEIGHT / 2 });
    }
  }

  // Connector positions derived from final person positions
  const connectorNodes: Array<{ id: string; position: { x: number; y: number } }> = [];
  for (const [connId, [pA, pB]] of connectorPersons) {
    const posA = nodePositions.get(pA);
    const posB = nodePositions.get(pB);
    if (!posA || !posB) continue;
    const leftX = Math.min(posA.x, posB.x);
    const connX = leftX + NODE_WIDTH + SPOUSE_CONN_GAP;
    const connY = Math.min(posA.y, posB.y) + (NODE_HEIGHT - CONNECTOR_HEIGHT) / 2;
    connectorNodes.push({ id: connId, position: { x: connX, y: connY } });
  }

  // Bounding box over all nodes in this cluster
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pos of nodePositions.values()) {
    minX = Math.min(minX, pos.x);      minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + NODE_WIDTH); maxY = Math.max(maxY, pos.y + NODE_HEIGHT);
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

  const spouseRels      = relationships.filter(r => r.type === 'spouse');
  const parentChildRels = relationships.filter(r => r.type === 'parent_child');

  // Compute generations via BFS (roots = persons with no parents → gen 1)
  const personChildrenMap = new Map<string, string[]>();
  const personParentsMap  = new Map<string, string[]>();
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
    const id  = genQueue.shift()!;
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

  // Group persons into connected components (families / clusters)
  const compMap = findComponents(persons.map(p => p.id), relationships);
  const componentGroups = new Map<string, Person[]>();
  for (const p of persons) {
    const cid = compMap.get(p.id)!;
    if (!componentGroups.has(cid)) componentGroups.set(cid, []);
    componentGroups.get(cid)!.push(p);
  }

  // Sort: largest clusters first
  const sortedClusters = [...componentGroups.values()].sort((a, b) => b.length - a.length);

  const allNodes: TreeNode[] = [];
  const allEdges: TreeEdge[] = [];
  const personMap = new Map(persons.map(p => [p.id, p]));

  // Pack clusters left-to-right, wrapping into new rows when MAX_ROW_WIDTH exceeded
  let curX = 40, curY = 40, rowMaxH = 0;

  for (const clusterPersons of sortedClusters) {
    const clusterIds        = new Set(clusterPersons.map(p => p.id));
    const clusterSpouseRels = spouseRels.filter(r => clusterIds.has(r.personAId) && clusterIds.has(r.personBId));
    const clusterPCRels     = parentChildRels.filter(r => clusterIds.has(r.personAId) && clusterIds.has(r.personBId));

    const result   = layoutCluster(clusterPersons, clusterSpouseRels, clusterPCRels);
    const clusterW = result.bbox.maxX - result.bbox.minX;
    const clusterH = result.bbox.maxY - result.bbox.minY;

    // Wrap to next row if this cluster doesn't fit horizontally
    if (curX > 40 && curX + clusterW > MAX_ROW_WIDTH) {
      curX = 40;
      curY += rowMaxH + COMP_GAP_Y;
      rowMaxH = 0;
    }

    // Translate so that the cluster's bbox top-left lands at (curX, curY)
    const ox = curX - result.bbox.minX;
    const oy = curY - result.bbox.minY;

    for (const [id, pos] of result.nodePositions) {
      const p = personMap.get(id)!;
      allNodes.push({
        id,
        type: 'person',
        position: { x: pos.x + ox, y: pos.y + oy },
        data: { ...p, generation: computedGen.get(id) ?? p.generation },
      });
    }

    for (const cn of result.connectorNodes) {
      allNodes.push({
        id: cn.id,
        type: 'spouseConnector',
        position: { x: cn.position.x + ox, y: cn.position.y + oy },
        data: {},
      });
    }

    allEdges.push(...result.visualEdges);

    curX  += clusterW + COMP_GAP_X;
    rowMaxH = Math.max(rowMaxH, clusterH);
  }

  return { nodes: allNodes, edges: allEdges };
}
