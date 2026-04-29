# Family Tree App — Design Spec

**Date:** 2026-04-28 · **Last updated:** 2026-04-29  
**App:** `justinlam-familytree` · **URL:** https://justinlam-familytree.fly.dev

---

## Overview

Ứng dụng web gia phả nhiều thế hệ cho họ Lâm. Lưu trữ thông tin thành viên, hiển thị sơ đồ quan hệ tương tác, phân quyền truy cập theo số điện thoại, hỗ trợ CRUD đầy đủ qua giao diện web. Deploy trên fly.io bằng Docker.

---

## Tech Stack

| Layer | Lựa chọn |
|-------|----------|
| Frontend | Vue 3 + Vite + TypeScript |
| Canvas | @vue-flow/core (VueFlow) + @dagrejs/dagre |
| State | Pinia |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| Auth | JWT — viewer: SĐT; editor/admin: SĐT + bcrypt password |
| Container | Docker multi-stage + Docker Compose |
| Hosting | fly.io — Singapore (`sin`) |
| CI/CD | GitHub Actions → flyctl deploy |

---

## Phân quyền (Roles)

Hệ thống có **3 vai trò**, lưu trong bảng `access_tokens`:

| Vai trò | Đăng nhập | Quyền |
|---------|-----------|-------|
| `viewer` | SĐT (không cần mật khẩu) | Xem cây, xem chi tiết |
| `editor` | SĐT + mật khẩu bcrypt | viewer + thêm/sửa người, upload ảnh, thêm/xóa quan hệ, cấp quyền viewer cho người khác |
| `admin` | SĐT + mật khẩu bcrypt | editor + xóa người, cấp/thu hồi mọi quyền (viewer/editor/admin) |

**Ràng buộc phân quyền bổ sung:**
- Editor không thể sửa quyền của tài khoản editor hoặc admin khác
- Khi tự sửa hồ sơ của mình (self-edit): vai trò bị khóa, chỉ được thay mật khẩu
- Backend kiểm tra quyền hai lớp: middleware guard + logic trong route handler

**Luồng đăng nhập (LoginPage.vue):**
1. Nhập SĐT → `POST /api/auth/check-phone` → nhận `{ role }`
2. `role === 'viewer'`: gọi login ngay (không cần mật khẩu) → nhận JWT → redirect `/`
3. `role === 'editor' | 'admin'`: hiện ô nhập mật khẩu → `POST /api/auth/login` → JWT

**Lưu trữ mật khẩu:** bcrypt (cost factor 12) trong `access_tokens.password_hash`. Viewer không có hash (NULL).

**Auto-provisioning:** Khi thêm/sửa người có SĐT và tích "Cấp quyền truy cập", backend upsert `access_tokens` trong cùng transaction với lưu người.

---

## Database Schema

### `persons`
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | UUID PK | cuid() |
| fullName | VARCHAR | Họ và tên |
| nickname | VARCHAR NULL | Tên thường gọi |
| gender | ENUM(male, female) | |
| birthDate | DATE NULL | |
| deathDate | DATE NULL | |
| phone | VARCHAR NULL | SĐT liên hệ |
| address | TEXT NULL | |
| bio | TEXT NULL | Tiểu sử / ghi chú |
| avatarUrl | VARCHAR NULL | `/uploads/<filename>` |
| generation | INT | Thế hệ 1, 2, 3… |
| isAlive | BOOLEAN | Backend tự set: `!deathDate` |
| createdAt | TIMESTAMP | |
| updatedAt | TIMESTAMP | |

### `relationships`
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | UUID PK | |
| personAId | UUID FK → persons | Cha/mẹ (parent_child) hoặc người A (spouse) |
| personBId | UUID FK → persons | Con (parent_child) hoặc người B (spouse) |
| type | ENUM(parent_child, spouse) | |
| marriedDate | DATE NULL | |
| divorcedDate | DATE NULL | |

Index trên `personAId`, `personBId`, `type` để tối ưu query layout.

### `access_tokens`
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | UUID PK | |
| phone | VARCHAR UNIQUE | SĐT = username |
| role | ENUM(viewer, editor, admin) | |
| label | VARCHAR NULL | Tên hiển thị |
| passwordHash | VARCHAR NULL | bcrypt — editor/admin; viewer để NULL |
| personId | UUID FK NULL → persons UNIQUE | Liên kết bản ghi người |

### `site_stats`
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | VARCHAR PK | Fixed = "global" |
| totalVisits | INT | Lũy kế, tăng mỗi session mới |

Online users theo dõi in-memory (Map token→timestamp, cửa sổ 2 phút).

---

## Cấu trúc thư mục (as-built)

