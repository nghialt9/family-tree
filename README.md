# 🌳 Gia Phả Họ Lâm

Ứng dụng web lưu trữ và hiển thị gia phả nhiều thế hệ dưới dạng sơ đồ cây tương tác.  
Hỗ trợ quản lý thành viên, quan hệ gia đình, ảnh đại diện và phân quyền theo số điện thoại.

**Live:** https://justinlam-familytree.fly.dev

---

## Tính năng

### Sơ đồ cây tương tác
- Canvas toàn màn hình (VueFlow) với zoom, kéo thả, minimap, chỉ số % zoom
- Layout tự động bằng **dagre** — mỗi nhóm gia đình được xếp thành cụm riêng biệt, không chồng lấn
- Vợ/chồng đứng cạnh nhau, nối qua node 💍 ở giữa; con cái kéo xuống từ midpoint
- Mỗi cụm gia đình có khung nền xanh nhạt để phân biệt trực quan
- Thu gọn / mở rộng nhánh con bằng nút ▼ / ▶ (hiển thị số người đang ẩn)
- Tự động focus vào node của người đăng nhập, hoặc thế hệ 1 nếu không xác định được
- Node hiển thị: ảnh đại diện (64px), thế hệ, họ tên, tên gọi, ngày sinh/mất

### Quản lý thành viên
| Hành động | Viewer | Editor | Admin |
|-----------|:------:|:------:|:-----:|
| Xem cây, xem chi tiết | ✓ | ✓ | ✓ |
| Thêm / sửa người | — | ✓ | ✓ |
| Upload ảnh đại diện | — | ✓ | ✓ |
| Thêm / xóa quan hệ | — | ✓ | ✓ |
| Cấp quyền **viewer** | — | ✓ | ✓ |
| Cấp quyền **editor / admin** | — | — | ✓ |
| Xóa người | — | — | ✓ |

- Thêm/sửa người: họ tên, tên gọi, giới tính, ngày sinh/mất, địa chỉ, tiểu sử, thế hệ
- Upload và crop ảnh đại diện ngay trong trình duyệt (canvas 256×256 JPEG, preview tròn)
- Combobox tìm kiếm có dấu/không dấu khi chọn cha, mẹ, vợ/chồng
- Thế hệ tự động tính từ cha/mẹ đã chọn (khi thêm mới)
- Quan hệ được lưu ngay khi submit form (không cần bước riêng)

### Phân quyền & Bảo mật
- **3 vai trò:** `viewer` · `editor` · `admin`
- Đăng nhập bằng số điện thoại; viewer chỉ cần SĐT; editor/admin cần mật khẩu bcrypt
- JWT lưu tại `localStorage`, tự đính vào mọi request; hết hạn 30 ngày
- Editor không thể thay đổi quyền của tài khoản editor/admin khác
- Khi tự sửa hồ sơ của mình: vai trò bị khóa, chỉ được đổi mật khẩu

### Drawer chi tiết
- Click vào node → drawer trượt từ phải, hiện ảnh lớn, tiểu sử, danh sách cha/mẹ, con cái, vợ/chồng
- Click tên quan hệ để điều hướng đến node đó
- Editor: nút Sửa. Admin: thêm nút Xóa

### Thống kê
- Tổng lượt xem (lũy kế, lưu DB)
- Số người đang online (in-memory, cửa sổ 2 phút)
- Cập nhật tự động 60 giây/lần; đóng tab → gửi leave ngay (keepalive fetch)

---

## Kiến trúc & Tech stack

| Layer | Công nghệ |
|-------|-----------|
| Frontend | Vue 3 + Vite + TypeScript |
| Canvas | @vue-flow/core + @dagrejs/dagre |
| State | Pinia |
| Backend | Express + TypeScript |
| Database | PostgreSQL 16 + Prisma ORM |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Upload | multer → persistent volume |
| Deploy | fly.io (Singapore) |
| CI/CD | GitHub Actions → flyctl |

### Cấu trúc thư mục

