# Relationship Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gắn ảnh/video/PDF vào mối quan hệ (vợ chồng, cha mẹ-con cái) với moderation workflow, truy cập từ PersonDrawer và SpouseConnector.

**Architecture:** Mở rộng bảng `Media` — `personId` nullable, thêm `relationshipId` nullable. Tái dụng Cloudinary service, upload modal, viewer, admin queue. Thêm 3 route mới vào relationships.ts, cập nhật media.ts sign endpoint, thêm RelationshipMediaPage.vue và entry points từ PersonDrawer + FamilyTreeCanvas.

**Tech Stack:** Node.js + Prisma + PostgreSQL + Express, Cloudinary, Vue 3, Vue Router, Jest.

---

## File Map

**Backend — Modify:**
- `backend/prisma/schema.prisma` — Media nullable personId + relationshipId field
- `backend/src/routes/relationships.ts` — 3 route mới: GET /:id, GET /:id/media, POST /:id/media
- `backend/src/routes/media.ts` — sign endpoint nhận relationshipId; admin queue include relationship
- `backend/src/routes/persons.ts` — fix children thiếu relationshipId

**Backend — Create:**
- `backend/src/services/tests/relationshipMedia.test.ts` — tests cho sign validation

**Frontend — Modify:**
- `frontend/src/api/index.ts` — mediaApi + relationshipsApi
- `frontend/src/router/index.ts` — route /relationships/:id/media
- `frontend/src/components/PersonDrawer.vue` — thêm 🖼 buttons
- `frontend/src/components/FamilyTreeCanvas.vue` — spouseConnector click
- `frontend/src/pages/AdminMediaPage.vue` — hiện context relationship

**Frontend — Create:**
- `frontend/src/pages/RelationshipMediaPage.vue`

---

### Task 1: DB Schema — Media nullable + relationshipId

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Sửa Media model trong schema.prisma**

Thay toàn bộ block `model Media` thành:

```prisma
model Media {
  id             String            @id @default(uuid())
  personId       String?
  person         Person?           @relation(fields: [personId], references: [id], onDelete: Cascade)
  relationshipId String?
  relationship   Relationship?     @relation(fields: [relationshipId], references: [id], onDelete: Cascade)
  cloudinaryId   String            @unique
  url            String
  resourceType   MediaResourceType
  format         String
  bytes          Int
  caption        String?
  status         MediaStatus       @default(PENDING)
  uploadedBy     String
  createdAt      DateTime          @default(now())

  @@index([personId])
  @@index([relationshipId])
  @@index([status])
  @@map("media")
}
```

Thêm `media Media[]` vào model `Relationship` (sau dòng `divorcedDate`):

```prisma
model Relationship {
  id           String           @id @default(uuid())
  personAId    String
  personBId    String
  type         RelationshipType
  marriedDate  DateTime?
  divorcedDate DateTime?
  media        Media[]

  personA Person @relation("PersonA", fields: [personAId], references: [id], onDelete: Cascade)
  personB Person @relation("PersonB", fields: [personBId], references: [id], onDelete: Cascade)

  @@index([personAId])
  @@index([personBId])
  @@index([type])
  @@map("relationships")
}
```

- [ ] **Step 2: Chạy migration**

```bash
cd backend
npx prisma migrate dev --name add_relationship_media
```

Expected output: `✔ Generated Prisma Client`

- [ ] **Step 3: Verify Prisma client generated**

```bash
npx prisma generate
```