```
family-tree/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations/
│   └── src/
│       ├── app.ts                     # Express, static serving /public
│       ├── server.ts                  # HTTP server
│       ├── lib/jwt.ts                 # signToken / verifyToken
│       ├── middleware/auth.ts         # requireViewer / requireEditor / requireAdmin
│       ├── routes/
│       │   ├── auth.ts                # check-phone, login
│       │   ├── persons.ts             # CRUD + avatar + access grant
│       │   ├── relationships.ts       # create / delete
│       │   ├── tree.ts                # GET /api/tree
│       │   └── stats.ts               # ping / leave / get
│       └── services/
│           ├── personService.ts       # createPerson / updatePerson
│           └── treeLayout.ts          # dagre layout engine
├── frontend/
│   └── src/
│       ├── api/index.ts
│       ├── stores/auth.ts             # token, role, linkedPersonId
│       ├── pages/
│       │   ├── LoginPage.vue
│       │   └── TreePage.vue
│       └── components/
│           ├── FamilyTreeCanvas.vue   # VueFlow, collapse logic
│           ├── FamilyGroupNode.vue    # Khung nền cụm gia đình
│           ├── PersonNode.vue         # Card node
│           ├── SpouseConnector.vue    # Midpoint node 💍
│           ├── PersonDrawer.vue       # Slide-in detail
│           ├── PersonForm.vue         # Add/edit modal
│           ├── AvatarCropper.vue      # Canvas crop
│           └── SearchableSelect.vue   # Combobox có dấu/không dấu
├── Dockerfile                         # 3-stage build
├── docker-compose.yml
├── fly.toml
└── .github/workflows/deploy.yml
```

---

## Components chính

### `FamilyTreeCanvas.vue`
Canvas VueFlow full-screen. Gọi `GET /api/tree` khi mount. Render 3 node type: `person`, `spouseConnector`, `familyGroup`. Quản lý collapse/expand nhánh con (ẩn descendants theo BFS từ node bị collapse). `familyGroup` nodes không tương tác (zIndex −1).

### `PersonNode.vue`
Card hiển thị: ảnh đại diện (64px tròn), badge thế hệ, họ tên, tên gọi, ngày sinh/mất. Nút ▼/▶ thu gọn nhánh nếu có con. Người đã mất hiển thị mờ hơn.

### `SpouseConnector.vue`
Node vô hình (30×30px) đặt ở giữa cặp vợ/chồng. Cạnh `spouse` kết nối mỗi người vào node này; cạnh `parentChild` xuất phát từ đây xuống con.

### `FamilyGroupNode.vue`
Node nền (non-interactive) vẽ khung xanh nhạt viền nét đứt quanh từng cụm gia đình. Kích thước = bounding box cụm + 24px padding.

### `PersonDrawer.vue`
Slide-in từ phải. Ảnh đại diện lớn, thông tin đầy đủ, tiểu sử, danh sách quan hệ (click để navigate). Nút Sửa cho editor+; nút Xóa cho admin.

### `PersonForm.vue`
Modal thêm/sửa. Combobox `SearchableSelect` để chọn cha/mẹ/vợ-chồng (tìm có dấu/không dấu). Thế hệ tự tính từ cha/mẹ. Section cấp quyền:
- Self-edit: vai trò khóa, chỉ đổi mật khẩu
- Editor editing others: chỉ cấp viewer, ẩn nếu người kia đã là editor/admin
- Admin: toàn quyền (viewer/editor/admin + mật khẩu)

### `SearchableSelect.vue`
Combobox custom: gõ để lọc, mũi tên lên/xuống để di chuyển, Enter để chọn, × để xóa. Dùng `Teleport to="body"` + `position: fixed` để thoát overflow của modal. Tìm kiếm chuẩn hóa: `NFD + strip combining marks + đ→d`.

### `AvatarCropper.vue`
Crop ảnh bằng Canvas API. Output: JPEG 256×256. Preview dạng tròn.

### `LoginPage.vue`
Bước 1: nhập SĐT → check-phone. Bước 2 (nếu editor/admin): nhập mật khẩu → login → JWT.

---

## REST API

### Auth
| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| POST | `/api/auth/check-phone` | — | `{phone}` → `{role}` |
| POST | `/api/auth/login` | — | `{phone, password?}` → `{token, role, personName, personId}` |

