# 🌳 Gia Phả Họ Lâm

Ứng dụng web lưu trữ và hiển thị gia phả nhiều thế hệ dưới dạng sơ đồ cây tương tác. Hỗ trợ quản lý thông tin thành viên, quan hệ gia đình, ảnh đại diện và phân quyền truy cập theo số điện thoại.

**Live:** https://justinlam-familytree.fly.dev

---

## Tính năng

### Sơ đồ cây
- Hiển thị tất cả thành viên dưới dạng node trên canvas tương tác (VueFlow + dagre layout)
- Kết nối vợ/chồng qua node 💍 ở giữa, con cái kéo xuống phía dưới
- Thu gọn / mở rộng nhánh con bằng nút ▼ / ▶ (hiển thị số người ẩn)
- Zoom tự do, kéo thả, minimap, hiển thị % zoom hiện tại
- Khi tải trang: tự động focus vào node của người dùng đang đăng nhập (nếu có), hoặc thế hệ 1
- Node hiển thị: ảnh đại diện (64px), thế hệ, họ tên, tên gọi, ngày sinh/mất

### Quản lý thành viên (Admin)
- Thêm / sửa / xóa người (họ tên, tên gọi, giới tính, ngày sinh/mất, địa chỉ, tiểu sử, thế hệ)
- Upload và crop ảnh đại diện ngay trong trình duyệt (canvas 256×256 JPEG, hình tròn)
- Thiết lập quan hệ: cha, mẹ, vợ/chồng khi thêm/sửa
- Cấp quyền truy cập: gắn số điện thoại → tạo AccessToken (viewer hoặc admin)
- Admin cần mật khẩu bcrypt; viewer chỉ cần số điện thoại

### Xem chi tiết (Drawer)
- Click node → drawer bên phải hiện ảnh lớn, thông tin đầy đủ, tiểu sử
- Danh sách cha/mẹ, vợ/chồng, con cái (click để điều hướng)
- Nút Sửa / Xóa nếu là Admin
- Tự động reload sau khi lưu (không cần đóng-mở lại)

### Xác thực
- Đăng nhập bằng số điện thoại (OTP-free: phone chỉ là username)
- Hai vai trò: **viewer** (chỉ xem) và **admin** (thêm/sửa/xóa)
- JWT lưu ở localStorage, tự động đính vào mọi request
- Token hết hạn 30 ngày (cấu hình qua `JWT_EXPIRES_IN`)

### Thống kê
- Tổng lượt xem (lũy kế, lưu vào DB)
- Số người đang online (in-memory, window 2 phút, dùng token ID làm key)
- Cập nhật realtime mỗi 60 giây; khi đóng tab → gửi leave ngay (keepalive fetch)
- Tên / SĐT người đang đăng nhập hiển thị ở thanh toolbar

---

## Kiến trúc & Tech stack

| Layer | Công nghệ |
|-------|-----------|
| Frontend | Vue 3 + Vite + TypeScript |
| Canvas | @vue-flow/core (VueFlow) + @dagrejs/dagre |
| State | Pinia |
| Backend | Express + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Upload | multer → persistent volume |
| Deploy | fly.io (Singapore) |
| CI/CD | GitHub Actions → flyctl |

### Cấu trúc thư mục

