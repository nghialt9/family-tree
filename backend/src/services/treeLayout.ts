import dagre from '@dagrejs/dagre';
import { Person, Relationship } from '@prisma/client';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 160;

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
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 100 });

  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];

  for (const p of persons) {
    g.setNode(p.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  const spouseRels = relationships.filter(r => r.type === 'spouse');
  const parentChildRels = relationships.filter(r => r.type === 'parent_child');

  const connectorMap = new Map<string, string>();

  for (const rel of spouseRels) {
    const key = [rel.personAId, rel.personBId].sort().join('-');
    if (!connectorMap.has(key)) {
      const connId = `connector-${key}`;
      connectorMap.set(key, connId);
      g.setNode(connId, { width: 1, height: 1 });
      g.setEdge(rel.personAId, connId);
      g.setEdge(rel.personBId, connId);
      edges.push({ id: `spouse-a-${rel.id}`, source: rel.personAId, target: connId, type: 'spouse' });
      edges.push({ id: `spouse-b-${rel.id}`, source: rel.personBId, target: connId, type: 'spouse' });
    }
  }

  for (const rel of parentChildRels) {
    const spouseRel = spouseRels.find(s =>
      s.personAId === rel.personAId || s.personBId === rel.personAId
    );
    const sourceId = spouseRel
      ? connectorMap.get([spouseRel.personAId, spouseRel.personBId].sort().join('-')) ?? rel.personAId
      : rel.personAId;

    if (sourceId !== rel.personAId) {
      g.setEdge(sourceId, rel.personBId);
    } else {
      g.setEdge(rel.personAId, rel.personBId);
    }
    edges.push({ id: `pc-${rel.id}`, source: sourceId, target: rel.personBId, type: 'parentChild' });
  }

  dagre.layout(g);

  for (const p of persons) {
    const node = g.node(p.id);
    if (!node) continue;
    nodes.push({
      id: p.id,
      type: 'person',
      position: { x: node.x - NODE_WIDTH / 2, y: node.y - NODE_HEIGHT / 2 },
      data: p,
    });
  }

  for (const [, connId] of connectorMap) {
    const node = g.node(connId);
    if (!node) continue;
    nodes.push({
      id: connId,
      type: 'spouseConnector',
      position: { x: node.x, y: node.y },
      data: { label: '' },
    });
  }

  return { nodes, edges };
}
