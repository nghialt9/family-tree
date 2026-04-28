import 'dotenv/config';
import request from 'supertest';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { app } from '../src/app';
import { prisma, cleanDb } from './setup';
import { signToken } from '../src/lib/jwt';

const viewerToken = () => signToken({ id: 'test', phone: '0111', role: 'viewer' });
const adminToken = () => signToken({ id: 'test', phone: '0999', role: 'admin' });
const authV = () => ({ Authorization: `Bearer ${viewerToken()}` });
const authA = () => ({ Authorization: `Bearer ${adminToken()}` });

beforeEach(cleanDb);

describe('GET /api/persons', () => {
  it('returns 401 without token', async () => {
    expect((await request(app).get('/api/persons')).status).toBe(401);
  });

  it('returns empty array when no persons', async () => {
    const res = await request(app).get('/api/persons').set(authV());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/persons', () => {
  it('returns 403 for viewer', async () => {
    const res = await request(app).post('/api/persons').set(authV())
      .send({ fullName: 'Test', gender: 'male', generation: 1 });
    expect(res.status).toBe(403);
  });

  it('creates person as admin', async () => {
    const res = await request(app).post('/api/persons').set(authA())
      .send({ fullName: 'Lâm Văn Thúi', gender: 'male', generation: 1 });
    expect(res.status).toBe(201);
    expect(res.body.fullName).toBe('Lâm Văn Thúi');
  });

  it('creates person and grants viewer access when flag set', async () => {
    const res = await request(app).post('/api/persons').set(authA()).send({
      fullName: 'Nguyễn Thị A', gender: 'female', generation: 2,
      phone: '0123456789', grantAccess: true, grantRole: 'viewer',
    });
    expect(res.status).toBe(201);
    const token = await prisma.accessToken.findUnique({ where: { phone: '0123456789' } });
    expect(token?.role).toBe('viewer');
  });
});

describe('PUT /api/persons/:id', () => {
  it('updates a person', async () => {
    const person = await prisma.person.create({ data: { fullName: 'Old Name', gender: 'male', generation: 1 } });
    const res = await request(app).put(`/api/persons/${person.id}`).set(authA())
      .send({ fullName: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('New Name');
  });
});

describe('DELETE /api/persons/:id', () => {
  it('deletes a person', async () => {
    const person = await prisma.person.create({ data: { fullName: 'To Delete', gender: 'male', generation: 1 } });
    const res = await request(app).delete(`/api/persons/${person.id}`).set(authA());
    expect(res.status).toBe(204);
    expect(await prisma.person.findUnique({ where: { id: person.id } })).toBeNull();
  });
});

describe('GET /api/persons/:id/relatives', () => {
  it('returns parents, children, spouses', async () => {
    const parent = await prisma.person.create({ data: { fullName: 'Parent', gender: 'male', generation: 1 } });
    const child = await prisma.person.create({ data: { fullName: 'Child', gender: 'male', generation: 2 } });
    await prisma.relationship.create({ data: { personAId: parent.id, personBId: child.id, type: 'parent_child' } });
    const res = await request(app).get(`/api/persons/${parent.id}/relatives`).set(authV());
    expect(res.status).toBe(200);
    expect(res.body.children).toHaveLength(1);
    expect(res.body.parents).toHaveLength(0);
  });
});
