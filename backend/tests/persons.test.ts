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

describe('PUT /api/persons/:id — location fields', () => {
  it('stores hometown and homeLat/homeLng', async () => {
    const person = await prisma.person.create({
      data: { fullName: 'Lâm Văn A', gender: 'male', generation: 1 },
    });
    const res = await request(app).put(`/api/persons/${person.id}`).set(authA())
      .send({ hometown: 'Đồng Tháp', homeLat: 10.339, homeLng: 105.688 });
    expect(res.status).toBe(200);
    expect(res.body.hometown).toBe('Đồng Tháp');
    expect(res.body.homeLat).toBeCloseTo(10.339);
    expect(res.body.homeLng).toBeCloseTo(105.688);
  });

  it('stores currentLat/currentLng', async () => {
    const person = await prisma.person.create({
      data: { fullName: 'Lâm Văn B', gender: 'male', generation: 1 },
    });
    const res = await request(app).put(`/api/persons/${person.id}`).set(authA())
      .send({ address: 'Q.7, TP.HCM', currentLat: 10.732, currentLng: 106.722 });
    expect(res.status).toBe(200);
    expect(res.body.currentLat).toBeCloseTo(10.732);
    expect(res.body.currentLng).toBeCloseTo(106.722);
  });

  it('clears homeLat/homeLng when hometown set to empty string', async () => {
    const person = await prisma.person.create({
      data: { fullName: 'Lâm Văn C', gender: 'male', generation: 1, hometown: 'Đồng Tháp', homeLat: 10.339, homeLng: 105.688 },
    });
    const res = await request(app).put(`/api/persons/${person.id}`).set(authA())
      .send({ hometown: '' });
    expect(res.status).toBe(200);
    expect(res.body.homeLat).toBeNull();
    expect(res.body.homeLng).toBeNull();
  });

  it('clears currentLat/currentLng when address set to empty string', async () => {
    const person = await prisma.person.create({
      data: { fullName: 'Lâm Văn D', gender: 'male', generation: 1, address: 'HCM', currentLat: 10.8, currentLng: 106.6 },
    });
    const res = await request(app).put(`/api/persons/${person.id}`).set(authA())
      .send({ address: '' });
    expect(res.status).toBe(200);
    expect(res.body.currentLat).toBeNull();
    expect(res.body.currentLng).toBeNull();
  });
});

describe('PUT /api/persons/:id — partial update preservation', () => {
  it('does not clobber birthDate when updating only hometown', async () => {
    const person = await prisma.person.create({
      data: { fullName: 'Lâm Văn E', gender: 'male', generation: 1, birthDate: new Date('1950-03-15') },
    });
    const res = await request(app).put(`/api/persons/${person.id}`).set(authA())
      .send({ hometown: 'Đồng Tháp' });
    expect(res.status).toBe(200);
    expect(res.body.hometown).toBe('Đồng Tháp');
    expect(res.body.birthDate).toBeTruthy();
    const saved = new Date(res.body.birthDate);
    expect(saved.getUTCFullYear()).toBe(1950);
    expect(saved.getUTCMonth()).toBe(2);
    expect(saved.getUTCDate()).toBe(15);
  });
});
