# Album — Design

**Goal:** Tạo album ảnh/video trong gia phả — nhóm media từ nhiều nguồn (upload mới hoặc gắn media sẵn có), có thể gắn với một người hoặc standalone. Viewer tạo được nhưng cần admin duyệt trước khi hiển thị công khai. Truy cập từ `/albums` và từ PersonDrawer.

**Architecture:** Thêm 2 bảng mới: `Album` (metadata + status) và `AlbumMedia` (junction table). Media đã APPROVED có thể được linked vào nhiều album cùng lúc mà không cần upload lại. Upload mới trong album tạo `Media` record bình thường (qua moderation queue). Album dùng chung Cloudinary service, `MediaUploadModal`, `MediaViewer`, và admin queue hiện có.

**Tech Stack:** Node.js + Prisma + PostgreSQL, Cloudinary, Vue 3, Vue Router, JWT role-based access.

---

## 1. Database Schema

Thêm vào `backend/prisma/schema.prisma`:

```prisma
model Album {
  id           String      @id @default(uuid())
  title        String
  description  String?
  coverMediaId String?
  coverMedia   Media?      @relation("AlbumCover", fields: [coverMediaId], references: [id], onDelete: SetNull)
  personId     String?
  person       Person?     @relation(fields: [personId], references: [id], onDelete: SetNull)
  createdBy    String
  status       AlbumStatus @default(PENDING)
  createdAt    DateTime    @default(now())
  items        AlbumMedia[]

  @@index([personId])
  @@index([status])
  @@map("albums")
}

model AlbumMedia {
  albumId  String
  mediaId  String
  position Int      @default(0)
  addedAt  DateTime @default(now())
  album    Album    @relation(fields: [albumId], references: [id], onDelete: Cascade)
  media    Media    @relation(fields: [mediaId], references: [id], onDelete: Cascade)

  @@id([albumId, mediaId])
  @@map("album_media")
}

enum AlbumStatus {
  PENDING
  APPROVED
  REJECTED
}
```

Thêm quan hệ ngược vào các model hiện có:

```prisma
model Person {
  // ... fields hiện có ...
  albums Album[]
}

model Media {
  // ... fields hiện có ...
  albumItems  AlbumMedia[]
  albumCovers Album[]      @relation("AlbumCover")
}
```

---

## 2. Backend

### albums.ts — routes mới

File mới `backend/src/routes/albums.ts`, mount tại `/api/albums` trong `app.ts`.

```
GET  /albums
  - requireViewer
  - Query params: status? (PENDING|APPROVED|REJECTED|ALL), personId?, page?, limit?
  - viewer: chỉ trả APPROVED
  - editor/admin: trả theo status filter (default ALL)
  - Response: { data: Album[], total }
  - Include: person { id, fullName }, coverMedia { url }

POST /albums
  - requireViewer
  - Body: { title, description?, personId? }
  - Tạo Album với status=PENDING, createdBy=req.user.phone
  - Response: 201 + album

GET /albums/:id
  - requireViewer
  - viewer: 403 nếu status !== APPROVED (trừ creator)
  - editor/admin: xem tất cả
  - Response: album + items: AlbumMedia[] include media { id, url, resourceType, format, caption, status }
  - Viewer chỉ thấy items có media.status === APPROVED

PUT /albums/:id
  - requireViewer
  - Chỉ creator hoặc editor/admin
  - Body: { title?, description?, coverMediaId? }
  - 403 nếu viewer cố sửa album của người khác

DELETE /albums/:id
  - requireViewer
  - Chỉ creator hoặc admin
  - 403 nếu không có quyền

PATCH /albums/:id/status
  - requireAdmin
  - Body: { status: APPROVED | REJECTED }

POST /albums/:id/media
  - requireViewer
  - Hai chế độ:
    1. Link media sẵn có: body { mediaId }
       - Validate: media tồn tại + status APPROVED
       - Validate: chưa có trong album (409 nếu đã có)
       - Tạo AlbumMedia record
    2. Upload mới: body { cloudinaryId, url, resourceType, format, bytes, caption? }
       - Tạo Media record với status=PENDING, uploadedBy=req.user.phone (không có personId/relationshipId)
       - Tạo AlbumMedia record
  - Response: 201 + AlbumMedia

DELETE /albums/:id/media/:mediaId
  - requireViewer
  - Chỉ admin, creator của album, hoặc uploader của media đó
  - Xóa AlbumMedia record (không xóa Media gốc)
```

### mediaSignValidation.ts + media.ts — cập nhật sign endpoint

`validateSignParams` cần chấp nhận thêm `albumId` (đúng một trong ba: personId, relationshipId, albumId):

```typescript
export function validateSignParams(params: {
  resourceType?: string;
  personId?: string;
  relationshipId?: string;
  albumId?: string;
}): string | null {
  if (!params.resourceType) return 'resourceType is required';
  const count = [params.personId, params.relationshipId, params.albumId].filter(Boolean).length;
  if (count !== 1) return 'Exactly one of personId, relationshipId, or albumId is required';
  return null;
}
```

`GET /media/sign` khi có `albumId`: folder = `family-tree/albums/${albumId}`.

### persons.ts — thêm sub-route

```
GET /persons/:id/albums
  - requireViewer
  - viewer: chỉ APPROVED
  - editor/admin: tất cả
  - Response: { data: Album[] }
  - Include: coverMedia { url }, _count { items }
```

### app.ts

```typescript
import { albumsRouter } from './routes/albums';
app.use('/api/albums', albumsRouter);
```

---

## 3. Frontend

### albumsApi (frontend/src/api/index.ts)

