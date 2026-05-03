# Media Gallery — Design

**Goal:** Thêm kho đa phương tiện cho mỗi người trong gia phả — ảnh, video ngắn, PDF. Viewer upload được nhưng cần admin duyệt trước khi hiển thị. Admin xem queue duyệt tại `/admin/media` và inline trong trang `/persons/:id/media`.

**Architecture:** Backend-signed direct upload — backend tạo Cloudinary signature, frontend upload thẳng lên Cloudinary (không qua server), sau đó báo lại backend để lưu DB với `status: PENDING`. Admin duyệt qua 2 nơi: trang tổng quan và inline trong gallery của từng người.

**Tech Stack:** Node.js + Prisma + PostgreSQL, Cloudinary (cloud storage + CDN), Vue 3 frontend, JWT role-based access.

---

## 1. Data Model

```prisma
model Media {
  id             String            @id @default(uuid())
  personId       String
  person         Person            @relation(fields: [personId], references: [id], onDelete: Cascade)
  cloudinaryId   String            @unique
  url            String
  resourceType   MediaResourceType
  format         String
  bytes          Int
  caption        String?
  status         MediaStatus
  uploadedBy     String
  createdAt      DateTime          @default(now())

  @@index([personId])
  @@index([status])
  @@map("media")
}

enum MediaResourceType {
  IMAGE
  VIDEO
  RAW
}

enum MediaStatus {
  PENDING
  APPROVED
  REJECTED
}
```

**Ghi chú:**
- `cloudinaryId`: Cloudinary `public_id`, dùng để xóa file khi cần
- `url`: Cloudinary `secure_url` — base URL, chưa có transformation params
- `resourceType`: map từ Cloudinary resource_type (`raw` = PDF và các file khác)
- `uploadedBy`: phone của uploader, không FK để log không bị mất nếu token xóa
- `onDelete: Cascade` — xóa record DB khi xóa Person, nhưng **file Cloudinary phải xóa thủ công** trước đó trong route DELETE
- `Person` model cần thêm `media Media[]` relation

---

## 2. Backend

### Environment variables

Thêm vào `.env` và `.env.example`:
```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Files

| File | Thay đổi |
|------|---------|
| `backend/prisma/schema.prisma` | Thêm `Media`, `MediaResourceType`, `MediaStatus`; thêm `media Media[]` vào Person |
| `backend/src/services/cloudinaryService.ts` | Mới — `generateSignature()`, `deleteMedia()` |
| `backend/src/routes/media.ts` | Mới — sign, status, delete, admin queue |
| `backend/src/routes/persons.ts` | Thêm `POST /:id/media` và `GET /:id/media` |
| `backend/src/app.ts` | Mount `mediaRouter` tại `/api/media` |

### cloudinaryService.ts

```ts
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export function generateSignature(params: {
  folder: string;
  resourceType: string;
}): {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
} {
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { folder: params.folder, timestamp };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET!);
  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    folder: params.folder,
  };
}

