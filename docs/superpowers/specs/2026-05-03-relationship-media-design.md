# Relationship Media — Design

**Goal:** Gắn ảnh/video/PDF vào mối quan hệ (vợ chồng, cha mẹ-con cái) trong gia phả. Viewer upload được nhưng cần admin duyệt trước khi hiển thị. Truy cập từ PersonDrawer và từ SpouseConnector trên cây.

**Architecture:** Mở rộng bảng `Media` hiện có — thêm `relationshipId` (nullable), `personId` thành nullable. Đúng một trong hai phải có giá trị (enforce ở application layer). Tái dụng toàn bộ Cloudinary service, upload modal, viewer, và admin queue đã có từ Person media.

**Tech Stack:** Node.js + Prisma + PostgreSQL, Cloudinary, Vue 3, Vue Router, JWT role-based access.

---

## 1. Database Schema

Thay đổi model `Media` trong `backend/prisma/schema.prisma`:

```prisma
model Media {
  id             String            @id @default(uuid())
  personId       String?                                  // nullable (trước là required)
  person         Person?           @relation(fields: [personId], references: [id], onDelete: Cascade)
  relationshipId String?                                  // mới
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
}
```

Thêm relation ngược vào `Relationship` model:
```prisma
model Relationship {
  // ... fields hiện có ...
  media Media[]
}
```

Migration: `personId` thành nullable, thêm cột `relationshipId`, thêm FK + index.

---

## 2. Backend

### cloudinaryService.ts
Không đổi signature. Caller truyền folder phù hợp:
- Person media: `family-tree/persons/{personId}`
- Relationship media: `family-tree/relationships/{relationshipId}`

### GET /media/sign
Cập nhật để nhận `relationshipId` thay thế cho `personId`:
```
GET /media/sign?resourceType=image&relationshipId=abc123
GET /media/sign?resourceType=image&personId=xyz456
```
Validate: đúng một trong hai phải có. Trả về signature với folder tương ứng.

### relationships.ts — 3 route mới
```
GET  /relationships/:id
  - requireViewer
  - Response: { id, type, marriedDate?, personA: { id, fullName }, personB: { id, fullName } }
  - Dùng bởi RelationshipMediaPage để hiển thị title

GET  /relationships/:id/media
  - requireViewer
  - viewer: chỉ trả APPROVED
  - editor/admin: trả tất cả status
  - Response: { data: Media[], total: number }

POST /relationships/:id/media
  - requireViewer
  - Body: { cloudinaryId, url, resourceType, format, bytes, caption? }
  - Tạo Media record với relationshipId, status=PENDING, uploadedBy=req.user.phone
  - Validate: relationship tồn tại
```

### persons.ts — GET /:id/relatives
Thêm `relationshipId` vào mỗi phần tử trả về:
```json
{
  "spouses":  [{ "id": "uuid", "fullName": "...", "relationshipId": "uuid" }],
  "parents":  [{ "id": "uuid", "fullName": "...", "relationshipId": "uuid" }],
  "children": [{ "id": "uuid", "fullName": "...", "relationshipId": "uuid" }]
}
```

### AdminMediaPage queue
Route `GET /media` (admin queue) đã trả tất cả media. Chỉ cần include relationship context trong response:
```
include: { person: { select: { fullName } }, relationship: { select: { personAId, personBId, personA: { select: { fullName } }, personB: { select: { fullName } } } } }
```

---

## 3. Frontend

### mediaApi (frontend/src/api/index.ts)
Cập nhật và thêm:
```ts
sign: (params: { resourceType: string; personId?: string; relationshipId?: string }) =>
  api.get('/media/sign', { params }),

listByRelationship: (relationshipId: string) =>
  api.get(`/relationships/${relationshipId}/media`),

confirmRelationshipUpload: (relationshipId: string, data: UploadData) =>
  api.post(`/relationships/${relationshipId}/media`, data),
```

### RelationshipMediaPage.vue (mới)
Route: `/relationships/:id/media`

- Fetch relationship để lấy tên 2 người: `GET /relationships/:id` (cần thêm route này hoặc embed trong existing endpoint)
- Title: `"🖼 [PersonA fullName] ↔ [PersonB fullName]"`
- Grid, upload, viewer, moderation — clone từ `PersonMediaPage.vue`
- Nút "← Về trang chủ" và link về PersonDrawer của từng người

### PersonDrawer.vue
Thêm icon 🖼 cạnh mỗi relative button, link `/relationships/:relationshipId/media`:
```html
<!-- Spouses -->
<div v-if="relatives.spouses?.length">
  <h3>💍 Vợ / Chồng</h3>
  <div v-for="s in relatives.spouses" :key="s.id" class="rel-row">
    <button class="rel-btn" @click="$emit('selectPerson', s.id)">{{ s.fullName }}</button>
    <router-link :to="`/relationships/${s.relationshipId}/media`" class="rel-media-btn">🖼</router-link>
  </div>
</div>
```
Tương tự cho parents và children.

### SpouseConnector.vue + FamilyTreeCanvas.vue
Chỉ áp dụng cho **spouse** — parent-child là edge (đường kẻ), UX kém khi click, entry point từ cây chỉ dành cho SpouseConnector node.

SpouseConnector nhận `data.relationshipId` (lấy từ connector node ID bằng cách strip prefix `connector-`).

FamilyTreeCanvas xử lý click trên spouseConnector node:
```ts
function onNodeClick(event: NodeMouseEvent) {
  if (event.node.type === 'spouseConnector') {
    const relId = event.node.id.replace('connector-', '');
    router.push(`/relationships/${relId}/media`);
  }
  // ... existing person node handling
}
```

### Router (frontend/src/router/index.ts)
Thêm route:
```ts
{ path: '/relationships/:id/media', component: RelationshipMediaPage, meta: { requiresAuth: true } }
```

### AdminMediaPage.vue
Hiển thị context cho relationship media:
- Nếu `item.relationshipId`: hiện `"[PersonA] ↔ [PersonB]"` thay vì tên người
- Không cần thay đổi logic approve/reject

---

## 4. Access Control

| Action | Viewer | Editor | Admin |
|--------|--------|--------|-------|
| Xem APPROVED media | ✅ | ✅ | ✅ |
| Xem PENDING/REJECTED | ❌ | ✅ | ✅ |
| Upload media | ✅ | ✅ | ✅ |
| Approve/Reject | ❌ | ❌ | ✅ |
| Xóa media | Chỉ upload của mình | ✅ | ✅ |

---

## 5. Error Handling

- `POST /relationships/:id/media`: 404 nếu relationship không tồn tại
- `GET /media/sign`: 400 nếu không có `personId` hay `relationshipId`, hoặc có cả hai
- `RelationshipMediaPage`: redirect về `/` nếu relationship không tồn tại
- Cloudinary upload fail: hiện lỗi inline, không tạo DB record
