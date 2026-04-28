import 'dotenv/config';
import request from 'supertest';
import { app } from '../src/app';
import { prisma, cleanDb } from './setup';
import bcrypt from 'bcryptjs';

beforeEach(cleanDb);

describe('POST /api/auth/check-phone', () => {
  it('returns 404 for unknown phone', async () => {
    const res = await request(app).post('/api/auth/check-phone').send({ phone: '0000000000' });
    expect(res.status).toBe(404);
  });

  it('returns role:viewer for viewer phone', async () => {
    await prisma.accessToken.create({ data: { phone: '0111111111', role: 'viewer' } });
    const res = await request(app).post('/api/auth/check-phone').send({ phone: '0111111111' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('viewer');
  });

  it('returns role:admin for admin phone', async () => {
    await prisma.accessToken.create({
      data: { phone: '0999999999', role: 'admin', passwordHash: await bcrypt.hash('secret', 12) },
    });
    const res = await request(app).post('/api/auth/check-phone').send({ phone: '0999999999' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });
});

describe('POST /api/auth/login', () => {
  it('issues JWT for viewer with phone only', async () => {
    await prisma.accessToken.create({ data: { phone: '0111111111', role: 'viewer' } });
    const res = await request(app).post('/api/auth/login').send({ phone: '0111111111' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.role).toBe('viewer');
  });

  it('rejects admin login without password', async () => {
    await prisma.accessToken.create({
      data: { phone: '0999999999', role: 'admin', passwordHash: await bcrypt.hash('secret', 12) },
    });
    const res = await request(app).post('/api/auth/login').send({ phone: '0999999999' });
    expect(res.status).toBe(400);
  });

  it('rejects admin login with wrong password', async () => {
    await prisma.accessToken.create({
      data: { phone: '0999999999', role: 'admin', passwordHash: await bcrypt.hash('secret', 12) },
    });
    const res = await request(app).post('/api/auth/login').send({ phone: '0999999999', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('issues JWT for admin with correct password', async () => {
    await prisma.accessToken.create({
      data: { phone: '0999999999', role: 'admin', passwordHash: await bcrypt.hash('secret', 12) },
    });
    const res = await request(app).post('/api/auth/login').send({ phone: '0999999999', password: 'secret' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.role).toBe('admin');
  });
});