export async function deleteMedia(cloudinaryId: string, resourceType: string): Promise<void> {
  const type = resourceType === 'IMAGE' ? 'image' : resourceType === 'VIDEO' ? 'video' : 'raw';
  await cloudinary.uploader.destroy(cloudinaryId, { resource_type: type });
}
```

### media.ts — endpoints

**GET `/api/media/sign`** (requireViewer — tất cả user đã đăng nhập)

Query params: `resourceType` (`image`|`video`|`raw`), `personId`

```ts
// Returns signed upload params
{
  signature, timestamp, apiKey, cloudName,
  folder: `family-tree/persons/${personId}`
}
```

**PATCH `/api/media/:id/status`** (requireAdmin)

Body: `{ status: 'APPROVED' | 'REJECTED' }`

Updates `media.status`. Không xóa file Cloudinary khi REJECTED — admin có thể xem lại.

**DELETE `/api/media/:id`** (requireAdmin hoặc `media.uploadedBy === req.user.phone`)

1. Tìm media record
2. Gọi `cloudinaryService.deleteMedia(media.cloudinaryId, media.resourceType)`
3. Xóa DB record

**GET `/api/media`** (requireAdmin)

Query: `status` (default `PENDING`), `page`, `limit` (default 20)

Response: `{ data: Media[], total, page, limit }`

### persons.ts — 2 routes mới

**POST `/api/persons/:id/media`** (requireViewer — tất cả user đã đăng nhập)

Body:
```ts
{
  cloudinaryId: string;   // public_id từ Cloudinary response
  url: string;            // secure_url
  resourceType: 'IMAGE' | 'VIDEO' | 'RAW';
  format: string;         // jpg, mp4, pdf…
  bytes: number;
  caption?: string;
}
```

Lưu DB với `status: PENDING`, `uploadedBy: req.user.phone`.

**GET `/api/persons/:id/media`** (requireViewer)

- Viewer: chỉ trả `status === APPROVED`
- Admin/Editor: trả tất cả (bao gồm PENDING, REJECTED)

Response: `{ data: Media[] }`

---

## 3. Frontend

### Files

| File | Thay đổi |
|------|---------|
| `frontend/src/pages/PersonMediaPage.vue` | Mới — gallery `/persons/:id/media` |
| `frontend/src/pages/AdminMediaPage.vue` | Mới — moderation queue `/admin/media` |
| `frontend/src/components/MediaUploadModal.vue` | Mới — upload flow |
| `frontend/src/components/MediaViewer.vue` | Mới — fullscreen viewer |
| `frontend/src/api/index.ts` | Thêm `mediaApi` |
| `frontend/src/router/index.ts` | Thêm `/persons/:id/media` và `/admin/media` |
| `frontend/src/components/PersonDrawer.vue` | Thêm link "🖼 Xem media" |

### mediaApi

```ts
export const mediaApi = {
  sign: (params: { resourceType: string; personId: string }) =>
    api.get('/media/sign', { params }),
  confirmUpload: (personId: string, data: {
    cloudinaryId: string; url: string; resourceType: string;
    format: string; bytes: number; caption?: string;
  }) => api.post(`/persons/${personId}/media`, data),
  listByPerson: (personId: string) =>
    api.get(`/persons/${personId}/media`),
  updateStatus: (mediaId: string, status: 'APPROVED' | 'REJECTED') =>
    api.patch(`/media/${mediaId}/status`, { status }),
  delete: (mediaId: string) =>
    api.delete(`/media/${mediaId}`),
  adminQueue: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/media', { params }),
};
```

### Router

```ts
{
  path: '/persons/:id/media',
  component: () => import('../pages/PersonMediaPage.vue'),
  meta: { requiresAuth: true },
},
{
  path: '/admin/media',
  component: () => import('../pages/AdminMediaPage.vue'),
  meta: { requiresAuth: true, requiresAdmin: true },
},
```

### PersonMediaPage layout

```
┌─────────────────────────────────────────┐
│ ← Về trang chủ   🖼 Media — Lâm Văn A  │
│                           [+ Thêm media]│
├─────────────────────────────────────────┤
│ [ảnh] [ảnh] [video] [PDF]              │
│ [ảnh chờ duyệt ✱]  (chỉ admin thấy)   │
│  ...grid 3-4 cột...                     │
└─────────────────────────────────────────┘
```

- Grid thumbnail: ảnh dùng Cloudinary URL transformation `w_300,h_300,c_fill`; video dùng thumbnail Cloudinary (`so_auto`); PDF dùng icon
- Click item → `MediaViewer` modal
- Admin thấy PENDING item với badge "Chờ duyệt" + nút `[✓ Duyệt]` `[✗ Từ chối]` inline
- `[+ Thêm media]` chỉ hiện với tất cả user đã đăng nhập (viewer, editor, admin)

### MediaUploadModal flow

1. User chọn file (`accept="image/*,video/*,application/pdf"`)
2. Validate: ảnh ≤ 10MB, video ≤ 50MB, PDF ≤ 20MB (client-side)
3. Gọi `mediaApi.sign({ resourceType, personId })`
4. POST thẳng lên `https://api.cloudinary.com/v1_1/:cloudName/:resourceType/upload` (FormData)
5. Nhận Cloudinary response `{ public_id, secure_url, format, bytes }`
6. Gọi `mediaApi.confirmUpload(personId, { cloudinaryId, url, resourceType, format, bytes, caption })`
7. Hiển thị: "Đã tải lên — đang chờ admin duyệt"

**Upload error handling:** nếu bước 4 (Cloudinary) thất bại → không gọi bước 6, hiển thị lỗi. Nếu bước 6 thất bại sau khi đã upload Cloudinary → hiển thị lỗi "Tải lên thành công nhưng không lưu được — vui lòng thử lại".

### MediaViewer

- Ảnh: `<img>` full size với Cloudinary URL (không transformation)
- Video: `<video controls>` với `src = url`
- PDF: `<iframe src="url">` hoặc link tải xuống

### AdminMediaPage layout

```
┌────────────────────────────────────────────┐
│ [← Về trang chủ]   📋 Duyệt Media (12)    │
│ Filter: [Tất cả ▼] [PENDING ▼]            │
├──────────┬──────────┬──────┬───────────────┤
│ Preview  │ Người    │ Loại │ Actions       │
├──────────┼──────────┼──────┼───────────────┤
│ [thumb]  │ Lâm Văn A│ ảnh  │ [✓ Duyệt][✗] │
│ ...                                        │
└────────────────────────────────────────────┘
```

Filter: `status` (PENDING / APPROVED / REJECTED). Pagination 20 items/page.

### TreePage toolbar

Thêm link cạnh nút "📋 Audit" (chỉ admin):

```html
<router-link v-if="auth.isAdmin" to="/admin/media" class="btn-admin-media">
  🖼 Media
</router-link>
```

### PersonDrawer

Thêm link trong drawer (cạnh nút Edit), chỉ hiện khi đã đăng nhập:

```html
<router-link :to="`/persons/${person.id}/media`" class="btn-media">
  🖼 Xem media
</router-link>
```

---

## 4. Không làm (out of scope Phase 1)

- Relationship gallery và Family Album
- Migrate avatar hiện tại lên Cloudinary
- Giới hạn số file / dung lượng per person
- Drag-and-drop reorder gallery
- Chia sẻ link public media
- Notification khi media được duyệt
- Bulk approve/reject trong admin queue
- Watermark tự động
- Video transcoding/compression (dùng Cloudinary default)
