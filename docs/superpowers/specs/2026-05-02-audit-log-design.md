# Audit Log — Design

**Goal:** Ghi lại tất cả hành động tạo/sửa/xóa trên Person và Relationship, cho phép admin xem lịch sử thay đổi kèm diff before/after.

**Architecture:** Service layer — mỗi route handler gọi `auditService.logAudit()` sau khi thực hiện operation. Log được lưu vào bảng `audit_logs` PostgreSQL. Admin xem qua trang `/admin/audit` với filter và diff viewer.

**Tech Stack:** Node.js + Prisma + PostgreSQL, Vue 3 frontend, JWT role-based access (`admin` only).

---

## 1. Data Model

```prisma
model AuditLog {
  id          String      @id @default(uuid())
  actorPhone  String
  action      AuditAction
  entityType  AuditEntity
  entityId    String
  entityLabel String
  beforeJson  Json?
  afterJson   Json?
  createdAt   DateTime    @default(now())

  @@index([entityType])
  @@index([action])
  @@index([createdAt])
  @@index([entityLabel])
  @@map("audit_logs")
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
}

enum AuditEntity {
  PERSON
  RELATIONSHIP
}
```

**Không dùng foreign key** đến `AccessToken` — lưu `actorPhone` trực tiếp để log vẫn đọc được nếu token bị xóa.

**`entityLabel`:**
- Person: `Person.fullName`
- Relationship: `"<nameA> ↔ <nameB> (<type>)"` ví dụ `"Lâm Văn A ↔ Lâm Thị B (spouse)"`

**`beforeJson` / `afterJson`:** snapshot toàn bộ record tại thời điểm operation.
- CREATE: `beforeJson = null`, `afterJson = record mới`
- UPDATE: `beforeJson = record cũ`, `afterJson = record sau update`
- DELETE: `beforeJson = record cũ`, `afterJson = null`

---

## 2. Backend

### Files

| File | Thay đổi |
|------|---------|
| `backend/prisma/schema.prisma` | Thêm model `AuditLog`, enum `AuditAction`, enum `AuditEntity` |
| `backend/src/services/auditService.ts` | Mới — `logAudit()` |
| `backend/src/routes/persons.ts` | Thêm log vào POST (create), PUT (update), DELETE |
| `backend/src/routes/relationships.ts` | Thêm log vào POST (create), DELETE |
| `backend/src/routes/audit.ts` | Mới — GET `/api/audit` |
| `backend/src/app.ts` | Mount `auditRouter` tại `/api/audit` |

### auditService.ts

```ts
export interface LogParams {
  actorPhone: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: 'PERSON' | 'RELATIONSHIP';
  entityId: string;
  entityLabel: string;
  before?: object;
  after?: object;
}

export async function logAudit(params: LogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorPhone: params.actorPhone,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        entityLabel: params.entityLabel,
        beforeJson: params.before ?? undefined,
        afterJson: params.after ?? undefined,
      },
    });
  } catch (err) {
    console.error('[audit] failed to write log:', err);
    // Never throw — audit failure must not break the primary operation
  }
}
```

### Lấy actorPhone trong routes

Middleware `auth.ts` đã gắn `req.user` (gồm `phone`, `role`). Dùng `req.user.phone` làm `actorPhone`.

### Route persons.ts — nơi thêm log

**POST /persons (create):**
```
const person = await personService.createPerson(data);
await logAudit({ actorPhone, action: 'CREATE', entityType: 'PERSON',
  entityId: person.id, entityLabel: person.fullName, after: person });
```

**PUT /persons/:id (update):**
```
const before = await prisma.person.findUnique({ where: { id } });
const after = await personService.updatePerson(id, data);
await logAudit({ actorPhone, action: 'UPDATE', entityType: 'PERSON',
  entityId: id, entityLabel: after.fullName, before, after });
```

**DELETE /persons/:id:**
```
const before = await prisma.person.findUnique({ where: { id } });
await personService.deletePerson(id);
await logAudit({ actorPhone, action: 'DELETE', entityType: 'PERSON',
  entityId: id, entityLabel: before.fullName, before });
```

### Route relationships.ts — nơi thêm log