```ts
export const albumsApi = {
  list: (params?: { status?: string; personId?: string; page?: number; limit?: number }) =>
    api.get('/albums', { params }),

  create: (data: { title: string; description?: string; personId?: string }) =>
    api.post('/albums', data),

  get: (id: string) =>
    api.get(`/albums/${id}`),

  update: (id: string, data: { title?: string; description?: string; coverMediaId?: string }) =>
    api.put(`/albums/${id}`, data),

  delete: (id: string) =>
    api.delete(`/albums/${id}`),

  updateStatus: (id: string, status: 'APPROVED' | 'REJECTED') =>
    api.patch(`/albums/${id}/status`, { status }),

  addMedia: (id: string, data: { mediaId?: string; cloudinaryId?: string; url?: string; resourceType?: string; format?: string; bytes?: number; caption?: string }) =>
    api.post(`/albums/${id}/media`, data),

  removeMedia: (id: string, mediaId: string) =>
    api.delete(`/albums/${id}/media/${mediaId}`),

  listByPerson: (personId: string) =>
    api.get(`/persons/${personId}/albums`),
};
```

### Router (frontend/src/router/index.ts)

```ts
{ path: '/albums', component: () => import('../pages/AlbumsPage.vue'), meta: { requiresAuth: true } },
{ path: '/albums/:id', component: () => import('../pages/AlbumPage.vue'), meta: { requiresAuth: true } },
```

### AlbumsPage.vue (mới)

Route: `/albums`

- Fetch `albumsApi.list()` on mount
- Grid: cover thumbnail (hoặc placeholder), title, tên person nếu có, status badge (PENDING/REJECTED cho editor/admin)
- Nút "Tạo album mới" (nếu đã login) → mở `AlbumCreateModal`
- Click vào album → navigate `/albums/:id`

### AlbumPage.vue (mới)

Route: `/albums/:id`

- Fetch `albumsApi.get(id)` on mount; redirect về `/albums` nếu 404
- Header: title, description, person link, status badge
- Grid media (giống `PersonMediaPage`): thumbnail, status badge, viewer on click
- Nút "Thêm media" → mở `AlbumMediaAddModal`
- Admin: nút Approve/Reject nếu status PENDING
- Creator/admin: nút xóa media khỏi album (không xóa media gốc)
- Editor/admin: nút sửa title/description

### AlbumCreateModal.vue (mới)

- Form: title (required), description (optional), gắn với người (optional — input tìm tên, chọn từ danh sách)
- Submit → `albumsApi.create()` → hiển thị "Đã tạo — đang chờ admin duyệt"

### AlbumMediaAddModal.vue (mới)

2 tab:

**Tab 1 — Upload mới:**
- Reuse flow giống `MediaUploadModal`: chọn file → sign → upload Cloudinary → `albumsApi.addMedia(id, { cloudinaryId, url, ... })`
- Media mới có status PENDING (cần admin duyệt riêng)

**Tab 2 — Chọn từ media sẵn có:**
- Fetch danh sách media APPROVED của album's person (nếu album gắn person) hoặc tìm kiếm theo personId/relationshipId
- Grid chọn (multi-select) → `albumsApi.addMedia(id, { mediaId })`
- Ẩn media đã có trong album

### PersonDrawer.vue

Thêm section "📚 Albums" phía trên phần relatives:

```html
<div v-if="personAlbums?.length || auth.token" class="albums-section">
  <h3>📚 Albums</h3>
  <div v-for="a in personAlbums" :key="a.id" class="album-row">
    <router-link :to="`/albums/${a.id}`" class="album-link">{{ a.title }}</router-link>
  </div>
  <button v-if="auth.token" class="btn-new-album" @click="showCreateAlbum = true">+ Tạo album</button>
</div>
<AlbumCreateModal
  v-if="showCreateAlbum"
  :preset-person-id="person.id"
  @close="showCreateAlbum = false"
  @created="onAlbumCreated"
/>
```

Load `albumsApi.listByPerson(personId)` song song với person data trong `watch`. `onAlbumCreated` reload danh sách albums.

### AdminMediaPage.vue

Thêm tab "Albums" trong trang admin:

- Tab "Media" (hiện tại) và tab "Albums"
- Tab Albums: fetch `albumsApi.list({ status: 'PENDING' })`, hiển thị table với title, creator, ngày tạo, nút Approve/Reject

---

## 4. Access Control

| Action | Viewer | Editor | Admin |
|--------|--------|--------|-------|
| Xem APPROVED albums | ✅ | ✅ | ✅ |
| Xem PENDING/REJECTED của mình | ✅ | ✅ | ✅ |
| Xem PENDING/REJECTED của người khác | ❌ | ✅ | ✅ |
| Tạo album | ✅ | ✅ | ✅ |
| Sửa album của mình | ✅ | ✅ | ✅ |
| Sửa album của người khác | ❌ | ✅ | ✅ |
| Thêm media vào album của mình | ✅ | ✅ | ✅ |
| Xóa media khỏi album (uploader hoặc creator) | ✅ | ✅ | ✅ |
| Xóa media khỏi album của người khác | ❌ | ✅ | ✅ |
| Approve/Reject album | ❌ | ❌ | ✅ |
| Xóa album của mình | ✅ | ✅ | ✅ |
| Xóa album của người khác | ❌ | ❌ | ✅ |

---

## 5. Error Handling

- `POST /albums/:id/media` với `mediaId`: 404 nếu media không tồn tại, 400 nếu media chưa APPROVED, 409 nếu đã có trong album
- `GET /albums/:id`: 403 nếu viewer cố xem PENDING/REJECTED album của người khác
- `AlbumPage.vue`: redirect về `/albums` nếu 404
- `PUT /albums/:id`: 403 nếu viewer không phải creator
- Upload thất bại trong `AlbumMediaAddModal`: hiển thị lỗi inline, không tạo record
