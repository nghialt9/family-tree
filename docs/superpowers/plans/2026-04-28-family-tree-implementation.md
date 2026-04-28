# Family Tree App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build justinlam-familytree — a multi-generation Vietnamese family tree app with Vue 3 + VueFlow frontend, Express + PostgreSQL backend, phone-based JWT auth (viewer: phone only / admin: phone + password), full CRUD UI, and single-container Docker deployment on fly.io.

**Architecture:** Single Express app serves both `/api/*` REST endpoints and the built Vue 3 static files from `./public`. VueFlow renders the tree client-side using dagre-computed positions returned by `GET /api/tree`. SpouseConnector virtual nodes enable the side-by-side couple layout with children descending from the midpoint.

**Tech Stack:** Vue 3 + Vite + @vue-flow/core + Pinia + Axios · Node.js + Express + Prisma + PostgreSQL + TypeScript · bcryptjs + jsonwebtoken · @dagrejs/dagre · Docker multi-stage + fly.io

---

## File Map

### Backend (`backend/`)
| File | Responsibility |
|---|---|
| `src/server.ts` | HTTP server entry, port binding |
| `src/app.ts` | Express setup, middleware, routes, static file serving |
| `src/lib/jwt.ts` | sign / verify JWT |
| `src/middleware/auth.ts` | `requireViewer`, `requireAdmin` middleware |
| `src/routes/auth.ts` | POST /api/auth/check-phone · POST /api/auth/login |
| `src/routes/persons.ts` | All /api/persons/* routes |
| `src/routes/relationships.ts` | POST/DELETE /api/relationships |
| `src/routes/tree.ts` | GET /api/tree |
| `src/services/treeLayout.ts` | dagre layout, SpouseConnector nodes |
| `src/services/personService.ts` | Person CRUD + access_token upsert in one transaction |
| `prisma/schema.prisma` | DB schema |
| `prisma/seed.ts` | Full Lâm family seed data |
| `tests/setup.ts` | Prisma test client, db clean helper |
| `tests/auth.test.ts` | Auth route tests |
| `tests/persons.test.ts` | Persons route tests |
| `tests/relationships.test.ts` | Relationships route tests |
| `tests/tree.test.ts` | Tree layout tests |

### Frontend (`frontend/`)
| File | Responsibility |
|---|---|
| `src/main.ts` | App bootstrap |
| `src/router/index.ts` | Routes with auth navigation guard |
| `src/api/index.ts` | Axios instance + typed API calls |
| `src/stores/auth.ts` | Pinia store: token, role, login, logout |
| `src/pages/LoginPage.vue` | Two-step: phone → (admin only) password |
| `src/pages/TreePage.vue` | Assembles canvas + drawer + form |
| `src/components/FamilyTreeCanvas.vue` | VueFlow canvas, loads `/api/tree` |
| `src/components/PersonNode.vue` | Rich card node (style C) |
| `src/components/SpouseConnector.vue` | Invisible midpoint node |
| `src/components/PersonDrawer.vue` | Slide-in detail panel |
| `src/components/PersonForm.vue` | Add/edit modal with access grant |

### Root
| File | Responsibility |
|---|---|
| `Dockerfile` | Multi-stage: build frontend → build backend → production image |
| `docker-compose.yml` | Local dev: backend + postgres |
| `fly.toml` | fly.io config |
| `.github/workflows/deploy.yml` | CI/CD |

---

## Task 1: Backend project scaffold

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/jest.config.js`
- Create: `backend/.env.example`
- Create: `backend/src/server.ts`
- Create: `backend/src/app.ts`

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "family-tree-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest --runInBand --forceExit",
    "db:seed": "ts-node prisma/seed.ts"
  },
  "dependencies": {
    "@dagrejs/dagre": "^1.1.2",
    "@prisma/client": "^5.14.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/multer": "^1.4.11",
    "@types/node": "^20.14.0",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "prisma": "^5.14.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.1.5",
    "ts-node": "^10.9.2",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `backend/jest.config.js`**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  globals: { 'ts-jest': { tsconfig: { strict: true, esModuleInterop: true } } },
};
```

- [ ] **Step 4: Create `backend/.env.example`**

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/family_tree"
JWT_SECRET="change-this-secret"
JWT_EXPIRES_IN="7d"
UPLOAD_DIR="./uploads"
PORT=3000
```

- [ ] **Step 5: Create `backend/src/app.ts`**

```typescript
import express from 'express';
import cors from 'cors';
import path from 'path';
import { authRouter } from './routes/auth';
import { personsRouter } from './routes/persons';
import { relationshipsRouter } from './routes/relationships';
import { treeRouter } from './routes/tree';

export const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/persons', personsRouter);
app.use('/api/relationships', relationshipsRouter);
app.use('/api/tree', treeRouter);

// Serve built frontend in production
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});
```

- [ ] **Step 6: Create `backend/src/server.ts`**

```typescript
import 'dotenv/config';
import { app } from './app';

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

- [ ] **Step 7: Install dependencies**

```bash
cd backend && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 8: Commit**

```bash
git add backend/
git commit -m "feat: initialize backend project scaffold"
```

---

## Task 2: Prisma schema and initial migration

**Files:**
- Create: `backend/prisma/schema.prisma`

- [ ] **Step 1: Initialize Prisma**

```bash
cd backend && npx prisma init --datasource-provider postgresql
```

Expected: `prisma/schema.prisma` and `.env` created.

- [ ] **Step 2: Write `backend/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Person {
  id          String    @id @default(uuid())
  fullName    String
  nickname    String?
  gender      Gender
  birthDate   DateTime?
  deathDate   DateTime?
  phone       String?
  address     String?
  bio         String?
  avatarUrl   String?
  generation  Int       @default(1)
  isAlive     Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  relationshipsAsA Relationship[] @relation("PersonA")
  relationshipsAsB Relationship[] @relation("PersonB")
  accessToken      AccessToken?

  @@map("persons")
}

model Relationship {
  id           String           @id @default(uuid())
  personAId    String
  personBId    String
  type         RelationshipType
  marriedDate  DateTime?
  divorcedDate DateTime?

  personA Person @relation("PersonA", fields: [personAId], references: [id], onDelete: Cascade)
  personB Person @relation("PersonB", fields: [personBId], references: [id], onDelete: Cascade)

  @@map("relationships")
}

model AccessToken {
  id           String   @id @default(uuid())
  phone        String   @unique
  role         Role
  label        String?
  passwordHash String?
  personId     String?  @unique

  person Person? @relation(fields: [personId], references: [id], onDelete: SetNull)

  @@map("access_tokens")
}

enum Gender {
  male
  female
}

enum RelationshipType {
  parent_child
  spouse
}

enum Role {
  viewer
  admin
}
```

- [ ] **Step 3: Create .env file for backend**

Copy `.env.example` to `.env` and set `DATABASE_URL` to your local postgres. With docker-compose it will be:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/family_tree"
JWT_SECRET="dev-secret-change-in-production"
JWT_EXPIRES_IN="7d"
UPLOAD_DIR="./uploads"
PORT=3000
```

- [ ] **Step 4: Start local postgres via docker-compose (write file first)**

Create `docker-compose.yml` in repo root:

```yaml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: family_tree
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/family_tree
      JWT_SECRET: dev-secret-change-in-production
      JWT_EXPIRES_IN: 7d
      UPLOAD_DIR: /data/uploads
      PORT: 3000
    depends_on:
      - postgres
    volumes:
      - uploads:/data/uploads

volumes:
  pgdata:
  uploads:
```

Then start postgres only:
```bash
docker-compose up -d postgres
```

- [ ] **Step 5: Run migration**

```bash
cd backend && npx prisma migrate dev --name init
```

Expected: `prisma/migrations/` created, tables created in DB.

- [ ] **Step 6: Generate Prisma client**

```bash
cd backend && npx prisma generate
```

Expected: `@prisma/client` generated with full types.

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/ docker-compose.yml
git commit -m "feat: add prisma schema and docker-compose"
```

---

## Task 3: JWT utilities and auth middleware

**Files:**
- Create: `backend/src/lib/jwt.ts`
- Create: `backend/src/middleware/auth.ts`
- Create: `backend/tests/setup.ts`

- [ ] **Step 1: Create `backend/src/lib/jwt.ts`**

```typescript
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  id: string;
  phone: string;
  role: 'viewer' | 'admin';
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
}
```

- [ ] **Step 2: Create `backend/src/middleware/auth.ts`**

```typescript
import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../lib/jwt';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

function extractUser(req: AuthRequest): JwtPayload | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    return verifyToken(header.slice(7));
  } catch {
    return null;
  }
}

export function requireViewer(req: AuthRequest, res: Response, next: NextFunction): void {
  const user = extractUser(req);
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  req.user = user;
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  const user = extractUser(req);
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (user.role !== 'admin') { res.status(403).json({ error: 'Forbidden' }); return; }
  req.user = user;
  next();
}
```

- [ ] **Step 3: Create `backend/tests/setup.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

export async function cleanDb() {
  await prisma.accessToken.deleteMany();
  await prisma.relationship.deleteMany();
  await prisma.person.deleteMany();
}

afterAll(async () => {
  await prisma.$disconnect();
});
```

- [ ] **Step 4: Add `TEST_DATABASE_URL` to `.env`**

```
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/family_tree_test"
```

Create the test DB:
```bash
docker exec -it $(docker-compose ps -q postgres) psql -U postgres -c "CREATE DATABASE family_tree_test;"
```

Push schema to test DB:
```bash
cd backend && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/family_tree_test" npx prisma db push
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/ backend/src/middleware/ backend/tests/setup.ts
git commit -m "feat: add JWT utils and auth middleware"
```

---

## Task 4: Auth routes and tests

**Files:**
- Create: `backend/src/routes/auth.ts`
- Create: `backend/tests/auth.test.ts`

- [ ] **Step 1: Write the failing tests first — `backend/tests/auth.test.ts`**

```typescript
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd backend && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/family_tree_test" JWT_SECRET="test-secret" npx jest tests/auth.test.ts --no-coverage
```

Expected: FAIL — routes not defined yet.

- [ ] **Step 3: Create `backend/src/routes/auth.ts`**

```typescript
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { signToken } from '../lib/jwt';

const router = Router();
const prisma = new PrismaClient();

router.post('/check-phone', async (req, res) => {
  const { phone } = req.body as { phone: string };
  const token = await prisma.accessToken.findUnique({ where: { phone } });
  if (!token) { res.status(404).json({ error: 'Phone not found' }); return; }
  res.json({ role: token.role });
});

router.post('/login', async (req, res) => {
  const { phone, password } = req.body as { phone: string; password?: string };
  const token = await prisma.accessToken.findUnique({ where: { phone } });
  if (!token) { res.status(404).json({ error: 'Phone not found' }); return; }

  if (token.role === 'admin') {
    if (!password) { res.status(400).json({ error: 'Password required for admin' }); return; }
    const valid = await bcrypt.compare(password, token.passwordHash!);
    if (!valid) { res.status(401).json({ error: 'Invalid password' }); return; }
  }

  const jwt = signToken({ id: token.id, phone: token.phone, role: token.role });
  res.json({ token: jwt, role: token.role });
});

export { router as authRouter };
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd backend && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/family_tree_test" JWT_SECRET="test-secret" npx jest tests/auth.test.ts --no-coverage
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/auth.ts backend/tests/auth.test.ts
git commit -m "feat: add auth routes with phone + password flow"
```

---

## Task 5: Person service (CRUD + access grant)

**Files:**
- Create: `backend/src/services/personService.ts`

- [ ] **Step 1: Create `backend/src/services/personService.ts`**

```typescript
import { PrismaClient, Gender, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export interface CreatePersonInput {
  fullName: string;
  nickname?: string;
  gender: Gender;
  birthDate?: string;
  deathDate?: string;
  phone?: string;
  address?: string;
  bio?: string;
  generation: number;
  grantAccess?: boolean;
  grantRole?: Role;
  grantPassword?: string;
}

export interface UpdatePersonInput extends Partial<CreatePersonInput> {}

export async function createPerson(input: CreatePersonInput) {
  const { grantAccess, grantRole, grantPassword, ...personData } = input;

  return prisma.$transaction(async (tx) => {
    const person = await tx.person.create({
      data: {
        ...personData,
        isAlive: !personData.deathDate,
        birthDate: personData.birthDate ? new Date(personData.birthDate) : undefined,
        deathDate: personData.deathDate ? new Date(personData.deathDate) : undefined,
      },
    });

    if (grantAccess && personData.phone && grantRole) {
      const passwordHash = grantRole === 'admin' && grantPassword
        ? await bcrypt.hash(grantPassword, 12)
        : undefined;
      await tx.accessToken.upsert({
        where: { phone: personData.phone },
        create: { phone: personData.phone, role: grantRole, passwordHash, personId: person.id },
        update: { role: grantRole, passwordHash, personId: person.id },
      });
    }

    return person;
  });
}

export async function updatePerson(id: string, input: UpdatePersonInput) {
  const { grantAccess, grantRole, grantPassword, ...personData } = input;

  return prisma.$transaction(async (tx) => {
    const person = await tx.person.update({
      where: { id },
      data: {
        ...personData,
        isAlive: personData.deathDate ? false : undefined,
        birthDate: personData.birthDate ? new Date(personData.birthDate) : undefined,
        deathDate: personData.deathDate ? new Date(personData.deathDate) : undefined,
      },
    });

    if (grantAccess && personData.phone && grantRole) {
      const passwordHash = grantRole === 'admin' && grantPassword
        ? await bcrypt.hash(grantPassword, 12)
        : undefined;
      await tx.accessToken.upsert({
        where: { phone: personData.phone },
        create: { phone: personData.phone, role: grantRole, passwordHash, personId: person.id },
        update: { role: grantRole, passwordHash: passwordHash ?? undefined, personId: person.id },
      });
    }

    return person;
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/personService.ts
git commit -m "feat: add person service with access token provisioning"
```

---

## Task 6: Persons routes and tests

**Files:**
- Create: `backend/src/routes/persons.ts`
- Create: `backend/tests/persons.test.ts`

- [ ] **Step 1: Write failing tests — `backend/tests/persons.test.ts`**

```typescript
import 'dotenv/config';
import request from 'supertest';
import { app } from '../src/app';
import { prisma, cleanDb } from './setup';
import { signToken } from '../src/lib/jwt';

const viewerToken = () => signToken({ id: 'test', phone: '0111', role: 'viewer' });
const adminToken = () => signToken({ id: 'test', phone: '0999', role: 'admin' });
const authV = () => ({ Authorization: `Bearer ${viewerToken()}` });
const authA = () => ({ Authorization: `Bearer ${adminToken()}` });

beforeEach(cleanDb);

describe('GET /api/persons', () => {
  it('401 without token', async () => {
    expect((await request(app).get('/api/persons')).status).toBe(401);
  });

  it('returns empty array when no persons', async () => {
    const res = await request(app).get('/api/persons').set(authV());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/persons', () => {
  it('403 for viewer', async () => {
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
```

- [ ] **Step 2: Run — verify fail**

```bash
cd backend && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/family_tree_test" JWT_SECRET="test-secret" npx jest tests/persons.test.ts --no-coverage
```

Expected: FAIL.

- [ ] **Step 3: Create `backend/src/routes/persons.ts`**

```typescript
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import multer from 'multer';
import { requireViewer, requireAdmin } from '../middleware/auth';
import { createPerson, updatePerson } from '../services/personService';

const router = Router();
const prisma = new PrismaClient();

const upload = multer({
  dest: process.env.UPLOAD_DIR || './uploads',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

router.get('/', requireViewer, async (_req, res) => {
  const persons = await prisma.person.findMany({ orderBy: [{ generation: 'asc' }, { fullName: 'asc' }] });
  res.json(persons);
});

router.get('/:id', requireViewer, async (req, res) => {
  const person = await prisma.person.findUnique({ where: { id: req.params.id } });
  if (!person) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(person);
});

router.get('/:id/relatives', requireViewer, async (req, res) => {
  const { id } = req.params;
  const [asA, asB] = await Promise.all([
    prisma.relationship.findMany({ where: { personAId: id }, include: { personB: true } }),
    prisma.relationship.findMany({ where: { personBId: id }, include: { personA: true } }),
  ]);
  const parents = asB.filter(r => r.type === 'parent_child').map(r => r.personA);
  const children = asA.filter(r => r.type === 'parent_child').map(r => r.personB);
  const spouses = [
    ...asA.filter(r => r.type === 'spouse').map(r => r.personB),
    ...asB.filter(r => r.type === 'spouse').map(r => r.personA),
  ];
  res.json({ parents, children, spouses });
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const person = await createPerson(req.body);
    res.status(201).json(person);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const person = await updatePerson(req.params.id, req.body);
    res.json(person);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  await prisma.person.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

router.post('/:id/avatar', requireAdmin, upload.single('avatar'), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'No file' }); return; }
  const avatarUrl = `/uploads/${path.basename(req.file.path)}`;
  const person = await prisma.person.update({
    where: { id: req.params.id },
    data: { avatarUrl },
  });
  res.json(person);
});

export { router as personsRouter };
```

- [ ] **Step 4: Run tests — verify pass**

```bash
cd backend && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/family_tree_test" JWT_SECRET="test-secret" npx jest tests/persons.test.ts --no-coverage
```

Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/persons.ts backend/tests/persons.test.ts
git commit -m "feat: add persons CRUD routes with access grant"
```

---

## Task 7: Relationships routes and tests

**Files:**
- Create: `backend/src/routes/relationships.ts`
- Create: `backend/tests/relationships.test.ts`

- [ ] **Step 1: Write failing tests — `backend/tests/relationships.test.ts`**

```typescript
import 'dotenv/config';
import request from 'supertest';
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
```

- [ ] **Step 2: Run — verify fail**

```bash
cd backend && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/family_tree_test" JWT_SECRET="test-secret" npx jest tests/relationships.test.ts --no-coverage
```

- [ ] **Step 3: Create `backend/src/routes/relationships.ts`**

```typescript
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.post('/', requireAdmin, async (req, res) => {
  try {
    const rel = await prisma.relationship.create({ data: req.body });
    res.status(201).json(rel);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  await prisma.relationship.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export { router as relationshipsRouter };
```

- [ ] **Step 4: Run tests — verify pass**

```bash
cd backend && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/family_tree_test" JWT_SECRET="test-secret" npx jest tests/relationships.test.ts --no-coverage
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/relationships.ts backend/tests/relationships.test.ts
git commit -m "feat: add relationship routes"
```

---

## Task 8: Tree layout service and route

**Files:**
- Create: `backend/src/services/treeLayout.ts`
- Create: `backend/src/routes/tree.ts`
- Create: `backend/tests/tree.test.ts`

- [ ] **Step 1: Write failing test — `backend/tests/tree.test.ts`**

```typescript
import 'dotenv/config';
import request from 'supertest';
import { app } from '../src/app';
import { prisma, cleanDb } from './setup';
import { signToken } from '../src/lib/jwt';

const authV = () => ({ Authorization: `Bearer ${signToken({ id: 't', phone: '0', role: 'viewer' })}` });

beforeEach(cleanDb);

it('GET /api/tree returns nodes and edges', async () => {
  const p1 = await prisma.person.create({ data: { fullName: 'Parent', gender: 'male', generation: 1 } });
  const p2 = await prisma.person.create({ data: { fullName: 'Child', gender: 'male', generation: 2 } });
  await prisma.relationship.create({ data: { personAId: p1.id, personBId: p2.id, type: 'parent_child' } });

  const res = await request(app).get('/api/tree').set(authV());
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.nodes)).toBe(true);
  expect(Array.isArray(res.body.edges)).toBe(true);
  expect(res.body.nodes.length).toBe(2);
  expect(res.body.nodes[0].position).toBeDefined();
});
```

- [ ] **Step 2: Run — verify fail**

```bash
cd backend && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/family_tree_test" JWT_SECRET="test-secret" npx jest tests/tree.test.ts --no-coverage
```

- [ ] **Step 3: Create `backend/src/services/treeLayout.ts`**

```typescript
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
  label?: string;
}

export function buildTree(persons: Person[], relationships: Relationship[]): { nodes: TreeNode[]; edges: TreeEdge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 100 });

  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];

  // Add person nodes
  for (const p of persons) {
    g.setNode(p.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // Find spouse pairs and create connector nodes
  const spouseRels = relationships.filter(r => r.type === 'spouse');
  const parentChildRels = relationships.filter(r => r.type === 'parent_child');

  const connectorMap = new Map<string, string>(); // "idA-idB" -> connectorId

  for (const rel of spouseRels) {
    const key = [rel.personAId, rel.personBId].sort().join('-');
    if (!connectorMap.has(key)) {
      const connId = `connector-${key}`;
      connectorMap.set(key, connId);
      g.setNode(connId, { width: 1, height: 1 });
      g.setEdge(rel.personAId, connId);
      g.setEdge(rel.personBId, connId);
      edges.push({ id: `spouse-${rel.id}`, source: rel.personAId, target: connId, type: 'spouse' });
      edges.push({ id: `spouse2-${rel.id}`, source: rel.personBId, target: connId, type: 'spouse' });
    }
  }

  // Add parent-child edges (from connector if parents are coupled, else direct)
  for (const rel of parentChildRels) {
    const spouseRel = spouseRels.find(s =>
      (s.personAId === rel.personAId || s.personBId === rel.personAId)
    );
    const sourceId = spouseRel
      ? connectorMap.get([spouseRel.personAId, spouseRel.personBId].sort().join('-')) ?? rel.personAId
      : rel.personAId;

    g.setEdge(sourceId, rel.personBId);
    edges.push({ id: `pc-${rel.id}`, source: sourceId, target: rel.personBId, type: 'parentChild' });
  }

  dagre.layout(g);

  for (const p of persons) {
    const { x, y } = g.node(p.id);
    nodes.push({
      id: p.id,
      type: 'person',
      position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 },
      data: p,
    });
  }

  for (const [, connId] of connectorMap) {
    const { x, y } = g.node(connId);
    nodes.push({
      id: connId,
      type: 'spouseConnector',
      position: { x, y },
      data: { label: '' },
    });
  }

  return { nodes, edges };
}
```

- [ ] **Step 4: Create `backend/src/routes/tree.ts`**

```typescript
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireViewer } from '../middleware/auth';
import { buildTree } from '../services/treeLayout';

const router = Router();
const prisma = new PrismaClient();

router.get('/', requireViewer, async (_req, res) => {
  const [persons, relationships] = await Promise.all([
    prisma.person.findMany(),
    prisma.relationship.findMany(),
  ]);
  res.json(buildTree(persons, relationships));
});

export { router as treeRouter };
```

- [ ] **Step 5: Run tests — verify pass**

```bash
cd backend && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/family_tree_test" JWT_SECRET="test-secret" npx jest tests/tree.test.ts --no-coverage
```

Expected: PASS.

- [ ] **Step 6: Run all backend tests**

```bash
cd backend && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/family_tree_test" JWT_SECRET="test-secret" npx jest --no-coverage
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/tree.ts backend/src/services/treeLayout.ts backend/tests/tree.test.ts
git commit -m "feat: add tree layout service with dagre and spouse connectors"
```

---

## Task 9: Seed data — Lâm family

**Files:**
- Create: `backend/prisma/seed.ts`

- [ ] **Step 1: Create `backend/prisma/seed.ts`**

```typescript
import { PrismaClient, Gender } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Lâm family data...');

  const gen = (g: number) => g;

  // Generation 1
  const thui = await prisma.person.create({
    data: { fullName: 'Lâm Văn Thúi', nickname: 'Thúi', gender: 'male', generation: gen(1), isAlive: false },
  });

  // Generation 2
  const [tieu, lieu, lang, mang, non, nuoc, dep, pha, qua] = await Promise.all([
    prisma.person.create({ data: { fullName: 'Lâm Thị Tiếu', nickname: 'Tiếu', gender: 'female', generation: gen(2) } }),
    prisma.person.create({ data: { fullName: 'Lâm Văn Liếu', nickname: 'Liếu', gender: 'male', generation: gen(2), phone: '0985762894' } }),
    prisma.person.create({ data: { fullName: 'Lâm Văn Lăng', nickname: 'Lăng', gender: 'male', generation: gen(2), phone: '0981812961' } }),
    prisma.person.create({ data: { fullName: 'Lâm Văn Măng', nickname: 'Măng', gender: 'male', generation: gen(2), phone: '0342746696' } }),
    prisma.person.create({ data: { fullName: 'Lâm Văn Non', nickname: 'Non', gender: 'male', generation: gen(2), phone: '0368914214' } }),
    prisma.person.create({ data: { fullName: 'Lâm Thị Nước', nickname: 'Nước', gender: 'female', generation: gen(2), isAlive: false } }),
    prisma.person.create({ data: { fullName: 'Lâm Thị Đẹp', nickname: 'Đẹp', gender: 'female', generation: gen(2) } }),
    prisma.person.create({ data: { fullName: 'Lâm Văn Pha', nickname: 'Pha', gender: 'male', generation: gen(2), phone: '0342981654' } }),
    prisma.person.create({ data: { fullName: 'Lâm Văn Qua', nickname: 'Qua', gender: 'male', generation: gen(2) } }),
  ]);

  // Gen 2 parent-child from Thúi
  for (const child of [tieu, lieu, lang, mang, non, nuoc, dep, pha, qua]) {
    await prisma.relationship.create({ data: { personAId: thui.id, personBId: child.id, type: 'parent_child' } });
  }

  // Generation 3 — children of Tiếu
  const [binh, minh, dan, ho] = await Promise.all([
    prisma.person.create({ data: { fullName: 'Nguyễn Văn Bình', nickname: 'Bình', gender: 'male', generation: gen(3), phone: '0367327153' } }),
    prisma.person.create({ data: { fullName: 'Nguyễn Văn Minh', nickname: 'Minh', gender: 'male', generation: gen(3) } }),
    prisma.person.create({ data: { fullName: 'Nguyễn Văn Dân', nickname: 'Dân', gender: 'male', generation: gen(3) } }),
    prisma.person.create({ data: { fullName: 'Nguyễn Văn Hồ', nickname: 'Hồ', gender: 'male', generation: gen(3) } }),
  ]);
  for (const c of [binh, minh, dan, ho]) await prisma.relationship.create({ data: { personAId: tieu.id, personBId: c.id, type: 'parent_child' } });

  // children of Liếu
  const [hung, hien, hai, hau] = await Promise.all([
    prisma.person.create({ data: { fullName: 'Lâm Văn Hùng', nickname: 'Hùng', gender: 'male', generation: gen(3), phone: '0832708189' } }),
    prisma.person.create({ data: { fullName: 'Lâm Thị Hiền', nickname: 'Hiền', gender: 'female', generation: gen(3), phone: '0386804319' } }),
    prisma.person.create({ data: { fullName: 'Lâm Văn Hài', nickname: 'Hài', gender: 'male', generation: gen(3), isAlive: false } }),
    prisma.person.create({ data: { fullName: 'Lâm Văn Hậu', nickname: 'Hậu', gender: 'male', generation: gen(3), phone: '0366728486' } }),
  ]);
  for (const c of [hung, hien, hai, hau]) await prisma.relationship.create({ data: { personAId: lieu.id, personBId: c.id, type: 'parent_child' } });

  // children of Lăng
  const [nhanh, nhan, nghia, phuong] = await Promise.all([
    prisma.person.create({ data: { fullName: 'Lâm Văn Nhanh', nickname: 'Nhanh', gender: 'male', generation: gen(3) } }),
    prisma.person.create({ data: { fullName: 'Lâm Văn Nhân', nickname: 'Nhân', gender: 'male', generation: gen(3), phone: '0939309402' } }),
    prisma.person.create({ data: { fullName: 'Lâm Trọng Nghĩa', nickname: 'Nghĩa', gender: 'male', generation: gen(3), phone: '0972737308' } }),
    prisma.person.create({ data: { fullName: 'Lâm Thị Phương', nickname: 'Phương', gender: 'female', generation: gen(3), phone: '0983948081' } }),
  ]);
  for (const c of [nhanh, nhan, nghia, phuong]) await prisma.relationship.create({ data: { personAId: lang.id, personBId: c.id, type: 'parent_child' } });

  // children of Măng
  const [hang, phong] = await Promise.all([
    prisma.person.create({ data: { fullName: 'Lâm Thị Hằng', nickname: 'Hằng', gender: 'female', generation: gen(3) } }),
    prisma.person.create({ data: { fullName: 'Lâm Văn Phong', nickname: 'Phong', gender: 'male', generation: gen(3), phone: '0788856876' } }),
  ]);
  for (const c of [hang, phong]) await prisma.relationship.create({ data: { personAId: mang.id, personBId: c.id, type: 'parent_child' } });

  // children of Non
  const [chi, chi1] = await Promise.all([
    prisma.person.create({ data: { fullName: 'Lâm Thị Chi', nickname: 'Chi', gender: 'female', generation: gen(3), phone: '0372576462' } }),
    prisma.person.create({ data: { fullName: 'Lâm Văn Chí', nickname: 'Chí', gender: 'male', generation: gen(3), phone: '0328739463' } }),
  ]);
  for (const c of [chi, chi1]) await prisma.relationship.create({ data: { personAId: non.id, personBId: c.id, type: 'parent_child' } });

  // children of Đẹp
  const [tu, dung] = await Promise.all([
    prisma.person.create({ data: { fullName: 'Lâm Văn Tú', nickname: 'Tú', gender: 'male', generation: gen(3), phone: '0352980551' } }),
    prisma.person.create({ data: { fullName: 'Lâm Thị Dung', nickname: 'Dung', gender: 'female', generation: gen(3), phone: '0392431181' } }),
  ]);
  for (const c of [tu, dung]) await prisma.relationship.create({ data: { personAId: dep.id, personBId: c.id, type: 'parent_child' } });

  // children of Pha
  const [luan, nhi] = await Promise.all([
    prisma.person.create({ data: { fullName: 'Lâm Văn Luân', nickname: 'Luân', gender: 'male', generation: gen(3) } }),
    prisma.person.create({ data: { fullName: 'Lâm Thị Nhi', nickname: 'Nhi', gender: 'female', generation: gen(3) } }),
  ]);
  for (const c of [luan, nhi]) await prisma.relationship.create({ data: { personAId: pha.id, personBId: c.id, type: 'parent_child' } });

  // children of Qua
  const [phuong1, ly] = await Promise.all([
    prisma.person.create({ data: { fullName: 'Lâm Thị Phượng', nickname: 'Phượng', gender: 'female', generation: gen(3), phone: '0337625398' } }),
    prisma.person.create({ data: { fullName: 'Lâm Thị Ly', nickname: 'Ly', gender: 'female', generation: gen(3) } }),
  ]);
  for (const c of [phuong1, ly]) await prisma.relationship.create({ data: { personAId: qua.id, personBId: c.id, type: 'parent_child' } });

  // Generation 4
  const gen4: Array<{ parent: { id: string }, data: Parameters<typeof prisma.person.create>[0]['data'] }> = [
    { parent: binh, data: { fullName: 'Con Bình 1', gender: 'female' as Gender, generation: 4 } },
    { parent: binh, data: { fullName: 'Con Bình 2', gender: 'female' as Gender, generation: 4 } },
    { parent: binh, data: { fullName: 'Con Bình 3', gender: 'male' as Gender, generation: 4 } },
    { parent: dan,  data: { fullName: 'Con Dân 1',  gender: 'female' as Gender, generation: 4 } },
    { parent: hung, data: { fullName: 'Lâm Thị Thi',    nickname: 'Thi',    gender: 'female' as Gender, generation: 4 } },
    { parent: hung, data: { fullName: 'Lâm Văn Tài',    nickname: 'Tài',    gender: 'male'   as Gender, generation: 4 } },
    { parent: hien, data: { fullName: 'Lâm Thị Thảo',   nickname: 'Thảo',   gender: 'female' as Gender, generation: 4 } },
    { parent: hien, data: { fullName: 'Lâm Thị Duyên',  nickname: 'Duyên',  gender: 'female' as Gender, generation: 4 } },
    { parent: hien, data: { fullName: 'Lâm Thị Duyên 2',                    gender: 'female' as Gender, generation: 4 } },
    { parent: hai,  data: { fullName: 'Con Hài 1',                           gender: 'male'   as Gender, generation: 4 } },
    { parent: hai,  data: { fullName: 'Lâm Văn Phú',    nickname: 'Phú',    gender: 'male'   as Gender, generation: 4 } },
    { parent: nhanh,data: { fullName: 'Lâm Văn Trí',    nickname: 'Trí',    gender: 'male'   as Gender, generation: 4, phone: '0984783471' } },
    { parent: nhan, data: { fullName: 'Lâm Thị Ngọc',   nickname: 'Ngọc',   gender: 'female' as Gender, generation: 4 } },
    { parent: hang, data: { fullName: 'Lâm Văn Thuận',  nickname: 'Thuận',  gender: 'male'   as Gender, generation: 4, phone: '0372824019' } },
    { parent: hang, data: { fullName: 'Lâm Văn Nguyên', nickname: 'Nguyên', gender: 'male'   as Gender, generation: 4 } },
    { parent: tu,   data: { fullName: 'Lâm Thị Ngân',   nickname: 'Ngân',   gender: 'female' as Gender, generation: 4 } },
  ];

  for (const { parent, data } of gen4) {
    const child = await prisma.person.create({ data });
    await prisma.relationship.create({ data: { personAId: parent.id, personBId: child.id, type: 'parent_child' } });
  }

  // Admin access token (Nghĩa)
  await prisma.accessToken.create({
    data: {
      phone: '0972737308',
      role: 'admin',
      label: 'Nghĩa (Admin)',
      passwordHash: await bcrypt.hash('familytree2024', 12),
      personId: nghia.id,
    },
  });

  console.log('Seed complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run seed against dev database**

```bash
cd backend && npx prisma db seed
```

Expected: "Seed complete!" — ~50 persons inserted.

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat: add Lâm family seed data with all generations"
```

---

## Task 10: Frontend project scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.ts`
- Create: `frontend/src/App.vue`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "family-tree-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "@vue-flow/background": "^1.3.2",
    "@vue-flow/controls": "^1.1.2",
    "@vue-flow/core": "^1.41.4",
    "@vue-flow/minimap": "^1.5.2",
    "axios": "^1.7.2",
    "pinia": "^2.1.7",
    "vue": "^3.4.27",
    "vue-router": "^4.3.3"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.5",
    "@vue/test-utils": "^2.4.6",
    "jsdom": "^24.1.0",
    "typescript": "^5.4.5",
    "vite": "^5.3.1",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

- [ ] **Step 3: Create `frontend/index.html`**

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Gia Phả Nhà Lâm</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 4: Create `frontend/src/main.ts`**

```typescript
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';

createApp(App).use(createPinia()).use(router).mount('#app');
```

- [ ] **Step 5: Create `frontend/src/App.vue`**

```vue
<template>
  <RouterView />
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', sans-serif; background: #0d1117; color: #e6edf3; }
</style>
```

- [ ] **Step 6: Install dependencies**

```bash
cd frontend && npm install
```

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: initialize Vue 3 frontend with VueFlow"
```

---

## Task 11: Auth store, API client, and router

**Files:**
- Create: `frontend/src/api/index.ts`
- Create: `frontend/src/stores/auth.ts`
- Create: `frontend/src/router/index.ts`

- [ ] **Step 1: Create `frontend/src/api/index.ts`**

```typescript
import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authApi = {
  checkPhone: (phone: string) => api.post('/auth/check-phone', { phone }),
  login: (phone: string, password?: string) => api.post('/auth/login', { phone, password }),
};

export const personsApi = {
  list: () => api.get('/persons'),
  get: (id: string) => api.get(`/persons/${id}`),
  getRelatives: (id: string) => api.get(`/persons/${id}/relatives`),
  create: (data: unknown) => api.post('/persons', data),
  update: (id: string, data: unknown) => api.put(`/persons/${id}`, data),
  delete: (id: string) => api.delete(`/persons/${id}`),
  uploadAvatar: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('avatar', file);
    return api.post(`/persons/${id}/avatar`, fd);
  },
};

export const relationshipsApi = {
  create: (data: unknown) => api.post('/relationships', data),
  delete: (id: string) => api.delete(`/relationships/${id}`),
};

export const treeApi = {
  get: () => api.get('/tree'),
};
```

- [ ] **Step 2: Create `frontend/src/stores/auth.ts`**

```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '../api';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'));
  const role = ref<'viewer' | 'admin' | null>(localStorage.getItem('role') as any);

  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => role.value === 'admin');

  async function checkPhone(phone: string) {
    const res = await authApi.checkPhone(phone);
    return res.data.role as 'viewer' | 'admin';
  }

  async function login(phone: string, password?: string) {
    const res = await authApi.login(phone, password);
    token.value = res.data.token;
    role.value = res.data.role;
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('role', res.data.role);
  }

  function logout() {
    token.value = null;
    role.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('role');
  }

  return { token, role, isLoggedIn, isAdmin, checkPhone, login, logout };
});
```

- [ ] **Step 3: Create `frontend/src/router/index.ts`**

```typescript
import { createRouter, createWebHistory } from 'vue-router';
import LoginPage from '../pages/LoginPage.vue';
import TreePage from '../pages/TreePage.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginPage },
    {
      path: '/',
      component: TreePage,
      meta: { requiresAuth: true },
    },
  ],
});

router.beforeEach((to) => {
  const token = localStorage.getItem('token');
  if (to.meta.requiresAuth && !token) return '/login';
});
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/ frontend/src/stores/ frontend/src/router/
git commit -m "feat: add API client, auth store, and router"
```

---

## Task 12: LoginPage.vue

**Files:**
- Create: `frontend/src/pages/LoginPage.vue`

- [ ] **Step 1: Create `frontend/src/pages/LoginPage.vue`**

```vue
<template>
  <div class="login-wrap">
    <div class="login-card">
      <h1>🌳 Gia Phả Nhà Lâm</h1>
      <p class="subtitle">Nhập số điện thoại để xem gia phả</p>

      <form @submit.prevent="step === 1 ? handleCheckPhone() : handleLogin()">
        <div class="field">
          <label>Số điện thoại</label>
          <input v-model="phone" type="tel" placeholder="09xxxxxxxx" :disabled="step === 2" required />
        </div>

        <div v-if="step === 2" class="field">
          <label>Mật khẩu (admin)</label>
          <input v-model="password" type="password" placeholder="••••••••" required />
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <button type="submit" :disabled="loading">
          {{ loading ? 'Đang xử lý...' : step === 1 ? 'Tiếp tục' : 'Đăng nhập' }}
        </button>

        <button v-if="step === 2" type="button" class="back" @click="step = 1; password = ''; error = ''">
          ← Quay lại
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();

const phone = ref('');
const password = ref('');
const step = ref<1 | 2>(1);
const loading = ref(false);
const error = ref('');

async function handleCheckPhone() {
  loading.value = true; error.value = '';
  try {
    const role = await auth.checkPhone(phone.value);
    if (role === 'admin') {
      step.value = 2;
    } else {
      await auth.login(phone.value);
      router.push('/');
    }
  } catch {
    error.value = 'Số điện thoại không có quyền truy cập.';
  } finally {
    loading.value = false;
  }
}

async function handleLogin() {
  loading.value = true; error.value = '';
  try {
    await auth.login(phone.value, password.value);
    router.push('/');
  } catch {
    error.value = 'Mật khẩu không đúng.';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0d1117; }
.login-card { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 40px; width: 360px; }
h1 { font-size: 1.5rem; margin-bottom: 6px; }
.subtitle { color: #8b949e; margin-bottom: 24px; font-size: 0.9rem; }
.field { margin-bottom: 16px; }
label { display: block; margin-bottom: 6px; font-size: 0.85rem; color: #8b949e; }
input { width: 100%; padding: 10px 12px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: #e6edf3; font-size: 1rem; }
input:focus { outline: none; border-color: #58a6ff; }
button[type=submit] { width: 100%; padding: 12px; background: #238636; border: none; border-radius: 6px; color: #fff; font-size: 1rem; cursor: pointer; margin-top: 8px; }
button[type=submit]:hover { background: #2ea043; }
.back { width: 100%; padding: 8px; background: transparent; border: 1px solid #30363d; border-radius: 6px; color: #8b949e; cursor: pointer; margin-top: 8px; }
.error { color: #f85149; font-size: 0.85rem; margin-bottom: 8px; }
</style>
```

- [ ] **Step 2: Start dev servers and verify login works**

Terminal 1:
```bash
cd backend && npm run dev
```

Terminal 2:
```bash
cd frontend && npm run dev
```

Open `http://localhost:5173/login` — enter phone `0972737308`, then password `familytree2024` → should redirect to `/`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/LoginPage.vue
git commit -m "feat: add two-step login page"
```

---

## Task 13: PersonNode.vue and SpouseConnector.vue

**Files:**
- Create: `frontend/src/components/PersonNode.vue`
- Create: `frontend/src/components/SpouseConnector.vue`

- [ ] **Step 1: Create `frontend/src/components/PersonNode.vue`**

```vue
<template>
  <div class="person-node" :class="{ deceased: data.isAlive === false }">
    <Handle type="target" position="top" />
    <Handle type="source" position="bottom" />

    <div class="avatar">
      <img v-if="data.avatarUrl" :src="data.avatarUrl" :alt="data.fullName" />
      <span v-else>{{ data.gender === 'female' ? '👩' : '👨' }}</span>
    </div>

    <div class="info">
      <div class="gen-badge">Thế hệ {{ data.generation }}</div>
      <div class="name">{{ data.fullName }}</div>
      <div v-if="data.nickname" class="nickname">"{{ data.nickname }}"</div>
      <div v-if="data.birthDate" class="detail">🎂 {{ formatDate(data.birthDate) }}</div>
      <div v-if="data.deathDate" class="detail deceased-tag">✝ {{ formatDate(data.deathDate) }}</div>
      <div v-if="data.phone" class="detail">📞 {{ data.phone }}</div>
    </div>

    <div class="actions">
      <button class="btn-detail" @click="$emit('openDetail', data.id)">Chi tiết ▼</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';

defineProps<{ data: Record<string, any> }>();
defineEmits<{ (e: 'openDetail', id: string): void }>();

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('vi-VN');
}
</script>

<style scoped>
.person-node {
  background: #161b22; border: 2px solid #30363d; border-radius: 10px;
  padding: 12px; width: 220px; cursor: default; transition: border-color 0.2s;
}
.person-node:hover { border-color: #58a6ff; }
.person-node.deceased { border-color: #6e7681; opacity: 0.75; }
.avatar { text-align: center; font-size: 36px; margin-bottom: 8px; }
.avatar img { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; }
.gen-badge { background: #0f3460; color: #58a6ff; border-radius: 10px; padding: 1px 8px; font-size: 10px; display: inline-block; margin-bottom: 4px; }
.name { font-weight: bold; font-size: 13px; color: #e94560; }
.nickname { color: #8b949e; font-size: 11px; font-style: italic; }
.detail { color: #8b949e; font-size: 11px; margin-top: 2px; }
.deceased-tag { color: #f85149; }
.actions { margin-top: 8px; text-align: center; }
.btn-detail { background: #21262d; color: #8b949e; border: 1px solid #30363d; border-radius: 6px; padding: 3px 10px; font-size: 11px; cursor: pointer; }
.btn-detail:hover { background: #30363d; color: #e6edf3; }
</style>
```

- [ ] **Step 2: Create `frontend/src/components/SpouseConnector.vue`**

```vue
<template>
  <div class="spouse-connector">
    <Handle type="target" position="left" />
    <Handle type="target" position="right" />
    <Handle type="source" position="bottom" />
    <span>💍</span>
  </div>
</template>

<script setup lang="ts">
import { Handle } from '@vue-flow/core';
</script>

<style scoped>
.spouse-connector {
  background: transparent; border: none; width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center; font-size: 16px;
}
</style>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/PersonNode.vue frontend/src/components/SpouseConnector.vue
git commit -m "feat: add PersonNode and SpouseConnector VueFlow components"
```

---

## Task 14: FamilyTreeCanvas.vue

**Files:**
- Create: `frontend/src/components/FamilyTreeCanvas.vue`

- [ ] **Step 1: Create `frontend/src/components/FamilyTreeCanvas.vue`**

```vue
<template>
  <div class="canvas-wrap">
    <VueFlow
      :nodes="nodes"
      :edges="edges"
      :node-types="nodeTypes"
      fit-view-on-init
      :default-edge-options="{ animated: false }"
      @node-click="onNodeClick"
    >
      <Background pattern-color="#21262d" :gap="20" />
      <Controls />
      <MiniMap node-color="#161b22" mask-color="rgba(0,0,0,0.6)" />
    </VueFlow>

    <div v-if="loading" class="loading">Đang tải gia phả...</div>
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, markRaw } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import PersonNode from './PersonNode.vue';
import SpouseConnector from './SpouseConnector.vue';
import { treeApi } from '../api';

const emit = defineEmits<{ (e: 'selectPerson', id: string): void }>();

const nodes = ref<any[]>([]);
const edges = ref<any[]>([]);
const loading = ref(true);
const error = ref('');

const nodeTypes = {
  person: markRaw(PersonNode),
  spouseConnector: markRaw(SpouseConnector),
};

onMounted(async () => {
  try {
    const res = await treeApi.get();
    nodes.value = res.data.nodes;
    edges.value = res.data.edges;
  } catch {
    error.value = 'Không tải được dữ liệu gia phả.';
  } finally {
    loading.value = false;
  }
});

function onNodeClick({ node }: { node: any }) {
  if (node.type === 'person') emit('selectPerson', node.id);
}
</script>

<style scoped>
.canvas-wrap { width: 100%; height: 100vh; position: relative; }
.loading, .error {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: #161b22; padding: 20px 32px; border-radius: 8px; font-size: 1rem;
}
.error { color: #f85149; border: 1px solid #f85149; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/FamilyTreeCanvas.vue
git commit -m "feat: add FamilyTreeCanvas with VueFlow"
```

---

## Task 15: PersonDrawer.vue

**Files:**
- Create: `frontend/src/components/PersonDrawer.vue`

- [ ] **Step 1: Create `frontend/src/components/PersonDrawer.vue`**

```vue
<template>
  <Transition name="drawer">
    <div v-if="personId" class="drawer-overlay" @click.self="$emit('close')">
      <div class="drawer">
        <button class="close-btn" @click="$emit('close')">✕</button>

        <div v-if="loading" class="loading">Đang tải...</div>
        <template v-else-if="person">
          <div class="avatar-section">
            <img v-if="person.avatarUrl" :src="person.avatarUrl" class="avatar-img" />
            <div v-else class="avatar-placeholder">{{ person.gender === 'female' ? '👩' : '👨' }}</div>
            <h2>{{ person.fullName }}</h2>
            <span v-if="person.nickname" class="nickname">"{{ person.nickname }}"</span>
            <span class="gen-badge">Thế hệ {{ person.generation }}</span>
            <span v-if="!person.isAlive" class="deceased-badge">✝ Đã mất</span>
          </div>

          <div class="info-section">
            <InfoRow v-if="person.birthDate" icon="🎂" :value="formatDate(person.birthDate)" label="Ngày sinh" />
            <InfoRow v-if="person.deathDate" icon="✝" :value="formatDate(person.deathDate)" label="Ngày mất" />
            <InfoRow v-if="person.phone" icon="📞" :value="person.phone" label="Điện thoại" />
            <InfoRow v-if="person.address" icon="📍" :value="person.address" label="Địa chỉ" />
          </div>

          <div v-if="person.bio" class="bio-section">
            <h3>Tiểu sử</h3>
            <p>{{ person.bio }}</p>
          </div>

          <div v-if="relatives" class="relatives-section">
            <div v-if="relatives.spouses?.length">
              <h3>💍 Vợ / Chồng</h3>
              <button v-for="s in relatives.spouses" :key="s.id" class="rel-btn" @click="$emit('selectPerson', s.id)">
                {{ s.fullName }}
              </button>
            </div>
            <div v-if="relatives.parents?.length">
              <h3>👴 Cha / Mẹ</h3>
              <button v-for="p in relatives.parents" :key="p.id" class="rel-btn" @click="$emit('selectPerson', p.id)">
                {{ p.fullName }}
              </button>
            </div>
            <div v-if="relatives.children?.length">
              <h3>👶 Con cái</h3>
              <button v-for="c in relatives.children" :key="c.id" class="rel-btn" @click="$emit('selectPerson', c.id)">
                {{ c.fullName }}
              </button>
            </div>
          </div>

          <div v-if="isAdmin" class="admin-actions">
            <button class="btn-edit" @click="$emit('editPerson', person)">✏️ Sửa thông tin</button>
            <button class="btn-delete" @click="handleDelete">🗑️ Xóa</button>
          </div>
        </template>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { personsApi } from '../api';
import { useAuthStore } from '../stores/auth';

const props = defineProps<{ personId: string | null }>();
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'selectPerson', id: string): void;
  (e: 'editPerson', person: any): void;
  (e: 'deleted'): void;
}>();

const auth = useAuthStore();
const isAdmin = auth.isAdmin;
const person = ref<any>(null);
const relatives = ref<any>(null);
const loading = ref(false);

watch(() => props.personId, async (id) => {
  if (!id) return;
  loading.value = true;
  const [pRes, rRes] = await Promise.all([personsApi.get(id), personsApi.getRelatives(id)]);
  person.value = pRes.data;
  relatives.value = rRes.data;
  loading.value = false;
});

async function handleDelete() {
  if (!person.value) return;
  if (!confirm(`Xóa ${person.value.fullName}?`)) return;
  await personsApi.delete(person.value.id);
  emit('deleted');
  emit('close');
}

function formatDate(d: string) { return new Date(d).toLocaleDateString('vi-VN'); }
</script>

<script lang="ts">
// InfoRow helper component inline
import { defineComponent, h } from 'vue';
export const InfoRow = defineComponent({
  props: ['icon', 'value', 'label'],
  setup(props) {
    return () => h('div', { class: 'info-row' }, [
      h('span', { class: 'info-icon' }, props.icon),
      h('div', [h('div', { class: 'info-label' }, props.label), h('div', { class: 'info-value' }, props.value)]),
    ]);
  },
});
</script>

<style scoped>
.drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100; }
.drawer { position: fixed; right: 0; top: 0; height: 100vh; width: 380px; background: #161b22; border-left: 1px solid #30363d; overflow-y: auto; padding: 24px; }
.close-btn { position: absolute; top: 12px; right: 12px; background: none; border: none; color: #8b949e; font-size: 18px; cursor: pointer; }
.avatar-section { text-align: center; margin-bottom: 20px; padding-top: 16px; }
.avatar-img { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 10px; }
.avatar-placeholder { font-size: 64px; margin-bottom: 10px; }
h2 { font-size: 1.2rem; color: #e94560; }
.nickname { color: #8b949e; font-style: italic; display: block; }
.gen-badge { background: #0f3460; color: #58a6ff; border-radius: 10px; padding: 2px 10px; font-size: 11px; }
.deceased-badge { background: #21262d; color: #f85149; border-radius: 10px; padding: 2px 10px; font-size: 11px; margin-left: 6px; }
.info-section { margin: 16px 0; }
.info-row { display: flex; gap: 10px; margin-bottom: 10px; align-items: flex-start; }
.info-icon { font-size: 18px; }
.info-label { font-size: 10px; color: #8b949e; }
.info-value { font-size: 13px; }
.bio-section { background: #0d1117; border-radius: 8px; padding: 12px; margin: 16px 0; }
.bio-section p { font-size: 13px; color: #8b949e; line-height: 1.6; }
.relatives-section h3 { font-size: 12px; color: #8b949e; margin: 16px 0 6px; }
.rel-btn { background: #21262d; border: 1px solid #30363d; color: #58a6ff; padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; margin: 0 4px 4px 0; }
.admin-actions { margin-top: 24px; display: flex; gap: 10px; }
.btn-edit { flex: 1; padding: 10px; background: #21262d; border: 1px solid #30363d; color: #e6edf3; border-radius: 6px; cursor: pointer; }
.btn-delete { flex: 1; padding: 10px; background: #21262d; border: 1px solid #f85149; color: #f85149; border-radius: 6px; cursor: pointer; }
.drawer-enter-active, .drawer-leave-active { transition: transform 0.3s ease; }
.drawer-enter-from, .drawer-leave-to { transform: translateX(100%); }
.loading { text-align: center; padding: 40px; color: #8b949e; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/PersonDrawer.vue
git commit -m "feat: add PersonDrawer slide-in panel"
```

---

## Task 16: PersonForm.vue

**Files:**
- Create: `frontend/src/components/PersonForm.vue`

- [ ] **Step 1: Create `frontend/src/components/PersonForm.vue`**

```vue
<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <h2>{{ editPerson ? 'Sửa thông tin' : 'Thêm người mới' }}</h2>

      <form @submit.prevent="handleSubmit" class="form-grid">
        <div class="field">
          <label>Họ và tên *</label>
          <input v-model="form.fullName" required />
        </div>
        <div class="field">
          <label>Tên gọi</label>
          <input v-model="form.nickname" />
        </div>
        <div class="field">
          <label>Giới tính *</label>
          <select v-model="form.gender" required>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
          </select>
        </div>
        <div class="field">
          <label>Thế hệ *</label>
          <input v-model.number="form.generation" type="number" min="1" required />
        </div>
        <div class="field">
          <label>Ngày sinh</label>
          <input v-model="form.birthDate" type="date" />
        </div>
        <div class="field">
          <label>Ngày mất</label>
          <input v-model="form.deathDate" type="date" />
        </div>
        <div class="field">
          <label>Số điện thoại</label>
          <input v-model="form.phone" type="tel" />
        </div>
        <div class="field">
          <label>Địa chỉ</label>
          <input v-model="form.address" />
        </div>
        <div class="field full-width">
          <label>Tiểu sử / Ghi chú</label>
          <textarea v-model="form.bio" rows="3" />
        </div>

        <!-- Access grant section -->
        <div v-if="form.phone" class="field full-width access-grant">
          <label class="checkbox-label">
            <input type="checkbox" v-model="form.grantAccess" />
            Cấp quyền truy cập cho số điện thoại này
          </label>
          <div v-if="form.grantAccess" class="grant-options">
            <select v-model="form.grantRole">
              <option value="viewer">Viewer — chỉ xem</option>
              <option value="admin">Admin — thêm/sửa/xóa</option>
            </select>
            <input
              v-if="form.grantRole === 'admin'"
              v-model="form.grantPassword"
              type="password"
              placeholder="Mật khẩu cho admin *"
              :required="form.grantRole === 'admin'"
            />
          </div>
        </div>

        <p v-if="error" class="error full-width">{{ error }}</p>

        <div class="buttons full-width">
          <button type="button" @click="$emit('close')">Hủy</button>
          <button type="submit" :disabled="loading">{{ loading ? 'Đang lưu...' : 'Lưu' }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { personsApi } from '../api';

const props = defineProps<{ editPerson?: any | null }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved'): void }>();

const defaultForm = () => ({
  fullName: '', nickname: '', gender: 'male' as 'male' | 'female',
  birthDate: '', deathDate: '', phone: '', address: '', bio: '',
  generation: 1, grantAccess: false, grantRole: 'viewer' as 'viewer' | 'admin',
  grantPassword: '',
});

const form = ref(defaultForm());
const loading = ref(false);
const error = ref('');

watch(() => props.editPerson, (p) => {
  if (p) {
    form.value = {
      ...defaultForm(),
      fullName: p.fullName, nickname: p.nickname || '', gender: p.gender,
      birthDate: p.birthDate ? p.birthDate.slice(0, 10) : '',
      deathDate: p.deathDate ? p.deathDate.slice(0, 10) : '',
      phone: p.phone || '', address: p.address || '', bio: p.bio || '',
      generation: p.generation,
    };
  }
}, { immediate: true });

async function handleSubmit() {
  loading.value = true; error.value = '';
  try {
    const payload = {
      ...form.value,
      birthDate: form.value.birthDate || undefined,
      deathDate: form.value.deathDate || undefined,
      phone: form.value.phone || undefined,
      nickname: form.value.nickname || undefined,
      address: form.value.address || undefined,
      bio: form.value.bio || undefined,
      grantAccess: form.value.grantAccess || undefined,
      grantRole: form.value.grantAccess ? form.value.grantRole : undefined,
      grantPassword: form.value.grantAccess && form.value.grantRole === 'admin' ? form.value.grantPassword : undefined,
    };
    if (props.editPerson) {
      await personsApi.update(props.editPerson.id, payload);
    } else {
      await personsApi.create(payload);
    }
    emit('saved');
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Lỗi khi lưu.';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 200; display: flex; align-items: center; justify-content: center; }
.modal { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 28px; width: 560px; max-height: 90vh; overflow-y: auto; }
h2 { margin-bottom: 20px; font-size: 1.1rem; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.full-width { grid-column: 1 / -1; }
label { font-size: 12px; color: #8b949e; }
input, select, textarea { background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 8px 10px; color: #e6edf3; font-size: 13px; width: 100%; }
input:focus, select:focus, textarea:focus { outline: none; border-color: #58a6ff; }
textarea { resize: vertical; }
.access-grant { background: rgba(88,166,255,0.06); border: 1px solid #30363d; border-radius: 8px; padding: 12px; }
.checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #e6edf3; cursor: pointer; }
.grant-options { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.buttons { display: flex; gap: 10px; justify-content: flex-end; }
.buttons button { padding: 10px 20px; border-radius: 6px; cursor: pointer; border: 1px solid #30363d; }
.buttons button[type=button] { background: #21262d; color: #e6edf3; }
.buttons button[type=submit] { background: #238636; border-color: #238636; color: #fff; }
.error { color: #f85149; font-size: 12px; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/PersonForm.vue
git commit -m "feat: add PersonForm modal with access grant"
```

---

## Task 17: TreePage.vue

**Files:**
- Create: `frontend/src/pages/TreePage.vue`

- [ ] **Step 1: Create `frontend/src/pages/TreePage.vue`**

```vue
<template>
  <div class="tree-page">
    <!-- Toolbar -->
    <div class="toolbar">
      <span class="app-title">🌳 Gia Phả Nhà Lâm</span>
      <div class="toolbar-actions">
        <button v-if="isAdmin" class="btn-add" @click="showForm = true">+ Thêm người</button>
        <button class="btn-logout" @click="handleLogout">Đăng xuất</button>
      </div>
    </div>

    <!-- Tree canvas -->
    <FamilyTreeCanvas
      ref="canvas"
      @select-person="selectedPersonId = $event"
    />

    <!-- Detail drawer -->
    <PersonDrawer
      :person-id="selectedPersonId"
      @close="selectedPersonId = null"
      @select-person="selectedPersonId = $event"
      @edit-person="openEdit"
      @deleted="refreshTree"
    />

    <!-- Add/edit form -->
    <PersonForm
      v-if="showForm"
      :edit-person="editingPerson"
      @close="closeForm"
      @saved="onSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import FamilyTreeCanvas from '../components/FamilyTreeCanvas.vue';
import PersonDrawer from '../components/PersonDrawer.vue';
import PersonForm from '../components/PersonForm.vue';

const auth = useAuthStore();
const router = useRouter();
const isAdmin = auth.isAdmin;

const selectedPersonId = ref<string | null>(null);
const showForm = ref(false);
const editingPerson = ref<any>(null);
const canvas = ref<InstanceType<typeof FamilyTreeCanvas>>();

function openEdit(person: any) {
  editingPerson.value = person;
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingPerson.value = null;
}

async function onSaved() {
  closeForm();
  await refreshTree();
}

async function refreshTree() {
  // Re-mount canvas to reload tree data
  canvas.value?.$forceUpdate();
  // For full reload, use a key trick:
  treeKey.value++;
}

const treeKey = ref(0);

function handleLogout() {
  auth.logout();
  router.push('/login');
}
</script>

<style scoped>
.tree-page { width: 100vw; height: 100vh; display: flex; flex-direction: column; background: #0d1117; }
.toolbar { display: flex; align-items: center; justify-content: space-between; padding: 10px 20px; background: #161b22; border-bottom: 1px solid #30363d; z-index: 10; }
.app-title { font-size: 1rem; font-weight: bold; }
.toolbar-actions { display: flex; gap: 10px; }
.btn-add { background: #238636; color: #fff; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer; }
.btn-logout { background: #21262d; color: #8b949e; border: 1px solid #30363d; border-radius: 6px; padding: 8px 16px; cursor: pointer; }
</style>
```

- [ ] **Step 2: Update FamilyTreeCanvas to accept a key-based refresh**

Add `:key="treeKey"` to `<FamilyTreeCanvas>` in TreePage:

```vue
<FamilyTreeCanvas
  :key="treeKey"
  @select-person="selectedPersonId = $event"
/>
```

- [ ] **Step 3: Test full flow in browser**

```bash
# Backend terminal
cd backend && npm run dev

# Frontend terminal  
cd frontend && npm run dev
```

Open `http://localhost:5173`:
1. Login as admin (0972737308 / familytree2024)
2. Tree loads with all Lâm family nodes
3. Click a node → PersonDrawer opens
4. Click "Thêm người" → PersonForm opens, fill in, save → tree refreshes
5. Click a node → "Sửa thông tin" → edit and save

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/TreePage.vue
git commit -m "feat: add TreePage assembling canvas, drawer, and form"
```

---

## Task 18: Production Dockerfile

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Create `Dockerfile` at repo root**

```dockerfile
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Build backend
FROM node:20-alpine AS backend-build
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .
RUN npx prisma generate
RUN npx tsc

# Stage 3: Production
FROM node:20-alpine
WORKDIR /app
COPY --from=backend-build /app/node_modules ./node_modules
COPY --from=backend-build /app/dist ./dist
COPY --from=backend-build /app/prisma ./prisma
COPY --from=frontend-build /app/frontend/dist ./public
RUN mkdir -p /data/uploads
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
```

- [ ] **Step 2: Build and test locally**

```bash
docker build -t family-tree .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/family_tree" \
  -e JWT_SECRET="dev-secret" \
  -e UPLOAD_DIR="/data/uploads" \
  family-tree
```

Open `http://localhost:3000` — should show login page.

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "feat: add multi-stage production Dockerfile"
```

---

## Task 19: fly.io deployment

**Files:**
- Create: `fly.toml`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Install flyctl and login**

```bash
# Install flyctl (run in terminal, not in Docker)
# Windows: winget install flyctl
# Or: iwr https://fly.io/install.ps1 -useb | iex

flyctl auth login
```

- [ ] **Step 2: Create fly.io app and postgres**

```bash
flyctl apps create justinlam-familytree
flyctl postgres create --name justinlam-familytree-db --region sin
flyctl postgres attach justinlam-familytree-db --app justinlam-familytree
flyctl volumes create uploads --app justinlam-familytree --region sin --size 1
```

- [ ] **Step 3: Create `fly.toml`**

```toml
app = "justinlam-familytree"
primary_region = "sin"

[build]

[env]
  PORT = "3000"
  NODE_ENV = "production"
  UPLOAD_DIR = "/data/uploads"

[mounts]
  source = "uploads"
  destination = "/data/uploads"

[[services]]
  internal_port = 3000
  protocol = "tcp"
  auto_stop_machines = true
  auto_start_machines = true

  [[services.ports]]
    handlers = ["http"]
    port = 80
    force_https = true

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

  [services.concurrency]
    type = "connections"
    hard_limit = 25
    soft_limit = 20
```

- [ ] **Step 4: Set JWT_SECRET on fly.io**

```bash
flyctl secrets set JWT_SECRET="$(openssl rand -hex 32)" --app justinlam-familytree
flyctl secrets set JWT_EXPIRES_IN="30d" --app justinlam-familytree
```

- [ ] **Step 5: Replace `.github/workflows/deploy.yml`**

```yaml
name: Deploy to fly.io

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Deploy
        run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

- [ ] **Step 6: Add FLY_API_TOKEN to GitHub secrets**

```bash
flyctl tokens create deploy --name github-actions
```

Copy the token → GitHub repo → Settings → Secrets → New secret: `FLY_API_TOKEN`.

- [ ] **Step 7: Deploy**

```bash
git add fly.toml .github/workflows/deploy.yml
git commit -m "feat: add fly.io config and GitHub Actions deploy"
git push origin main
```

Expected: GitHub Actions runs, image builds, deploys to `https://justinlam-familytree.fly.dev`.

- [ ] **Step 8: Run seed on production**

```bash
flyctl ssh console --app justinlam-familytree -C "node -e \"require('./dist/server'); setTimeout(() => process.exit(), 1000)\" || npx ts-node prisma/seed.ts"
```

Or simpler — add a one-time seed endpoint or run seed via `flyctl ssh console`:
```bash
flyctl ssh console --app justinlam-familytree
# Inside container:
cd /app && node -e "
const { PrismaClient } = require('@prisma/client');
// ... paste seed logic or run pre-built seed script
"
```

Best approach: add `"db:seed:prod": "node dist/seed.js"` after compiling seed.ts separately.

Add to `backend/tsconfig.json` include:
```json
"include": ["src/**/*", "prisma/seed.ts"]
```

Then:
```bash
flyctl ssh console --app justinlam-familytree -C "node dist/seed.js"
```

- [ ] **Step 9: Commit and verify**

```bash
git add backend/tsconfig.json
git commit -m "feat: include seed.ts in TypeScript build"
git push origin main
```

Open `https://justinlam-familytree.fly.dev` — login, tree loads. ✅

---

## Self-Review Checklist

- [x] Auth: viewer phone-only, admin phone+password (Tasks 4, 12)
- [x] PersonForm access grant with bcrypt in same transaction (Tasks 5, 16)
- [x] SpouseConnector virtual nodes in dagre layout (Task 8)
- [x] Rich card node type C with expand button (Task 13)
- [x] PersonDrawer with relatives + admin actions (Task 15)
- [x] Seed data: full Lâm family 4 generations (Task 9)
- [x] Docker multi-stage single image (Task 18)
- [x] fly.io deployment Singapore region, persistent volume for uploads (Task 19)
- [x] GitHub Actions CI/CD on push to main (Task 19)
- [x] `isAlive` auto-set when `deathDate` provided (Task 5)
