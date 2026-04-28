import 'dotenv/config';
import request from 'supertest';
import { beforeEach, describe, it, expect } from '@jest/globals';
import { app } from '../src/app';
import { prisma, cleanDb } from './setup';
import { signToken } from '../src/lib/jwt';

const authA = () => ({ Authorization: `Bearer ${signToken({ id: 't', phone: '0', role: 'admin' })}` });

beforeEach(cleanDb);

describe('POST /api/relationships', () => {
  it('creates parent_child relationship', async () => {
    const parent = await prisma.person.create({ data: { fullName: 'Parent', gender: 'male', generation: 1 } });
    const child = await prisma.person.create({ data: { fullName: 'Child', gender: 'male', generation: 2 } });
    const res = await request(app).post('/api/relationships').set(authA())
      .send({ personAId: parent.id, personBId: child.id, type: 'parent_child' });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('parent_child');
  });

  it('creates spouse relationship', async () => {
    const p1 = await prisma.person.create({ data: { fullName: 'Husband', gender: 'male', generation: 1 } });
    const p2 = await prisma.person.create({ data: { fullName: 'Wife', gender: 'female', generation: 1 } });
    const res = await request(app).post('/api/relationships').set(authA())
      .send({ personAId: p1.id, personBId: p2.id, type: 'spouse' });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe('spouse');
  });
});

describe('DELETE /api/relationships/:id', () => {
  it('deletes a relationship', async () => {
    const p1 = await prisma.person.create({ data: { fullName: 'A', gender: 'male', generation: 1 } });
    const p2 = await prisma.person.create({ data: { fullName: 'B', gender: 'male', generation: 2 } });
    const rel = await prisma.relationship.create({ data: { personAId: p1.id, personBId: p2.id, type: 'parent_child' } });
    const res = await request(app).delete(`/api/relationships/${rel.id}`).set(authA());
    expect(res.status).toBe(204);
  });
});
