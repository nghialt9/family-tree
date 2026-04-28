import 'dotenv/config';
import request from 'supertest';
import { beforeEach, it, expect } from '@jest/globals';
import { app } from '../src/app';
import { prisma, cleanDb } from './setup';
import { signToken } from '../src/lib/jwt';

const authV = () => ({ Authorization: `Bearer ${signToken({ id: 't', phone: '0', role: 'viewer' })}` });

beforeEach(cleanDb);

it('GET /api/tree returns nodes and edges for a parent-child pair', async () => {
  const p1 = await prisma.person.create({ data: { fullName: 'Parent', gender: 'male', generation: 1 } });
  const p2 = await prisma.person.create({ data: { fullName: 'Child', gender: 'male', generation: 2 } });
  await prisma.relationship.create({ data: { personAId: p1.id, personBId: p2.id, type: 'parent_child' } });

  const res = await request(app).get('/api/tree').set(authV());
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.nodes)).toBe(true);
  expect(Array.isArray(res.body.edges)).toBe(true);
  expect(res.body.nodes.length).toBe(2);
  expect(res.body.nodes[0].position).toBeDefined();
  expect(res.body.nodes[0].position.x).toBeDefined();
});

it('GET /api/tree creates SpouseConnector node for spouse pair', async () => {
  const p1 = await prisma.person.create({ data: { fullName: 'Husband', gender: 'male', generation: 1 } });
  const p2 = await prisma.person.create({ data: { fullName: 'Wife', gender: 'female', generation: 1 } });
  await prisma.relationship.create({ data: { personAId: p1.id, personBId: p2.id, type: 'spouse' } });

  const res = await request(app).get('/api/tree').set(authV());
  expect(res.status).toBe(200);
  // Should have 2 person nodes + 1 spouseConnector node
  expect(res.body.nodes.length).toBe(3);
  const connectorNode = res.body.nodes.find((n: any) => n.type === 'spouseConnector');
  expect(connectorNode).toBeDefined();
  expect(connectorNode.position).toBeDefined();
  expect(connectorNode.position.x).toBeDefined();
  expect(connectorNode.position.y).toBeDefined();
});