```
family-tree/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # Person, Relationship, AccessToken, SiteStats
│   │   └── seed.ts            # Dữ liệu mẫu họ Lâm
│   └── src/
│       ├── app.ts             # Express app, static serving
│       ├── server.ts          # HTTP server, PORT
│       ├── lib/jwt.ts         # signToken / verifyToken
│       ├── middleware/auth.ts # requireViewer / requireAdmin
│       ├── routes/
│       │   ├── auth.ts        # POST /check-phone, /login
│       │   ├── persons.ts     # CRUD + avatar upload
│       │   ├── relationships.ts
│       │   ├── tree.ts        # GET /tree → nodes + edges
│       │   └── stats.ts       # ping / leave / get
│       └── services/
│           ├── personService.ts   # createPerson / updatePerson + AccessToken
│           └── treeLayout.ts      # dagre layout → VueFlow nodes/edges
├── frontend/
│   └── src/
│       ├── api/index.ts       # axios instance + API helpers
│       ├── stores/auth.ts     # Pinia auth store
│       ├── pages/
│       │   ├── LoginPage.vue
│       │   └── TreePage.vue
│       └── components/
│           ├── FamilyTreeCanvas.vue  # VueFlow canvas, collapse logic
│           ├── PersonNode.vue        # Custom node component
│           ├── SpouseConnector.vue   # Node 💍 kết nối vợ chồng
│           ├── PersonDrawer.vue      # Drawer chi tiết
│           ├── PersonForm.vue        # Modal thêm/sửa
│           └── AvatarCropper.vue     # Crop ảnh bằng Canvas API
├── Dockerfile                 # 3-stage: frontend → backend → production
├── fly.toml                   # fly.io config, volume /data/uploads
└── .github/workflows/deploy.yml
```

---

## Chạy local với `npm run dev`

> **Yêu cầu:** Node.js 20+, PostgreSQL đang chạy (hoặc dùng Docker cho DB)

**Bước 1 — Khởi động PostgreSQL (Docker)**
```bash
docker run -d --name pg-familytree \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=family_tree \
  -p 5432:5432 \
  postgres:16-alpine
```

**Bước 2 — Tạo file `.env` cho backend**
```bash
# backend/.env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/family_tree
JWT_SECRET=dev-secret-change-me
JWT_EXPIRES_IN=7d
UPLOAD_DIR=./uploads
```

**Bước 3 — Cài dependencies và migrate DB**
```bash
cd backend
npm install
npx prisma migrate deploy   # tạo bảng
npx prisma generate         # sinh Prisma Client (chạy lại nếu thay schema)
```

**Bước 4 — (Tùy chọn) Seed dữ liệu mẫu**
```bash
# Vẫn trong backend/
npx ts-node --skip-project prisma/seed.ts
```

**Bước 5 — Chạy backend**
```bash
# Vẫn trong backend/
npm run dev        # nodemon + ts-node, hot reload, cổng 3000
```

**Bước 6 — Chạy frontend (terminal mới)**
```bash
cd frontend
npm install
npm run dev        # Vite dev server, cổng 5173, proxy /api → localhost:3000
```

Mở trình duyệt: **http://localhost:5173**

> Vite proxy `/api` và `/uploads` sang cổng 3000 nên không cần CORS thêm.

---

## Chạy local với Docker (production image)

> **Yêu cầu:** Docker Desktop đang chạy

**Bước 1 — Build image**
```bash
# Tại thư mục gốc family-tree/
docker build -t family-tree .
```

**Bước 2 — Khởi động PostgreSQL**
```bash
docker run -d --name pg-familytree \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=family_tree \
  -p 5432:5432 \
  postgres:16-alpine
```

**Bước 3 — Chạy app**
```bash
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/family_tree" \
  -e JWT_SECRET="dev-secret-change-me" \
  -e JWT_EXPIRES_IN="7d" \
  -e UPLOAD_DIR="/data/uploads" \
  -v "$(pwd)/uploads:/data/uploads" \
  family-tree
```

> `host.docker.internal` trỏ vào máy host — hoạt động trên Mac/Windows. Trên Linux thêm `--add-host=host.docker.internal:host-gateway`.

Mở trình duyệt: **http://localhost:3000**

**Seed dữ liệu (lần đầu)**
```bash
docker exec <container_id> node dist/seed.js
# Hoặc lấy container ID:
docker ps | grep family-tree
```

---

## Deploy lên production (fly.io)

