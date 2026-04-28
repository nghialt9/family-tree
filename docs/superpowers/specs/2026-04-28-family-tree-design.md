# Family Tree App — Design Spec
**Date:** 2026-04-28  
**App name (fly.io):** `justinlam-familytree`  
**URL:** `https://justinlam-familytree.fly.dev`

---

## Overview

A multi-generation Vietnamese family tree web app for the Lâm family. Stores rich biographical data for each family member across generations, visualizes parent-child and spouse relationships interactively, restricts access via phone number authentication, and supports full CRUD through the UI. Deployed on fly.io with Docker.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Vue 3 + Vite |
| Tree rendering | VueFlow + dagre (layout algorithm) |
| State management | Pinia |
| Backend | Node.js + Express |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| Auth | JWT (phone-based, no OTP) |
| Container | Docker (multi-stage) + Docker Compose |
| Hosting | fly.io — Singapore region |
| CI/CD | GitHub Actions → flyctl deploy |

---

## Authentication

Two roles gated by phone number:

- **viewer** — enters phone → receives JWT → can view full family tree and person details
- **admin** — enters phone → receives JWT with `role: admin` → can add, edit, delete persons and relationships

Phone numbers + roles are stored in `access_tokens` table. No OTP — if the number matches a record, access is granted.

**Auto-provisioning**: When an admin adds or edits a person with a phone number filled in, a checkbox "Cấp quyền truy cập" appears. If checked, the admin selects a role (viewer/admin) and the backend upserts a record into `access_tokens` in the same transaction as the person save.

---

## Database Schema

### `persons`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| full_name | VARCHAR | Họ và tên |
| nickname | VARCHAR NULL | Tên thường gọi |
| gender | ENUM(male, female) | |
| birth_date | DATE NULL | Ngày sinh |
| death_date | DATE NULL | Ngày mất |
| phone | VARCHAR NULL | Số điện thoại |
| address | TEXT NULL | Địa chỉ |
| bio | TEXT NULL | Tiểu sử / ghi chú |
| avatar_url | VARCHAR NULL | Path ảnh: `/data/avatars/<uuid>.jpg` trên fly.io volume |
| generation | INT | Thế hệ (1, 2, 3…) |
| is_alive | BOOLEAN | Default true; backend sets false automatically when death_date is provided |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### `relationships`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| person_a_id | UUID FK → persons | Cha/mẹ (parent_child) hoặc người A (spouse) |
| person_b_id | UUID FK → persons | Con (parent_child) hoặc người B (spouse) |
| type | ENUM(parent_child, spouse) | |
| married_date | DATE NULL | Chỉ dùng khi type=spouse |
| divorced_date | DATE NULL | Chỉ dùng khi type=spouse |

### `access_tokens`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| phone | VARCHAR UNIQUE | Số điện thoại |
| role | ENUM(viewer, admin) | |
| label | VARCHAR NULL | Tên hiển thị ("Chú Lăng", "Admin"…) |
| person_id | UUID FK NULL → persons | Liên kết tới bản ghi người (nếu có) |

---

## Project Structure

```
family-tree/
├── frontend/               Vue 3 + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── FamilyTreeCanvas.vue
│   │   │   ├── PersonNode.vue
│   │   │   ├── SpouseConnector.vue
│   │   │   ├── PersonDrawer.vue
│   │   │   └── PersonForm.vue
│   │   ├── pages/
│   │   │   ├── LoginPage.vue
│   │   │   └── TreePage.vue
│   │   ├── stores/         Pinia
│   │   └── api/            Axios wrappers
│   ├── Dockerfile          multi-stage: build → nginx
│   └── nginx.conf
├── backend/                Node.js + Express
│   ├── src/
│   │   ├── routes/         persons, relationships, tree, auth
│   │   ├── middleware/      jwt auth, role guard
│   │   └── services/       tree layout (dagre), person service
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts         import dữ liệu từ treant-js cũ
│   └── Dockerfile
├── fly.toml
├── docker-compose.yml
└── .github/workflows/deploy.yml
```