**POST /relationships (create):**
```
const rel = await prisma.relationship.create({
  data: { ... },
  include: { personA: { select: { fullName: true } }, personB: { select: { fullName: true } } },
});
const label = `${rel.personA.fullName} ↔ ${rel.personB.fullName} (${rel.type})`;
await logAudit({ actorPhone, action: 'CREATE', entityType: 'RELATIONSHIP',
  entityId: rel.id, entityLabel: label, after: rel });
```

**DELETE /relationships/:id:**
```
const before = await prisma.relationship.findUnique({ where: { id }, include: { personA, personB } });
await prisma.relationship.delete({ where: { id } });
const label = `${before.personA.fullName} ↔ ${before.personB.fullName} (${before.type})`;
await logAudit({ actorPhone, action: 'DELETE', entityType: 'RELATIONSHIP',
  entityId: id, entityLabel: label, before });
```

### GET /api/audit

**Auth:** `requireRole('admin')` middleware.

**Query params:**

| Param | Type | Mô tả |
|-------|------|-------|
| `action` | `CREATE\|UPDATE\|DELETE` | Lọc theo hành động |
| `entityType` | `PERSON\|RELATIONSHIP` | Lọc theo loại |
| `search` | string | Tìm theo entityLabel (case-insensitive contains) |
| `from` | ISO date string | Từ ngày |
| `to` | ISO date string | Đến ngày |
| `page` | number (default 1) | Trang |
| `limit` | number (default 50, max 100) | Số bản ghi mỗi trang |

**Response:**
```json
{
  "data": [ { "id", "actorPhone", "action", "entityType", "entityId", "entityLabel", "beforeJson", "afterJson", "createdAt" } ],
  "total": 123,
  "page": 1,
  "limit": 50
}
```

---

## 3. Frontend

### Files

| File | Thay đổi |
|------|---------|
| `frontend/src/pages/AuditPage.vue` | Mới |
| `frontend/src/api/index.ts` | Thêm `auditApi.list(params)` |
| `frontend/src/router/index.ts` | Thêm route `/admin/audit` với guard `isAdmin` |
| `frontend/src/pages/TreePage.vue` | Thêm link "📋 Audit" trong toolbar |

### AuditPage.vue — layout

```
┌─────────────────────────────────────────────────────────────┐
│ [← Về trang chủ]    📋 Audit Log                           │
├──────────┬──────────┬────────────┬──────────┬──────────────┤
│ Action ▼ │ Loại ▼   │ Từ ngày    │ Đến ngày │ 🔍 Tìm tên  │  [Reset]
├──────────┴──────────┴────────────┴──────────┴──────────────┤
│ Thời gian      │ Actor  │ Hành động │ Loại │ Tên entity │ Diff │
├────────────────┼────────┼───────────┼──────┼────────────┼──────┤
│ 02/05 07:32    │ 0901…  │ UPDATE    │ PERSON│ Lâm Văn A │ [👁] │
│ ...                                                          │
├─────────────────────────────────────────────────────────────┤
│                      ← Trang 1/3 →                         │
└─────────────────────────────────────────────────────────────┘
```

**Diff modal:** khi nhấn 👁, hiện modal với 2 cột JSON (before / after), dùng `<pre>` format đẹp với `JSON.stringify(obj, null, 2)`. Nếu before hoặc after null thì hiện `—`.

**Action badge colors:**
- CREATE: xanh lá (#2da44e background)
- UPDATE: xanh dương (#0969da background)
- DELETE: đỏ (#cf222e background)

### api/index.ts — thêm

```ts
export const auditApi = {
  list: (params: {
    action?: string; entityType?: string; search?: string;
    from?: string; to?: string; page?: number; limit?: number;
  }) => api.get('/audit', { params }),
};
```

### router/index.ts

```ts
{
  path: '/admin/audit',
  component: () => import('../pages/AuditPage.vue'),
  beforeEnter: (to, from, next) => {
    const auth = useAuthStore();
    auth.isAdmin ? next() : next('/');
  },
}
```

### TreePage.vue toolbar

Thêm cạnh nút đăng xuất (chỉ admin):
```html
<router-link v-if="auth.isAdmin" to="/admin/audit" class="btn-audit">
  <span class="btn-full">📋 Audit</span>
  <span class="btn-short">📋</span>
</router-link>
```

---

## 4. Không làm (out of scope)

- Retention policy / auto-delete logs cũ
- Export logs ra CSV/Excel
- Realtime log stream
- Undo/restore từ audit log
- Log auth events (đăng nhập/đăng xuất)
- Gửi alert khi có DELETE