### Yêu cầu ban đầu
- Tài khoản [fly.io](https://fly.io) (miễn phí)
- Cài `flyctl`: https://fly.io/docs/hands-on/install-flyctl/
- Tài khoản GitHub, repo đã push code lên

### Lần đầu deploy (chạy 1 lần)

**Bước 1 — Đăng nhập fly.io**
```bash
flyctl auth login
```

**Bước 2 — Tạo app**
```bash
flyctl apps create justinlam-familytree
```

**Bước 3 — Tạo PostgreSQL**
```bash
flyctl postgres create \
  --name justinlam-familytree-db \
  --region sin \
  --initial-cluster-size 1 \
  --vm-size shared-cpu-1x \
  --volume-size 1

flyctl postgres attach justinlam-familytree-db \
  --app justinlam-familytree
# → Tự động set biến môi trường DATABASE_URL cho app
```

**Bước 4 — Tạo volume lưu ảnh upload**
```bash
flyctl volumes create uploads \
  --app justinlam-familytree \
  --region sin \
  --size 1
```

**Bước 5 — Đặt secrets**
```bash
flyctl secrets set \
  JWT_SECRET="$(openssl rand -hex 32)" \
  JWT_EXPIRES_IN="30d" \
  --app justinlam-familytree
```

**Bước 6 — Cấu hình GitHub Actions**

Lấy deploy token:
```bash
flyctl tokens create deploy --name github-actions
```

Vào **GitHub repo → Settings → Secrets and variables → Actions**, thêm secret:
- `FLY_API_TOKEN` = token vừa copy

**Bước 7 — Push để deploy**
```bash
git push origin main
```

GitHub Actions sẽ tự build Docker image và deploy lên fly.io.  
App live tại: **https://justinlam-familytree.fly.dev**

**Bước 8 — Seed dữ liệu lần đầu**
```bash
flyctl ssh console --app justinlam-familytree -C "node dist/seed.js"
```

### Các lần deploy sau

Chỉ cần push code:
```bash
git push origin main
# → GitHub Actions tự deploy
```

Hoặc deploy thủ công:
```bash
flyctl deploy --remote-only --app justinlam-familytree
```

### Lệnh quản lý fly.io thường dùng

```bash
# Xem logs realtime
flyctl logs --app justinlam-familytree

# Xem trạng thái machines
flyctl status --app justinlam-familytree

# SSH vào container
flyctl ssh console --app justinlam-familytree

# Xem DB
flyctl postgres connect --app justinlam-familytree-db

# Scale (tắt khi không dùng → tự khởi động khi có request)
flyctl scale count 0 --app justinlam-familytree
```

---

## Biến môi trường

| Biến | Mô tả | Mặc định |
|------|-------|---------|
| `DATABASE_URL` | PostgreSQL connection string | **Bắt buộc** |
| `JWT_SECRET` | Secret ký JWT | **Bắt buộc** |
| `JWT_EXPIRES_IN` | Thời hạn token | `7d` |
| `UPLOAD_DIR` | Thư mục lưu ảnh upload | `./uploads` |
| `PORT` | Cổng backend | `3000` |

---

## API chính

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| POST | `/api/auth/check-phone` | — | Kiểm tra SĐT có trong hệ thống |
| POST | `/api/auth/login` | — | Đăng nhập, trả JWT |
| GET | `/api/tree` | viewer | Lấy toàn bộ nodes + edges cho canvas |
| GET | `/api/persons` | viewer | Danh sách tất cả người |
| GET | `/api/persons/:id` | viewer | Chi tiết 1 người |
| GET | `/api/persons/:id/relatives` | viewer | Cha/mẹ, con, vợ/chồng |
| POST | `/api/persons` | admin | Thêm người mới |
| PUT | `/api/persons/:id` | admin | Cập nhật thông tin |
| DELETE | `/api/persons/:id` | admin | Xóa người |
| POST | `/api/persons/:id/avatar` | admin | Upload ảnh đại diện |
| POST | `/api/relationships` | admin | Thêm quan hệ |
| DELETE | `/api/relationships/:id` | admin | Xóa quan hệ |
| POST | `/api/stats/ping` | viewer | Heartbeat (60s/lần) |
| POST | `/api/stats/leave` | viewer | Đánh dấu offline khi đóng tab |
| GET | `/api/stats` | — | Tổng lượt xem + online now |