```
family-tree/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Person, Relationship, AccessToken, SiteStats
│   │   ├── seed.ts                # Dữ liệu mẫu họ Lâm
│   │   └── migrations/            # Prisma migration history
│   └── src/
│       ├── app.ts                 # Express setup, static serving
│       ├── server.ts              # HTTP server, port binding
│       ├── lib/jwt.ts             # signToken / verifyToken
│       ├── middleware/auth.ts     # requireViewer / requireEditor / requireAdmin
│       ├── routes/
│       │   ├── auth.ts            # check-phone, login
│       │   ├── persons.ts         # CRUD + avatar + access
│       │   ├── relationships.ts   # create / delete
│       │   ├── tree.ts            # GET /api/tree → nodes + edges
│       │   └── stats.ts           # ping / leave / get
│       └── services/
│           ├── personService.ts   # createPerson / updatePerson + AccessToken
│           └── treeLayout.ts      # dagre layout → VueFlow nodes/edges
├── frontend/
│   └── src/
│       ├── api/index.ts           # Axios instance + typed API helpers
│       ├── stores/auth.ts         # Pinia: token, role, linkedPersonId
│       ├── pages/
│       │   ├── LoginPage.vue      # Đăng nhập 2 bước
│       │   └── TreePage.vue       # Trang chính: canvas + drawer + form
│       └── components/
│           ├── FamilyTreeCanvas.vue   # VueFlow canvas, collapse logic
│           ├── FamilyGroupNode.vue    # Khung nền cụm gia đình
│           ├── PersonNode.vue         # Card node: ảnh, tên, ngày tháng
│           ├── SpouseConnector.vue    # Node 💍 giữa vợ chồng
│           ├── PersonDrawer.vue       # Drawer chi tiết
│           ├── PersonForm.vue         # Modal thêm/sửa
│           ├── AvatarCropper.vue      # Crop ảnh Canvas API
│           └── SearchableSelect.vue   # Combobox tìm kiếm có dấu/không dấu
├── Dockerfile                     # 3 stage: frontend build → backend build → production
├── docker-compose.yml             # Local: backend + postgres
├── fly.toml                       # fly.io config, volume /data/uploads
└── .github/workflows/deploy.yml   # CI/CD: push main → flyctl deploy
```

---

## Chạy local (dev mode)

> **Yêu cầu:** Node.js 20+, PostgreSQL đang chạy

**Bước 1 — Khởi động PostgreSQL (Docker)**
```bash
docker run -d --name pg-familytree \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=family_tree \
  -p 5432:5432 \
  postgres:16-alpine
```

**Bước 2 — Tạo `backend/.env`**
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/family_tree
JWT_SECRET=dev-secret-change-me
JWT_EXPIRES_IN=30d
UPLOAD_DIR=./uploads
```

**Bước 3 — Cài dependencies và migrate DB**
```bash
cd backend
npm install
npx prisma migrate deploy
npx prisma generate
```

**Bước 4 — (Tùy chọn) Seed dữ liệu mẫu**
```bash
npx ts-node --skip-project prisma/seed.ts
```

**Bước 5 — Chạy backend** (cổng 3000)
```bash
npm run dev
```

**Bước 6 — Chạy frontend** (terminal mới, cổng 5173)
```bash
cd frontend && npm install && npm run dev
```

Mở trình duyệt: **http://localhost:5173**

> Vite tự proxy `/api` và `/uploads` sang cổng 3000.

---

## Chạy local với Docker (production image)

```bash
# Build image
docker build -t family-tree .

# Chạy postgres (nếu chưa có)
docker run -d --name pg-familytree \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=family_tree -p 5432:5432 postgres:16-alpine

# Chạy app
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/family_tree" \
  -e JWT_SECRET="dev-secret-change-me" \
  -e JWT_EXPIRES_IN="30d" \
  -e UPLOAD_DIR="/data/uploads" \
  -v "$(pwd)/uploads:/data/uploads" \
  family-tree
```

> Trên Linux thêm `--add-host=host.docker.internal:host-gateway`.

Mở trình duyệt: **http://localhost:3000**

---

## Deploy lên production (fly.io)

### Lần đầu (chạy 1 lần)

```bash
# 1. Đăng nhập
flyctl auth login

# 2. Tạo app
flyctl apps create justinlam-familytree

# 3. Tạo PostgreSQL
flyctl postgres create \
  --name justinlam-familytree-db \
  --region sin --initial-cluster-size 1 \
  --vm-size shared-cpu-1x --volume-size 1
flyctl postgres attach justinlam-familytree-db --app justinlam-familytree

# 4. Volume lưu ảnh
flyctl volumes create uploads \
  --app justinlam-familytree --region sin --size 1

# 5. Secrets
flyctl secrets set \
  JWT_SECRET="$(openssl rand -hex 32)" \
  JWT_EXPIRES_IN="30d" \
  --app justinlam-familytree

  Task 10 (Fly.io secrets + deploy) requires your Resend API key. To complete the deployment, run these three commands
  yourself:

  fly secrets set RESEND_API_KEY=a
  fly secrets set RESEND_FROM=onboarding@resend.dev
  fly secrets set APP_URL=https://justinlam-familytree.fly.dev
  fly deploy

  fly secrets set CLOUDINARY_CLOUD_NAME=dcxdq2lyr
  fly secrets set CLOUDINARY_API_KEY=816583792127762
  fly secrets set CLOUDINARY_API_SECRET=a
  fly deploy

  fly secrets set GMAIL_USER=lamtrongnghia1990@gmail.com
  fly secrets set GMAIL_APP_PASSWORD=a
  fly deploy

  After deploy, watch fly logs for the line [cron] notification cron started (every 5 min) to confirm it's running.

