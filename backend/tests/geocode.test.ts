import 'dotenv/config';
import request from 'supertest';
import { beforeEach, afterEach, describe, expect, it } from '@jest/globals';
import { app } from '../src/app';
import { cleanDb } from './setup';
import { signToken } from '../src/lib/jwt';

const viewerToken = () => signToken({ id: 'test', phone: '0111', role: 'viewer' });
const authV = () => ({ Authorization: `Bearer ${viewerToken()}` });

beforeEach(cleanDb);
afterEach(() => { delete (global as any).fetch; });

describe('GET /api/geocode', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/geocode?q=Hanoi');
    expect(res.status).toBe(401);
  });

  it('returns 400 when q is missing', async () => {
    const res = await request(app).get('/api/geocode').set(authV());
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('q is required');
  });

  it('returns 400 when q is blank', async () => {
    const res = await request(app).get('/api/geocode?q=   ').set(authV());
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('q is required');
  });

  it('returns geocode results when Nominatim responds', async () => {
    (global as any).fetch = async () => ({
      ok: true,
      json: async () => [
        { lat: '10.7769', lon: '106.7009', display_name: 'Hồ Chí Minh, Việt Nam' },
      ],
    });
    const res = await request(app).get('/api/geocode?q=Ho+Chi+Minh').set(authV());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].lat).toBeCloseTo(10.7769);
    expect(res.body[0].lng).toBeCloseTo(106.7009);
    expect(res.body[0].displayName).toBe('Hồ Chí Minh, Việt Nam');
  });

  it('returns empty array when Nominatim finds nothing', async () => {
    (global as any).fetch = async () => ({
      ok: true,
      json: async () => [],
    });
    const res = await request(app).get('/api/geocode?q=xyzxyzxyz').set(authV());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('returns 502 when Nominatim is unavailable', async () => {
    (global as any).fetch = async () => ({ ok: false, status: 503 });
    const res = await request(app).get('/api/geocode?q=somewhere').set(authV());
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('Geocoding service unavailable');
  });

  it('returns 502 when fetch throws', async () => {
    (global as any).fetch = async () => { throw new Error('Network error'); };
    const res = await request(app).get('/api/geocode?q=somewhere').set(authV());
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('Geocoding service unavailable');
  });
});