### Persons
| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/api/persons` | viewer+ | List all, sorted by generation + name |
| GET | `/api/persons/:id` | viewer+ | Single person |
| GET | `/api/persons/:id/relatives` | viewer+ | `{parents, children, spouses}` |
| GET | `/api/persons/:id/access` | editor+ | `{hasAccess, role}` |
| POST | `/api/persons` | editor+ | Create; upserts access_token nếu có grant |
| PUT | `/api/persons/:id` | editor+ | Update; editor không sửa được quyền admin/editor |
| DELETE | `/api/persons/:id` | admin | Xóa person + cascade |
| POST | `/api/persons/:id/avatar` | editor+ | Multipart; max 5MB; chỉ image/* |

### Relationships
| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| POST | `/api/relationships` | editor+ | `{personAId, personBId, type}` |
| DELETE | `/api/relationships/:id` | editor+ | |

### Tree
| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/api/tree` | viewer+ | `{nodes, edges}` — tọa độ đã tính sẵn |

### Stats
| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/api/stats` | — | `{totalVisits, onlineNow}` |
| POST | `/api/stats/ping` | viewer+ | Heartbeat; body `{newVisit: true}` lần đầu |
| POST | `/api/stats/leave` | viewer+ | Đánh dấu offline |

---

## Thuật toán layout cây (`treeLayout.ts`)

### Vấn đề cần giải
- Nhiều cụm gia đình không liên quan nhau → dagre đặt tất cả về gần (0,0) → chồng lấn
- Vợ/chồng cần đứng cạnh nhau → điều chỉnh sau dagre làm chồng lấn với node khác

### Giải pháp

**1. Union-Find (connected components)**
Nhóm tất cả người có quan hệ (bất kỳ loại) vào cùng một component. Mỗi component layout độc lập.

**2. Virtual couple node**
Thay vì đặt vợ/chồng riêng lẻ rồi điều chỉnh sau, tạo 1 node rộng gấp đôi cho dagre:
```
COUPLE_DAGRE_WIDTH = NODE_WIDTH × 2 + CONNECTOR_WIDTH + 2 × SPOUSE_CONN_GAP
                   = 230 × 2 + 30 + 2 × 10 = 510px
```
Dagre thấy cặp vợ chồng như 1 khối, đặt con cái chính xác bên dưới. Sau layout, tách node đôi thành 2 vị trí person (trái/phải).

**3. Dagre per-cluster**
```
g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80, marginx: 40, marginy: 40 })
```
Mỗi cụm chạy dagre riêng → không bao giờ bị ảnh hưởng bởi cụm khác.

**4. Cluster packing**
Xếp các cụm theo thứ tự giảm dần kích thước (lớn trước), từ trái sang phải, xuống hàng khi vượt `MAX_ROW_WIDTH = 3000px`. Khoảng cách giữa cụm: 80px ngang, 100px dọc.

**5. Family group node**
Mỗi cụm ≥2 người → emit 1 node `familyGroup` ở bounding box + 24px padding. VueFlow render nó với `zIndex: −1`.

---

## Docker & Deployment

### Production image (single container)
Express vừa serve API lẫn Vue static files (không có nginx riêng).

```
Dockerfile (3 stage):
├── Stage 1 — frontend-build (node:20-alpine)
│   └── npm ci + vite build → /app/frontend/dist/
│
├── Stage 2 — backend-build (node:20-alpine)
│   └── npm ci + prisma generate + tsc → /app/dist/src/, /app/dist/prisma/
│       (rootDir: "./" để compile cả prisma/seed.ts)
│
└── Stage 3 — production (node:20-alpine)
    ├── apk add openssl (Prisma cần để chạy migrate)
    ├── COPY node_modules, dist/, prisma/, frontend/dist/ → ./public
    ├── EXPOSE 3000
    └── CMD: npx prisma migrate deploy && node dist/src/server.js
```

**Lưu ý đường dẫn:** `rootDir: "./"` → output ở `dist/src/` (không phải `dist/`). `app.ts` dùng `path.join(__dirname, '../../public')`.

### fly.io
| Key | Giá trị |
|-----|---------|
| app | `justinlam-familytree` |
| region | `sin` (Singapore) |
| internal_port | `3000` |
| volume | `uploads` → `/data/uploads` |
| auto_stop | `true` |

### CI/CD
```
push main → actions/checkout + superfly/flyctl-actions → flyctl deploy --remote-only
```
Secret GitHub: `FLY_API_TOKEN`

---

## Quy tắc phân quyền chi tiết

| Tình huống | Hành vi |
|-----------|---------|
| Editor POST/PUT person có `grantAccess: true` | Backend force `grantRole = 'viewer'`, xóa `grantPassword` |
| Editor PUT person đã có role editor/admin | Backend xóa toàn bộ grant fields (không cho chạm) |
| Editor/Admin self-edit | Frontend lock role dropdown, chỉ hiện input mật khẩu (optional) |
| Admin POST/PUT | Toàn quyền grant viewer/editor/admin + password |
| Admin DELETE | Cascade xóa person + relationships (Prisma cascade) |