# 6. Lấy deploy token cho GitHub Actions
flyctl tokens create deploy --name github-actions
# → Thêm vào GitHub repo: Settings → Secrets → FLY_API_TOKEN

# 7. Deploy lần đầu
git push origin main

# 8. Seed dữ liệu
flyctl ssh console --app justinlam-familytree -C "node dist/prisma/seed.js"
```

### Các lần sau

```bash
git push origin main   # GitHub Actions tự deploy
# Hoặc thủ công:
flyctl deploy --remote-only --app justinlam-familytree
```

### Lệnh quản lý thường dùng

```bash
flyctl logs --app justinlam-familytree          # Xem logs realtime
flyctl status --app justinlam-familytree        # Trạng thái máy
flyctl ssh console --app justinlam-familytree   # SSH vào container
flyctl postgres connect --app justinlam-familytree-db  # Kết nối DB
flyctl scale count 0 --app justinlam-familytree # Tạm dừng (tự wake khi có request)
```

---

## Biến môi trường

| Biến | Mô tả | Mặc định |
|------|-------|---------|
| `DATABASE_URL` | PostgreSQL connection string | **Bắt buộc** |
| `JWT_SECRET` | Secret ký JWT | **Bắt buộc** |
| `JWT_EXPIRES_IN` | Thời hạn token | `30d` |
| `UPLOAD_DIR` | Thư mục lưu ảnh upload | `./uploads` |
| `PORT` | Cổng backend | `3000` |

---

## API Reference

### Auth
| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| POST | `/api/auth/check-phone` | — | `{phone}` → `{role}` — bước 1 đăng nhập |
| POST | `/api/auth/login` | — | `{phone, password?}` → `{token, role, personName, personId}` |

### Persons
| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/api/persons` | viewer+ | Danh sách tất cả người |
| GET | `/api/persons/:id` | viewer+ | Chi tiết 1 người |
| GET | `/api/persons/:id/relatives` | viewer+ | Cha/mẹ, con, vợ/chồng |
| GET | `/api/persons/:id/access` | editor+ | Kiểm tra token của người |
| POST | `/api/persons` | editor+ | Tạo người mới (+ upsert token nếu có grant) |
| PUT | `/api/persons/:id` | editor+ | Cập nhật (+ upsert token nếu có grant) |
| DELETE | `/api/persons/:id` | admin | Xóa người + cascade relationships |
| POST | `/api/persons/:id/avatar` | editor+ | Upload ảnh đại diện (max 5MB) |

### Relationships
| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| POST | `/api/relationships` | editor+ | Tạo quan hệ `parent_child` hoặc `spouse` |
| DELETE | `/api/relationships/:id` | editor+ | Xóa quan hệ |

### Tree
| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/api/tree` | viewer+ | Toàn bộ nodes + edges đã tính tọa độ dagre |

### Stats
| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/api/stats` | — | `{totalVisits, onlineNow}` |
| POST | `/api/stats/ping` | viewer+ | Heartbeat 60s; `{newVisit: true}` để tăng counter |
| POST | `/api/stats/leave` | viewer+ | Đánh dấu offline khi đóng tab |

---

## Thuật toán layout cây

`treeLayout.ts` xây dựng graph VueFlow phía server:

1. **Union-Find** — phân nhóm tất cả người vào connected component (cụm gia đình) qua bất kỳ quan hệ nào
2. **Virtual couple node** — mỗi cặp vợ/chồng được đại diện bởi 1 node rộng gấp đôi trong dagre (`2×NODE_WIDTH + connector + gaps`), giúp dagre đặt con cái chính xác bên dưới không cần điều chỉnh sau
3. **Dagre layout per cluster** — mỗi cụm chạy dagre độc lập (`rankdir: TB`), tránh các cụm chồng lấn nhau
4. **Cluster packing** — các cụm được xếp từ trái sang phải, xuống hàng khi vượt 3000px, cách nhau 80px
5. **Family group node** — mỗi cụm ≥2 người có thêm 1 node nền (`familyGroup`) vẽ khung xanh phía sau
6. **Output** — `{ nodes, edges }` sẵn sàng cho VueFlow (tọa độ tuyệt đối)

---

© JustinLam — Gia Phả Họ Lâm