Expected: no errors, `Generated Prisma Client` message.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add relationshipId to Media, make personId nullable"
```

---

### Task 2: Backend — relationships.ts new routes

**Files:**
- Modify: `backend/src/routes/relationships.ts`

- [ ] **Step 1: Thêm 3 route vào relationships.ts**

Thay toàn bộ file `backend/src/routes/relationships.ts`:

```typescript
import { Router } from 'express';
import { requireEditor, requireViewer, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { logAudit } from '../services/auditService';

const router = Router();

// GET /:id — fetch single relationship with person names
router.get('/:id', requireViewer, async (req, res) => {
  try {
    const rel = await prisma.relationship.findUnique({
      where: { id: req.params.id },
      include: {
        personA: { select: { id: true, fullName: true } },
        personB: { select: { id: true, fullName: true } },
      },
    });
    if (!rel) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(rel);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /:id/media — list media for a relationship
router.get('/:id/media', requireViewer, async (req: AuthRequest, res) => {
  try {
    const rel = await prisma.relationship.findUnique({ where: { id: req.params.id } });
    if (!rel) { res.status(404).json({ error: 'Not found' }); return; }

    const isPrivileged = req.user!.role === 'admin' || req.user!.role === 'editor';
    const where: Record<string, unknown> = { relationshipId: req.params.id };
    if (!isPrivileged) where.status = 'APPROVED';

    const data = await prisma.media.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
    res.json({ data });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /:id/media — create media record for a relationship
router.post('/:id/media', requireViewer, async (req: AuthRequest, res) => {
  try {
    const rel = await prisma.relationship.findUnique({ where: { id: req.params.id } });
    if (!rel) { res.status(404).json({ error: 'Not found' }); return; }

    const { cloudinaryId, url, resourceType, format, bytes, caption } = req.body;
    const media = await prisma.media.create({
      data: {
        relationshipId: req.params.id,
        cloudinaryId,
        url,
        resourceType,
        format,
        bytes,
        caption: caption ?? null,
        status: 'PENDING',
        uploadedBy: req.user!.phone,
      },
    });
    res.status(201).json(media);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/', requireEditor, async (req: AuthRequest, res) => {
  try {
    const rel = await prisma.relationship.create({
      data: req.body,
      include: {
        personA: { select: { fullName: true } },
        personB: { select: { fullName: true } },
      },
    });
    const label = `${rel.personA.fullName} ↔ ${rel.personB.fullName} (${rel.type})`;
    await logAudit({
      actorPhone: req.user!.phone,
      action: 'CREATE',
      entityType: 'RELATIONSHIP',
      entityId: rel.id,
      entityLabel: label,
      after: rel,
    });
    res.status(201).json(rel);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', requireEditor, async (req: AuthRequest, res) => {
  try {
    const before = await prisma.relationship.findUnique({
      where: { id: req.params.id },
      include: {
        personA: { select: { fullName: true } },
        personB: { select: { fullName: true } },
      },
    });
    if (!before) { res.status(404).json({ error: 'Not found' }); return; }
    await prisma.relationship.delete({ where: { id: req.params.id } });
    const label = `${before.personA.fullName} ↔ ${before.personB.fullName} (${before.type})`;
    await logAudit({
      actorPhone: req.user!.phone,
      action: 'DELETE',
      entityType: 'RELATIONSHIP',
      entityId: req.params.id,
      entityLabel: label,
      before,
    });
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export { router as relationshipsRouter };
```

- [ ] **Step 2: Build check**

```bash
cd backend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/relationships.ts
git commit -m "feat: add GET/:id, GET/:id/media, POST/:id/media to relationships"
```

---

### Task 3: Backend — media.ts sign + admin queue + persons.ts children fix

**Files:**
- Modify: `backend/src/routes/media.ts`
- Modify: `backend/src/routes/persons.ts`
- Create: `backend/src/services/tests/signValidation.test.ts`

- [ ] **Step 1: Viết failing test cho sign validation**

Tạo `backend/src/services/tests/signValidation.test.ts`:

```typescript
import { validateSignParams } from '../../routes/mediaSignValidation';

describe('validateSignParams', () => {
  it('returns error when neither personId nor relationshipId provided', () => {
    expect(validateSignParams({ resourceType: 'image' })).toBe(
      'Exactly one of personId or relationshipId is required'
    );
  });

  it('returns error when both personId and relationshipId provided', () => {
    expect(validateSignParams({ resourceType: 'image', personId: 'a', relationshipId: 'b' })).toBe(
      'Exactly one of personId or relationshipId is required'
    );
  });

  it('returns error when resourceType missing', () => {
    expect(validateSignParams({ personId: 'a' })).toBe('resourceType is required');
  });

  it('returns null when personId provided', () => {
    expect(validateSignParams({ resourceType: 'image', personId: 'abc' })).toBeNull();
  });

  it('returns null when relationshipId provided', () => {
    expect(validateSignParams({ resourceType: 'video', relationshipId: 'xyz' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd backend
npx jest signValidation --no-coverage
```

Expected: FAIL — `Cannot find module '../../routes/mediaSignValidation'`

- [ ] **Step 3: Tạo helper module mediaSignValidation.ts**

Tạo `backend/src/routes/mediaSignValidation.ts`:

```typescript
export function validateSignParams(params: {
  resourceType?: string;
  personId?: string;
  relationshipId?: string;
}): string | null {
  if (!params.resourceType) return 'resourceType is required';
  const hasPersonId = !!params.personId;
  const hasRelationshipId = !!params.relationshipId;
  if (hasPersonId === hasRelationshipId) {
    return 'Exactly one of personId or relationshipId is required';
  }
  return null;
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npx jest signValidation --no-coverage
```

Expected: PASS — 5 tests passing.

- [ ] **Step 5: Cập nhật media.ts — sign endpoint + admin queue**

Thay toàn bộ file `backend/src/routes/media.ts`:

```typescript
import { Router } from 'express';
import { requireViewer, requireAdmin, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { generateSignature, deleteMedia } from '../services/cloudinaryService';
import { validateSignParams } from './mediaSignValidation';

const router = Router();

// GET /sign — all authenticated users
router.get('/sign', requireViewer, (req: AuthRequest, res) => {
  const { resourceType, personId, relationshipId } = req.query as {
    resourceType?: string;
    personId?: string;
    relationshipId?: string;
  };

  const err = validateSignParams({ resourceType, personId, relationshipId });
  if (err) { res.status(400).json({ error: err }); return; }

  try {
    const folder = personId
      ? `family-tree/persons/${personId}`
      : `family-tree/relationships/${relationshipId}`;
    const result = generateSignature({ folder, resourceType: resourceType! });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET / — admin moderation queue
router.get('/', requireAdmin, async (req, res) => {
  const rawStatus = req.query.status as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;

  const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'];
  if (rawStatus && !validStatuses.includes(rawStatus)) {
    res.status(400).json({ error: 'Invalid status value' }); return;
  }

  const where: Record<string, unknown> = {};
  if (rawStatus && rawStatus !== 'ALL') where.status = rawStatus;

  const [data, total] = await Promise.all([
    prisma.media.findMany({
      where,
      include: {
        person: { select: { fullName: true } },
        relationship: {
          select: {
            personA: { select: { fullName: true } },
            personB: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.media.count({ where }),
  ]);

  res.json({ data, total, page, limit });
});

// PATCH /:id/status — admin
router.patch('/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body as { status: string };
  if (status !== 'APPROVED' && status !== 'REJECTED') {
    res.status(400).json({ error: 'status must be APPROVED or REJECTED' });
    return;
  }
  try {
    const media = await prisma.media.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(media);
  } catch (e: any) {
    if (e.code === 'P2025') { res.status(404).json({ error: 'Not found' }); return; }
    res.status(500).json({ error: e.message });
  }
});

// DELETE /:id — admin or original uploader
router.delete('/:id', requireViewer, async (req: AuthRequest, res) => {
  try {
    const media = await prisma.media.findUnique({ where: { id: req.params.id } });
    if (!media) { res.status(404).json({ error: 'Not found' }); return; }

    if (req.user!.role !== 'admin' && media.uploadedBy !== req.user!.phone) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }

    await deleteMedia(media.cloudinaryId, media.resourceType);
    await prisma.media.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export { router as mediaRouter };
```

- [ ] **Step 6: Fix children relationshipId trong persons.ts**

Trong `backend/src/routes/persons.ts`, tìm dòng:
```typescript
  const children = asA.filter(r => r.type === 'parent_child').map(r => r.personB);
```

Thay bằng:
```typescript
  const children = asA.filter(r => r.type === 'parent_child').map(r => ({ ...r.personB, relationshipId: r.id }));
```

- [ ] **Step 7: Build check**

```bash
cd backend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Run all backend tests**

```bash
npx jest --no-coverage
```

Expected: all tests pass including the 5 new signValidation tests.

- [ ] **Step 9: Commit**

```bash
git add backend/src/routes/media.ts backend/src/routes/mediaSignValidation.ts backend/src/routes/persons.ts backend/src/services/tests/signValidation.test.ts
git commit -m "feat: update media sign endpoint for relationships, fix children relationshipId"
```

---

### Task 4: Frontend — mediaApi + relationshipsApi + router

**Files:**
- Modify: `frontend/src/api/index.ts`
- Modify: `frontend/src/router/index.ts`

- [ ] **Step 1: Cập nhật frontend/src/api/index.ts**

Thay toàn bộ file:

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
  getAccess: (id: string) => api.get(`/persons/${id}/access`),
  uploadAvatar: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('avatar', file);
    return api.post(`/persons/${id}/avatar`, fd);
  },
};

export const relationshipsApi = {
  create: (data: unknown) => api.post('/relationships', data),
  delete: (id: string) => api.delete(`/relationships/${id}`),
  get: (id: string) => api.get(`/relationships/${id}`),
};

export const treeApi = {
  get: () => api.get('/tree'),
};

export const statsApi = {
  ping: (newVisit: boolean) => api.post('/stats/ping', { newVisit }),
  get: () => api.get('/stats'),
};

export const auditApi = {
  list: (params: {
    action?: string;
    entityType?: string;
    search?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) => api.get('/audit', { params }),
};

interface UploadData {
  cloudinaryId: string;
  url: string;
  resourceType: string;
  format: string;
  bytes: number;
  caption?: string;
}

export const mediaApi = {
  sign: (params: { resourceType: string; personId?: string; relationshipId?: string }) =>
    api.get('/media/sign', { params }),

  confirmUpload: (personId: string, data: UploadData) =>
    api.post(`/persons/${personId}/media`, data),

  confirmRelationshipUpload: (relationshipId: string, data: UploadData) =>
    api.post(`/relationships/${relationshipId}/media`, data),

  listByPerson: (personId: string) =>
    api.get(`/persons/${personId}/media`),

  listByRelationship: (relationshipId: string) =>
    api.get(`/relationships/${relationshipId}/media`),

  updateStatus: (mediaId: string, status: 'APPROVED' | 'REJECTED') =>
    api.patch(`/media/${mediaId}/status`, { status }),

  delete: (mediaId: string) =>
    api.delete(`/media/${mediaId}`),

  adminQueue: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/media', { params }),
};
```

- [ ] **Step 2: Thêm route vào frontend/src/router/index.ts**

Tìm đoạn:
```typescript
    {
      path: '/admin/media',
```

Thêm route mới TRƯỚC đoạn đó:
```typescript
    {
      path: '/relationships/:id/media',
      component: () => import('../pages/RelationshipMediaPage.vue'),
      meta: { requiresAuth: true },
    },
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/index.ts frontend/src/router/index.ts
git commit -m "feat: add relationshipsApi.get, mediaApi relationship methods, router route"
```

---

### Task 5: Frontend — RelationshipMediaPage.vue

**Files:**
- Create: `frontend/src/pages/RelationshipMediaPage.vue`

- [ ] **Step 1: Tạo RelationshipMediaPage.vue**

Tạo `frontend/src/pages/RelationshipMediaPage.vue`:

```vue
<template>
  <div class="media-page">
    <div class="header">
      <router-link to="/" class="back-link">← Về trang chủ</router-link>
      <h1 v-if="relInfo">
        🖼 {{ relInfo.personA.fullName }} ↔ {{ relInfo.personB.fullName }}
        <span class="rel-type">{{ relInfo.type === 'spouse' ? '💍' : '👨‍👩‍👧' }}</span>
      </h1>
      <h1 v-else>🖼 Đang tải...</h1>
      <button v-if="auth.token" class="btn-add" @click="showUpload = true">+ Thêm media</button>
    </div>

    <div v-if="loading" class="loading">Đang tải...</div>
    <div v-else-if="mediaList.length === 0" class="empty">Chưa có media nào.</div>

    <div v-else class="grid">
      <div
        v-for="item in mediaList"
        :key="item.id"
        class="grid-item"
        :class="{ pending: item.status === 'PENDING', rejected: item.status === 'REJECTED' }"
      >
        <div class="thumb-wrap" @click="openViewer(item)">
          <img v-if="item.resourceType !== 'RAW'" :src="thumbUrl(item)" :alt="item.caption || ''" class="thumb" />
          <div v-else class="pdf-thumb">📄</div>
          <div v-if="item.status === 'PENDING'" class="status-badge pending-badge">Chờ duyệt</div>
          <div v-if="item.status === 'REJECTED'" class="status-badge rejected-badge">Đã từ chối</div>
        </div>

        <div v-if="isPrivileged && item.status === 'PENDING'" class="mod-actions">
          <button class="btn-approve" @click.stop="moderateItem(item.id, 'APPROVED')">✓ Duyệt</button>
          <button class="btn-reject" @click.stop="moderateItem(item.id, 'REJECTED')">✗ Từ chối</button>
        </div>
      </div>
    </div>

    <MediaUploadModal
      v-if="showUpload"
      :personId="''"
      :relationshipId="relationshipId"
      @close="showUpload = false"
      @uploaded="onUploaded"
    />

    <MediaViewer
      v-if="viewerMedia"
      :media="viewerMedia"
      @close="viewerMedia = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '../stores/auth';
import { mediaApi, relationshipsApi } from '../api';
import MediaUploadModal from '../components/MediaUploadModal.vue';
import MediaViewer from '../components/MediaViewer.vue';

const route = useRoute();
const router = useRouter();
const relationshipId = route.params.id as string;

const auth = useAuthStore();
const { isAdmin, isEditor } = storeToRefs(auth);
const isPrivileged = computed(() => isAdmin.value || isEditor.value);

const relInfo = ref<any>(null);
const mediaList = ref<any[]>([]);
const loading = ref(true);
const showUpload = ref(false);
const viewerMedia = ref<any>(null);

onMounted(async () => {
  try {
    const [relRes, mediaRes] = await Promise.all([
      relationshipsApi.get(relationshipId),
      mediaApi.listByRelationship(relationshipId),
    ]);
    relInfo.value = relRes.data;
    mediaList.value = mediaRes.data.data;
  } catch {
    router.push('/');
  } finally {
    loading.value = false;
  }
});

function thumbUrl(item: any): string {
  if (item.resourceType === 'IMAGE') {
    return item.url.replace('/upload/', '/upload/w_300,h_300,c_fill,f_auto/');
  }
  return item.url
    .replace('/upload/', '/upload/w_300,h_300,c_fill,so_auto,f_jpg/')
    .replace(/\.[^.]+$/, '.jpg');
}

function openViewer(item: any) {
  viewerMedia.value = item;
}

async function moderateItem(mediaId: string, status: 'APPROVED' | 'REJECTED') {
  await mediaApi.updateStatus(mediaId, status);
  const item = mediaList.value.find((m: any) => m.id === mediaId);
  if (item) item.status = status;
}

async function onUploaded() {
  showUpload.value = false;
  const res = await mediaApi.listByRelationship(relationshipId);
  mediaList.value = res.data.data;
}
</script>

<style scoped>
.media-page { max-width: 960px; margin: 0 auto; padding: 24px 16px; }
.header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
.back-link { color: #0969da; text-decoration: none; font-size: 14px; }
.back-link:hover { text-decoration: underline; }
h1 { flex: 1; font-size: 1.3rem; color: #24292f; margin: 0; }
.rel-type { font-size: 1rem; margin-left: 6px; }
.btn-add { padding: 7px 16px; background: #0969da; color: #fff; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; }
.btn-add:hover { background: #0860ca; }
.loading, .empty { text-align: center; color: #57606a; padding: 48px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.grid-item { border-radius: 8px; overflow: hidden; border: 1px solid #d0d7de; background: #f6f8fa; }
.grid-item.pending { border-color: #d4a72c; }
.grid-item.rejected { opacity: 0.55; }
.thumb-wrap { position: relative; cursor: pointer; aspect-ratio: 1; overflow: hidden; }
.thumb { width: 100%; height: 100%; object-fit: cover; display: block; }
.thumb-wrap:hover .thumb { opacity: 0.85; }
.pdf-thumb { width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 48px; cursor: pointer; }
.status-badge { position: absolute; bottom: 6px; left: 6px; font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 10px; }
.pending-badge { background: #fff8c5; color: #9a6700; }
.rejected-badge { background: #ffebe9; color: #cf222e; }
.mod-actions { display: flex; gap: 4px; padding: 6px; background: #fff8c5; }
.btn-approve { flex: 1; background: #2da44e; color: #fff; border: none; border-radius: 4px; padding: 4px; font-size: 11px; cursor: pointer; }
.btn-approve:hover { background: #2c974b; }
.btn-reject { flex: 1; background: #cf222e; color: #fff; border: none; border-radius: 4px; padding: 4px; font-size: 11px; cursor: pointer; }
.btn-reject:hover { background: #a40e26; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/RelationshipMediaPage.vue
git commit -m "feat: add RelationshipMediaPage.vue"
```

---

### Task 6: Frontend — MediaUploadModal nhận relationshipId

**Files:**
- Modify: `frontend/src/components/MediaUploadModal.vue`

`RelationshipMediaPage` truyền `personId=""` và `relationshipId` vào `MediaUploadModal`. Modal cần dùng `confirmRelationshipUpload` khi `relationshipId` có giá trị.

- [ ] **Step 1: Cập nhật props và upload logic trong MediaUploadModal.vue**

Tìm dòng:
```typescript
const props = defineProps<{ personId: string }>();
```

Thay bằng:
```typescript
const props = defineProps<{ personId?: string; relationshipId?: string }>();
```

Tìm hàm `upload()`, tìm đoạn `Step 3: Register the upload with our backend`:
```typescript
    try {
      await mediaApi.confirmUpload(props.personId, {
```

Thay bằng:
```typescript
    try {
      const confirmFn = props.relationshipId
        ? (data: any) => mediaApi.confirmRelationshipUpload(props.relationshipId!, data)
        : (data: any) => mediaApi.confirmUpload(props.personId!, data);
      await confirmFn({
```

Và đóng dấu ngoặc `});` ngay sau `caption: caption.value || undefined,` giữ nguyên.

- [ ] **Step 2: Cập nhật sign call trong MediaUploadModal.vue**

Tìm đoạn:
```typescript
    const signRes = await mediaApi.sign({ resourceType, personId: props.personId });
```

Thay bằng:
```typescript
    const signParams = props.relationshipId
      ? { resourceType, relationshipId: props.relationshipId }
      : { resourceType, personId: props.personId! };
    const signRes = await mediaApi.sign(signParams);
```

- [ ] **Step 3: Build check**

```bash
cd frontend
npx vue-tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/MediaUploadModal.vue
git commit -m "feat: MediaUploadModal supports relationshipId for relationship media upload"
```

---

### Task 7: Frontend — PersonDrawer.vue thêm 🖼 buttons

**Files:**
- Modify: `frontend/src/components/PersonDrawer.vue`

- [ ] **Step 1: Cập nhật relatives section trong PersonDrawer.vue**

Tìm đoạn:
```html
          <div v-if="relatives" class="relatives-section">
            <div v-if="relatives.spouses?.length">
              <h3>💍 Vợ / Chồng</h3>
              <button v-for="s in relatives.spouses" :key="s.id" class="rel-btn" @click="$emit('selectPerson', s.id)">{{ s.fullName }}</button>
            </div>
            <div v-if="relatives.parents?.length">
              <h3>👴 Cha / Mẹ</h3>
              <button v-for="p in relatives.parents" :key="p.id" class="rel-btn" @click="$emit('selectPerson', p.id)">{{ p.fullName }}</button>
            </div>
            <div v-if="relatives.children?.length">
              <h3>👶 Con cái ({{ relatives.children.length }})</h3>
              <button v-for="c in relatives.children" :key="c.id" class="rel-btn" @click="$emit('selectPerson', c.id)">{{ c.fullName }}</button>
            </div>
          </div>
```

Thay bằng:
```html
          <div v-if="relatives" class="relatives-section">
            <div v-if="relatives.spouses?.length">
              <h3>💍 Vợ / Chồng</h3>
              <div v-for="s in relatives.spouses" :key="s.id" class="rel-row">
                <button class="rel-btn" @click="$emit('selectPerson', s.id)">{{ s.fullName }}</button>
                <router-link :to="`/relationships/${s.relationshipId}/media`" class="rel-media-btn" title="Xem ảnh quan hệ">🖼</router-link>
              </div>
            </div>
            <div v-if="relatives.parents?.length">
              <h3>👴 Cha / Mẹ</h3>
              <div v-for="p in relatives.parents" :key="p.id" class="rel-row">
                <button class="rel-btn" @click="$emit('selectPerson', p.id)">{{ p.fullName }}</button>
                <router-link :to="`/relationships/${p.relationshipId}/media`" class="rel-media-btn" title="Xem ảnh quan hệ">🖼</router-link>
              </div>
            </div>
            <div v-if="relatives.children?.length">
              <h3>👶 Con cái ({{ relatives.children.length }})</h3>
              <div v-for="c in relatives.children" :key="c.id" class="rel-row">
                <button class="rel-btn" @click="$emit('selectPerson', c.id)">{{ c.fullName }}</button>
                <router-link :to="`/relationships/${c.relationshipId}/media`" class="rel-media-btn" title="Xem ảnh quan hệ">🖼</router-link>
              </div>
            </div>
          </div>
```

- [ ] **Step 2: Thêm styles cho rel-row và rel-media-btn trong PersonDrawer.vue**

Tìm dòng CSS:
```css
.rel-btn { background: #f6f8fa; border: 1px solid #d0d7de; color: #0969da; padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; margin: 0 4px 4px 0; }
.rel-btn:hover { background: #ddf4ff; border-color: #54aeff; }
```

Thêm sau đó:
```css
.rel-row { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
.rel-row .rel-btn { margin: 0; flex: 1; }
.rel-media-btn { font-size: 14px; text-decoration: none; padding: 2px 6px; border-radius: 4px; background: #f6f8fa; border: 1px solid #d0d7de; cursor: pointer; flex-shrink: 0; }
.rel-media-btn:hover { background: #ddf4ff; border-color: #54aeff; }
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/PersonDrawer.vue
git commit -m "feat: add media link buttons next to relatives in PersonDrawer"
```

---

### Task 8: Frontend — FamilyTreeCanvas click + AdminMediaPage context

**Files:**
- Modify: `frontend/src/components/FamilyTreeCanvas.vue`
- Modify: `frontend/src/pages/AdminMediaPage.vue`

- [ ] **Step 1: Thêm router vào FamilyTreeCanvas.vue và xử lý spouseConnector click**

Tìm dòng import trong `frontend/src/components/FamilyTreeCanvas.vue`:
```typescript
import { treeApi } from '../api';
```

Thêm sau đó:
```typescript
import { useRouter } from 'vue-router';
```

Tìm dòng:
```typescript
const { fitView, setCenter, viewport } = useVueFlow('family-tree');
```

Thêm sau đó:
```typescript
const router = useRouter();
```

Tìm hàm `onNodeClick`:
```typescript
function onNodeClick(event: NodeMouseEvent) {
```

Thay toàn bộ hàm này bằng:
```typescript
function onNodeClick(event: NodeMouseEvent) {
  if (event.node.type === 'spouseConnector') {
    const relId = event.node.id.replace('connector-', '');
    router.push(`/relationships/${relId}/media`);
    return;
  }
  if (event.node.type === 'person') {
    emit('selectPerson', event.node.id);
  }
}
```

Lưu ý: cần kiểm tra hàm `onNodeClick` hiện tại trong file để thay đúng. Nếu hàm có logic khác, chỉ thêm block `spouseConnector` vào đầu hàm trước các case hiện có.

- [ ] **Step 2: Cập nhật cột "Người" trong AdminMediaPage.vue**

Tìm đoạn trong template:
```html
          <td>
            <router-link :to="`/persons/${item.personId}/media`" class="person-link">
              {{ item.person?.fullName ?? '—' }}
            </router-link>
          </td>
```

Thay bằng:
```html
          <td>
            <router-link
              v-if="item.personId"
              :to="`/persons/${item.personId}/media`"
              class="person-link"
            >
              {{ item.person?.fullName ?? '—' }}
            </router-link>
            <router-link
              v-else-if="item.relationshipId"
              :to="`/relationships/${item.relationshipId}/media`"
              class="person-link"
            >
              {{ item.relationship?.personA?.fullName ?? '' }} ↔ {{ item.relationship?.personB?.fullName ?? '' }}
            </router-link>
            <span v-else>—</span>
          </td>
```

- [ ] **Step 3: Build check**

```bash
cd frontend
npx vue-tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/FamilyTreeCanvas.vue frontend/src/pages/AdminMediaPage.vue
git commit -m "feat: SpouseConnector click navigates to relationship media, AdminMediaPage shows relationship context"
```

---

## Self-Review

**Spec coverage:**
- ✅ DB schema: personId nullable, relationshipId added, Relationship.media[] relation
- ✅ GET /relationships/:id — Task 2
- ✅ GET /relationships/:id/media — Task 2
- ✅ POST /relationships/:id/media — Task 2
- ✅ media/sign accepts relationshipId — Task 3
- ✅ persons relatives children fix — Task 3
- ✅ Admin queue includes relationship context — Task 3
- ✅ mediaApi new methods — Task 4
- ✅ Router route — Task 4
- ✅ RelationshipMediaPage.vue — Task 5
- ✅ MediaUploadModal supports relationshipId — Task 6
- ✅ PersonDrawer 🖼 buttons — Task 7
- ✅ FamilyTreeCanvas spouseConnector click — Task 8
- ✅ AdminMediaPage relationship context — Task 8

**Type consistency:**
- `mediaApi.sign` params: `{ resourceType, personId?, relationshipId? }` — consistent across Tasks 4, 6
- `mediaApi.confirmRelationshipUpload(relationshipId, data)` — consistent Tasks 4, 5, 6
- `mediaApi.listByRelationship(relationshipId)` — consistent Tasks 4, 5
- `relationshipsApi.get(id)` — consistent Tasks 4, 5
- `validateSignParams` helper — used in Task 3 sign route, tested in Task 3 tests