---

## Key Components

### `FamilyTreeCanvas.vue`
VueFlow canvas full-screen. Calls `GET /api/tree` on mount. Renders two custom node types (`person`, `spouseConnector`) and two edge types (`parentChild`, `spouse`). Supports zoom, pan, and branch collapse.

### `PersonNode.vue`
Rich card (style C). Shows: avatar, full name, nickname, generation badge, birth/death dates, phone, alive/deceased indicator, "Chi tiết ▼" button. Clicking the button opens `PersonDrawer`. Admin users see an edit icon.

### `SpouseConnector.vue`
Invisible node placed horizontally between two spouse nodes. Spouse edges connect each spouse to this node. Parent-child edges originate from this node downward. This ensures children visually descend from the midpoint of the couple.

### `PersonDrawer.vue`
Slide-in panel from the right. Shows: large avatar, full bio, address, all children (linked), spouse link, parents link. Admin-only: "Sửa" and "Xóa" buttons.

### `PersonForm.vue`
Modal for add/edit. Fields: all `persons` columns. Dropdowns to select father, mother, spouse from existing persons list. If phone is filled: checkbox "Cấp quyền truy cập" → role selector (viewer/admin). On submit, backend saves person + upserts access_token in one transaction.

### `LoginPage.vue`
Single phone input. `POST /api/auth/login` → JWT stored in `localStorage` → redirect to `/`.

---

## REST API

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/auth/login | — | {phone} → {token, role} |

### Persons
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/persons | viewer+ | List all |
| GET | /api/persons/:id | viewer+ | Single person |
| GET | /api/persons/:id/relatives | viewer+ | Parents, children, spouse |
| POST | /api/persons | admin | Create; upserts access_token if grant flag set |
| PUT | /api/persons/:id | admin | Update; upserts access_token if grant flag set |
| DELETE | /api/persons/:id | admin | Delete person + relationships |
| POST | /api/persons/:id/avatar | admin | Upload avatar image |

### Relationships
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/relationships | admin | Create parent_child or spouse |
| DELETE | /api/relationships/:id | admin | Remove relationship |

### Tree
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/tree | viewer+ | Full tree: nodes + edges with dagre x/y coordinates pre-calculated |

---

## Tree Layout Algorithm

`GET /api/tree` builds the VueFlow graph server-side:
1. Fetch all persons + relationships from DB
2. For each spouse pair, create a virtual `spouseConnector` node positioned at midpoint
3. Run **dagre** (`rankdir: TB`) to assign x/y to all nodes
4. Return `{ nodes: [...], edges: [...] }` ready for VueFlow

---

## Docker & Deployment

**Local dev:**
```bash
docker-compose up
# frontend: http://localhost:80
# backend:  http://localhost:3000
```

**fly.io:**
- Region: `sin` (Singapore — closest to Vietnam)
- **Single fly.io app** `justinlam-familytree`: Express backend serves the built Vue static files from `frontend/dist/`. One Docker image, one `fly.toml`, no nginx on production.
- Avatar images stored on a fly.io persistent volume mounted at `/data/avatars`
- Postgres: `fly postgres create` → `fly postgres attach` with persistent volume
- Secrets: `DATABASE_URL`, `JWT_SECRET` via `fly secrets set`

**GitHub Actions** (`.github/workflows/deploy.yml`):
```
push to main
→ docker build
→ flyctl deploy
→ fly ssh console -C "npx prisma migrate deploy"
```

---

## Data Migration

`backend/prisma/seed.ts` imports all family data from the original `treant-js` collapsable example (the Lâm family: Thúi, Tiếu, Liếu, Lăng, Măng, Non, Nước, Đẹp, Pha, Qua and their descendants). Run once after first deploy: `npx prisma db seed`.

---

## Access Control Summary

| Action | Requires |
|---|---|
| View family tree | Valid phone in access_tokens (any role) |
| View person detail | viewer+ |
| Add / edit / delete person | admin role |
| Add / delete relationship | admin role |
| Grant access when saving person | admin role |
