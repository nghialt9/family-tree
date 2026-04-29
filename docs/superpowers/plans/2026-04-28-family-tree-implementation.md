# Family Tree App — Implementation Plan (As-Built)

> **Status:** COMPLETED — 2026-04-29. All tasks implemented and deployed.

**Goal:** Build justinlam-familytree — a multi-generation Vietnamese family tree app with Vue 3 + VueFlow frontend, Express + PostgreSQL backend, phone-based JWT auth (3 roles: viewer / editor / admin), full CRUD UI, and single-container Docker deployment on fly.io.

**Architecture:** Single Express app serves both `/api/*` REST endpoints and the built Vue 3 static files from `./public`. VueFlow renders the tree client-side using dagre-computed positions returned by `GET /api/tree`. Union-Find groups persons into family clusters; each cluster runs dagre independently; virtual couple nodes ensure spouse/child positioning is correct without post-layout adjustments.

**Tech Stack:** Vue 3 + Vite + @vue-flow/core + Pinia + Axios · Node.js + Express + Prisma + PostgreSQL + TypeScript · bcryptjs + jsonwebtoken · @dagrejs/dagre · multer · Docker multi-stage + fly.io

---

## File Map (as-built)

### Backend (`backend/`)
| File | Responsibility |
|---|---|
| `src/server.ts` | HTTP server entry, port binding |
| `src/app.ts` | Express setup, middleware, routes, static file serving (`../../public`) |
| `src/lib/jwt.ts` | `signToken` / `verifyToken` |
| `src/lib/prisma.ts` | Prisma singleton client |
| `src/middleware/auth.ts` | `requireViewer`, `requireEditor`, `requireAdmin` middleware |
| `src/routes/auth.ts` | POST /api/auth/check-phone · POST /api/auth/login |
| `src/routes/persons.ts` | All /api/persons/* routes (CRUD + avatar + access) |
| `src/routes/relationships.ts` | POST/DELETE /api/relationships |
| `src/routes/tree.ts` | GET /api/tree |
| `src/routes/stats.ts` | GET /api/stats · POST /api/stats/ping · POST /api/stats/leave |
| `src/services/treeLayout.ts` | Union-Find clustering + dagre layout per cluster + virtual couple nodes |
| `src/services/personService.ts` | createPerson / updatePerson + access_token upsert in one transaction |
| `prisma/schema.prisma` | Person, Relationship, AccessToken, SiteStats models |
| `prisma/seed.ts` | Full Lâm family seed data (generation 1–4) |
| `prisma/migrations/` | Prisma migration history |

### Frontend (`frontend/src/`)
| File | Responsibility |
|---|---|
| `main.ts` | App bootstrap |
| `router/index.ts` | Routes with auth navigation guard |
| `api/index.ts` | Axios instance + typed API helpers |
| `stores/auth.ts` | Pinia: token, role, linkedPersonId, personName, userPhone; isEditor / isAdmin getters |
| `pages/LoginPage.vue` | Two-step login: phone → check-phone → (editor/admin only) password |
| `pages/TreePage.vue` | Toolbar, hero banner, FamilyTreeCanvas, PersonDrawer, PersonForm, stats ping |
| `components/FamilyTreeCanvas.vue` | VueFlow canvas, loads `/api/tree`, collapse/expand, node types |
| `components/FamilyGroupNode.vue` | Non-interactive background panel for family clusters (zIndex -1) |
| `components/PersonNode.vue` | Card node: avatar 64px, generation badge, name, nickname, dates; collapse button |
| `components/SpouseConnector.vue` | Invisible 30×30 midpoint node between spouses |
| `components/PersonDrawer.vue` | Slide-in detail panel; relatives list with navigation; edit/delete buttons |
| `components/PersonForm.vue` | Add/edit modal; SearchableSelect for parents/spouse; role-aware access section; isSelfEdit logic |
| `components/AvatarCropper.vue` | Canvas-based image crop → 256×256 JPEG |
| `components/SearchableSelect.vue` | Combobox with Vietnamese diacritic-insensitive search; Teleport to body |

### Root
| File | Responsibility |
|---|---|
| `Dockerfile` | 3-stage: frontend build → backend build → production image |
| `docker-compose.yml` | Local dev: backend + postgres |
| `fly.toml` | fly.io config (app: justinlam-familytree, region: sin, volume: uploads) |
| `.github/workflows/deploy.yml` | CI/CD: push main → flyctl deploy |

---

## Completed Tasks

### Task 1: Backend scaffold ✅
- Express app with TypeScript, Prisma, dotenv, multer
- `tsconfig.json` with `rootDir: "./"` → output at `dist/src/` and `dist/prisma/`
- Static serving: `path.join(__dirname, '../../public')`
- `docker-compose.yml` for local postgres

### Task 2: Database schema & migrations ✅
- `Person` model: id (cuid), fullName, nickname, gender (ENUM), birthDate, deathDate, phone, address, bio, avatarUrl, generation, isAlive (computed from !deathDate), timestamps
- `Relationship` model: id, personAId, personBId, type (ENUM: parent_child/spouse), marriedDate, divorcedDate; indexes on personAId, personBId, type
- `AccessToken` model: id, phone (UNIQUE), role (ENUM: viewer/editor/admin), label, passwordHash (NULL for viewer), personId (FK UNIQUE, nullable)
- `SiteStats` model: id (fixed "global"), totalVisits INT

### Task 3: Auth routes ✅
- `POST /api/auth/check-phone` — returns `{role}` or `{role: null}` for unknown phone
- `POST /api/auth/login` — viewer: phone only; editor/admin: phone + bcrypt password check → JWT with `{sub, role, personId}`
- JWT middleware: `requireViewer`, `requireEditor`, `requireAdmin`

### Task 4: Persons routes ✅
- `GET /api/persons` — viewer+, sorted generation+name
- `GET /api/persons/:id` — viewer+
- `GET /api/persons/:id/relatives` — viewer+, returns `{parents, children, spouses}` with `relationshipId`
- `GET /api/persons/:id/access` — editor+, returns `{hasAccess, role}`
- `POST /api/persons` — editor+; editor forced to `grantRole: viewer`
- `PUT /api/persons/:id` — editor+; editor cannot modify admin/editor accounts (backend strips grant fields if existing role is privileged)
- `DELETE /api/persons/:id` — admin only; cascade via Prisma
- `POST /api/persons/:id/avatar` — editor+; multer 5MB; saves to UPLOAD_DIR; returns updated person

### Task 5: Relationships routes ✅
- `POST /api/relationships` — editor+; `{personAId, personBId, type}`
- `DELETE /api/relationships/:id` — editor+

### Task 6: Tree layout service ✅
**Algorithm (5 stages):**
1. **Union-Find** — group all persons into connected components via any relationship
2. **Virtual couple node** — each married pair represented as one wide dagre node (`COUPLE_DAGRE_WIDTH = 510px = 230×2 + 30 + 2×10`); after layout, split into left/right positions
3. **Dagre per cluster** — each cluster runs dagre independently (`rankdir: TB, nodesep: 50, ranksep: 80`); no cross-cluster interference
4. **Cluster packing** — clusters sorted by descending size, packed left-to-right, new row at `MAX_ROW_WIDTH = 3000px`; gap 80px horizontal, 100px vertical
5. **FamilyGroup node** — clusters ≥2 persons emit one `familyGroup` node at bounding box + 24px padding

**Key constants:** `NODE_WIDTH=230, NODE_HEIGHT=120, CONNECTOR_WIDTH=30, SPOUSE_CONN_GAP=10, COUPLE_DAGRE_WIDTH=510, GROUP_PAD=24`

### Task 7: Stats routes ✅
- `GET /api/stats` — public; returns `{totalVisits, onlineNow}`
- `POST /api/stats/ping` — viewer+; `{newVisit: true}` increments totalVisits; updates online map (token → timestamp, 2-min window)
- `POST /api/stats/leave` — viewer+; removes token from online map

### Task 8: Frontend — VueFlow canvas ✅
- `FamilyTreeCanvas.vue`: loads `/api/tree`; node types: `person` (PersonNode), `spouseConnector` (SpouseConnector), `familyGroup` (FamilyGroupNode)
- `familyGroup` nodes rendered at `zIndex: -1`, non-interactive
- Collapse/expand: BFS from node downward; hides/shows descendant nodes; shows count badge
- Auto-focus: to linked person node on mount, or to generation-1 node if not linked

### Task 9: Frontend — PersonNode ✅
- Avatar 64px round (falls back to initials)
- Generation badge (colored by generation)
- Full name + nickname
- Birth/death dates; deceased persons rendered at 60% opacity
- Collapse button (▼/▶) shown when person has children

### Task 10: Frontend — FamilyGroupNode ✅ (added during layout iteration)
- Non-interactive 100% w/h `<div>` with light blue dashed border
- `pointer-events: none` to pass through all interactions to nodes beneath
- Data: `{width, height}` from server layout
- `zIndex: -1` set by FamilyTreeCanvas display logic

### Task 11: Frontend — PersonDrawer ✅
- Slide-in from right on node click
- Large avatar, full details, bio, relatives list
- Click relative name → navigate (close drawer, open new)
- Editor: "Sửa" button; Admin: "Xóa" button with confirm

### Task 12: Frontend — PersonForm ✅
**Access section logic (role-aware, 3 paths):**
- **Self-edit** (`isSelfEdit`): role field locked (display only via `roleLabel()`), optional password input only
- **Admin editing others**: full access section — viewer/editor/admin dropdown + password field for editor/admin roles
- **Editor editing others**: access section hidden if existing role is editor/admin (`canEditAccess` computed); if shown, role forced to viewer; no password field
- `existingAccessRole` ref populated from `GET /api/persons/:id/access` in watch
- `SearchableSelect` combobox for cha/mẹ/vợ/chồng selection (diacritic-insensitive)
- `AvatarCropper` inline crop → JPEG → separate avatar upload call
- Generation auto-calculated from selected parent

### Task 13: Frontend — Mobile responsive ✅
- `TreePage.vue`: hide `.stats` on ≤640px; shrink toolbar padding; compact btn padding
- `PersonForm.vue`: single-column form grid on ≤560px

### Task 14: Docker & CI/CD ✅
- 3-stage Dockerfile: stage 1 (frontend-build), stage 2 (backend-build with `rootDir: ./`), stage 3 (production with openssl for Prisma migrate)
- `CMD: npx prisma migrate deploy && node dist/src/server.js`
- `fly.toml`: app `justinlam-familytree`, region `sin`, internal_port 3000, volume `uploads → /data/uploads`, auto_stop true
- GitHub Actions: `push main → flyctl deploy --remote-only`; secret: `FLY_API_TOKEN`

### Task 15: Seed data ✅
- `prisma/seed.ts`: Lâm family 4 generations with real-looking data
- Run via: `npx ts-node --skip-project prisma/seed.ts` (dev) or `node dist/prisma/seed.js` (production)

---

## Access Control Rules (as-built)

| Situation | Backend behavior |
|---|---|
| Editor POST/PUT with `grantAccess: true` | Force `grantRole = 'viewer'`, delete `grantPassword` |
| Editor PUT person with existing role editor/admin | Strip all grant fields entirely |
| Self-edit (any role) | Frontend locks role dropdown; only password field shown; backend processes normally |
| Admin POST/PUT | Full access grant: viewer/editor/admin + optional password |
| Admin DELETE | Cascade delete person + all relationships (Prisma cascade) |

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `JWT_EXPIRES_IN` | Token expiry | No (default: 30d) |
| `UPLOAD_DIR` | Avatar upload directory | No (default: ./uploads) |
| `PORT` | Server port | No (default: 3000) |
