# Email Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tự động gửi email cho tất cả Person có `email` trong DB khi sắp đến (7 ngày trước) hoặc đúng ngày sinh nhật / ngày giỗ của bất kỳ ai trong cây gia phả.

**Architecture:** Thêm `email String?` vào model `Person` và bảng `NotificationRun` để idempotency. Một `node-cron` chạy mỗi 5 phút trong Express app, kiểm tra giờ VN >= 7:00 và flag DB trước khi gửi batch email qua Resend API.

**Tech Stack:** Node.js/TypeScript, Prisma/PostgreSQL, `node-cron`, `resend` SDK, Vue 3.

---

## File Structure

| File | Vai trò |
|------|---------|
| `backend/prisma/schema.prisma` | Thêm `email` vào Person, thêm `NotificationRun` |
| `backend/src/services/emailService.ts` | Wrapper Resend + HTML builder |
| `backend/src/services/cronService.ts` | Logic cron: check flag, collect events, dispatch |
| `backend/src/services/tests/cronService.test.ts` | Unit tests cho pure functions + runNotifications |
| `backend/src/services/personService.ts` | Thêm `email` vào `CreatePersonInput` |
| `backend/src/server.ts` | Khởi động cronService sau `app.listen` |
| `frontend/src/components/PersonForm.vue` | Thêm field email |
| `frontend/src/components/PersonDrawer.vue` | Hiển thị email |

---

### Task 1: Install packages

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
cd backend
npm install resend node-cron
npm install --save-dev @types/node-cron
```

- [ ] **Step 2: Verify packages appear in package.json**

```bash
node -e "const p=require('./package.json'); console.log(p.dependencies.resend, p.dependencies['node-cron'], p.devDependencies['@types/node-cron'])"
```

Expected: three version strings printed, not `undefined`.

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore: install resend and node-cron"
```

---

### Task 2: DB schema — email field + NotificationRun

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add `email` field to Person and new model NotificationRun**

Open `backend/prisma/schema.prisma`. After the `avatarUrl` line inside `model Person`, add:

```prisma
  email       String?
```

After the `SiteStats` model at the end of the file, add:

```prisma
model NotificationRun {
  date    String    @id
  success Boolean   @default(false)
  sentAt  DateTime?

  @@map("notification_runs")
}
```

- [ ] **Step 2: Run migration**

```bash
cd backend
npx prisma migrate dev --name add-email-notifications
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` line in output.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add email field to Person and NotificationRun model"
```

---

### Task 3: emailService.ts

**Files:**
- Create: `backend/src/services/emailService.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/services/tests/emailService.test.ts`:

```typescript
import { buildEmailHtml } from '../emailService';

describe('buildEmailHtml', () => {
  it('includes today birthday in Hôm nay section', () => {
    const html = buildEmailHtml(
      [{ personName: 'Lâm Trọng Nghĩa', type: 'birthday', daysUntil: 0 }],
      '02/05/2026',
    );
    expect(html).toContain('Hôm nay');
    expect(html).toContain('Lâm Trọng Nghĩa');
    expect(html).toContain('🎂');
  });

  it('includes 7-day death in Sắp tới section', () => {
    const html = buildEmailHtml(
      [{ personName: 'Lâm Văn A', type: 'death', daysUntil: 7 }],
      '02/05/2026',
    );
    expect(html).toContain('Sắp tới');
    expect(html).toContain('Lâm Văn A');
    expect(html).toContain('🙏');
  });

  it('contains app URL link', () => {
    process.env.APP_URL = 'https://example.com';
    const html = buildEmailHtml([], '02/05/2026');
    expect(html).toContain('https://example.com');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend
npm test -- --testPathPattern=emailService
```

Expected: FAIL — `Cannot find module '../emailService'`

- [ ] **Step 3: Implement emailService.ts**

Create `backend/src/services/emailService.ts`:

```typescript
import { Resend } from 'resend';

const FROM = process.env.RESEND_FROM ?? 'noreply@example.com';
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

export interface NotificationEvent {
  personName: string;
  type: 'birthday' | 'death';
  daysUntil: number;
}

export function buildEmailHtml(events: NotificationEvent[], dateLabel: string): string {
  const today = events.filter(e => e.daysUntil === 0);
  const upcoming = events.filter(e => e.daysUntil === 7);

  const todayHtml = today.length
    ? `<h2 style="color:#24292f;font-size:1rem">🗓 Hôm nay</h2><ul>${today.map(e =>
        e.type === 'birthday'
          ? `<li>🎂 Sinh nhật <strong>${e.personName}</strong></li>`
          : `<li>🙏 Ngày giỗ <strong>${e.personName}</strong></li>`
      ).join('')}</ul>`
    : '';

  const upcomingHtml = upcoming.length
    ? `<h2 style="color:#24292f;font-size:1rem">⏰ Sắp tới (7 ngày nữa)</h2><ul>${upcoming.map(e =>
        e.type === 'birthday'
          ? `<li>🎂 Sinh nhật <strong>${e.personName}</strong></li>`
          : `<li>🙏 Ngày giỗ <strong>${e.personName}</strong></li>`
      ).join('')}</ul>`
    : '';

  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;color:#24292f">
  <h1 style="color:#0969da;font-size:1.2rem">🌳 Gia Phả Họ Lâm</h1>
  <p style="color:#57606a;font-size:13px">Nhắc lịch ngày <strong>${dateLabel}</strong></p>
  ${todayHtml}
  ${upcomingHtml}
  <hr style="border:none;border-top:1px solid #d0d7de;margin:24px 0"/>
  <p style="font-size:12px;color:#57606a">
    <a href="${APP_URL}" style="color:#0969da">Xem cây gia phả</a>
  </p>
</body>
</html>`;
}

export async function sendNotificationBatch(
  recipients: string[],
  events: NotificationEvent[],
  dateLabel: string,
): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const html = buildEmailHtml(events, dateLabel);
  const subject = `🌳 Gia Phả Họ Lâm — Nhắc lịch ngày ${dateLabel}`;
  const CHUNK = 100;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const messages = recipients.slice(i, i + CHUNK).map(to => ({ from: FROM, to, subject, html }));
    await resend.batch.send(messages);
  }
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd backend
npm test -- --testPathPattern=emailService
```

Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/emailService.ts backend/src/services/tests/emailService.test.ts
git commit -m "feat: add emailService with Resend batch sender"
```

---

### Task 4: Write failing tests for cronService

**Files:**
- Create: `backend/src/services/tests/cronService.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/services/tests/cronService.test.ts`:

```typescript
import { toVNDateString, daysUntilNextOccurrence, runNotifications } from '../cronService';

// --- Pure function tests ---

describe('toVNDateString', () => {
  it('converts UTC midnight to VN date (UTC+7)', () => {
    // 2026-05-01 22:00 UTC = 2026-05-02 05:00 VN → still May 2
    // Wait: 22:00 UTC + 7 = 05:00 VN next day? No. 22:00 + 7 = 29:00 = 05:00 next day
    // So 2026-05-01 22:00 UTC = 2026-05-02 05:00 VN → date is 2026-05-02
    const d = new Date('2026-05-01T22:00:00Z');
    expect(toVNDateString(d)).toBe('2026-05-02');
  });

  it('returns correct date for 00:00 UTC (which is 07:00 VN)', () => {
    const d = new Date('2026-05-02T00:00:00Z');
    expect(toVNDateString(d)).toBe('2026-05-02');
  });
});

describe('daysUntilNextOccurrence', () => {
  it('returns 0 when event is today', () => {
    // now = 2026-05-02 07:00 VN = 2026-05-02 00:00 UTC
    const now = new Date('2026-05-02T00:00:00Z');
    // month=4 (May), day=2 → today
    expect(daysUntilNextOccurrence(4, 2, now)).toBe(0);
  });

  it('returns 7 when event is 7 days away', () => {
    const now = new Date('2026-05-02T00:00:00Z');
    // May 9 = month 4, day 9
    expect(daysUntilNextOccurrence(4, 9, now)).toBe(7);
  });

  it('wraps to next year when date already passed', () => {
    const now = new Date('2026-05-02T00:00:00Z');
    // Jan 1 already passed → next Jan 1 2027 = 244 days away (approx)
    const d = daysUntilNextOccurrence(0, 1, now);
    expect(d).toBeGreaterThan(200);
  });
});

// --- runNotifications integration tests with mocks ---

jest.mock('../../lib/prisma', () => ({
  prisma: {
    notificationRun: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    person: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../emailService', () => ({
  sendNotificationBatch: jest.fn(),
}));

import { prisma } from '../../lib/prisma';
import { sendNotificationBatch } from '../emailService';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockSend = sendNotificationBatch as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (mockPrisma.notificationRun.findUnique as jest.Mock).mockResolvedValue(null);
  (mockPrisma.notificationRun.upsert as jest.Mock).mockResolvedValue({});
  (mockPrisma.person.findMany as jest.Mock).mockResolvedValue([]);
  mockSend.mockResolvedValue(undefined);
});

describe('runNotifications', () => {
  it('skips when VN hour < 7', async () => {
    // 2026-05-02 00:00 UTC = 07:00 VN — this is exactly 7, so should run.
    // Use 23:00 UTC previous day = 06:00 VN
    const now = new Date('2026-05-01T23:00:00Z');
    await runNotifications(now);
    expect(mockPrisma.notificationRun.findUnique).not.toHaveBeenCalled();
  });

  it('skips when today already succeeded', async () => {
    (mockPrisma.notificationRun.findUnique as jest.Mock).mockResolvedValue({ success: true });
    const now = new Date('2026-05-02T00:00:00Z'); // 07:00 VN
    await runNotifications(now);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('marks success without sending when no events', async () => {
    const now = new Date('2026-05-02T00:00:00Z');
    (mockPrisma.person.findMany as jest.Mock).mockResolvedValue([
      { id: '1', fullName: 'Test', email: 'a@b.com', birthDate: null, deathDate: null },
    ]);
    await runNotifications(now);
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockPrisma.notificationRun.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ success: true }) }),
    );
  });

  it('sends email when birthday is today', async () => {
    const now = new Date('2026-05-02T00:00:00Z'); // VN date: 2026-05-02
    (mockPrisma.person.findMany as jest.Mock).mockResolvedValue([
      {
        id: '1', fullName: 'Lâm Văn A', email: 'a@b.com',
        birthDate: new Date('1980-05-02T00:00:00Z'), // May 2 → daysUntil=0
        deathDate: null,
      },
    ]);
    await runNotifications(now);
    expect(mockSend).toHaveBeenCalledWith(
      ['a@b.com'],
      expect.arrayContaining([expect.objectContaining({ type: 'birthday', daysUntil: 0 })]),
      expect.any(String),
    );
    expect(mockPrisma.notificationRun.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ success: true }) }),
    );
  });

  it('does NOT save success when sendNotificationBatch throws', async () => {
    const now = new Date('2026-05-02T00:00:00Z');
    (mockPrisma.person.findMany as jest.Mock).mockResolvedValue([
      {
        id: '1', fullName: 'X', email: 'x@x.com',
        birthDate: new Date('1980-05-02T00:00:00Z'),
        deathDate: null,
      },
    ]);
    mockSend.mockRejectedValue(new Error('Resend API error'));
    await expect(runNotifications(now)).rejects.toThrow('Resend API error');
    expect(mockPrisma.notificationRun.upsert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
npm test -- --testPathPattern=cronService
```

Expected: FAIL — `Cannot find module '../cronService'`

- [ ] **Step 3: Commit failing tests**

```bash
git add backend/src/services/tests/cronService.test.ts
git commit -m "test: add failing tests for cronService"
```

---

### Task 5: Implement cronService.ts

**Files:**
- Create: `backend/src/services/cronService.ts`

- [ ] **Step 1: Implement cronService.ts**

Create `backend/src/services/cronService.ts`:

```typescript
import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { sendNotificationBatch, NotificationEvent } from './emailService';

export function toVNDateString(now: Date): string {
  const vnMs = now.getTime() + 7 * 60 * 60 * 1000;
  const d = new Date(vnMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getVNHour(now: Date): number {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).getUTCHours();
}

export function daysUntilNextOccurrence(month: number, day: number, now: Date): number {
  const vnMs = now.getTime() + 7 * 60 * 60 * 1000;
  const vnDate = new Date(vnMs);
  const todayStart = new Date(Date.UTC(vnDate.getUTCFullYear(), vnDate.getUTCMonth(), vnDate.getUTCDate()));
  let target = new Date(Date.UTC(vnDate.getUTCFullYear(), month, day));
  if (target < todayStart) target = new Date(Date.UTC(vnDate.getUTCFullYear() + 1, month, day));
  return Math.round((target.getTime() - todayStart.getTime()) / 86400000);
}

export async function runNotifications(now = new Date()): Promise<void> {
  if (getVNHour(now) < 7) return;

  const dateVN = toVNDateString(now);
  const existing = await prisma.notificationRun.findUnique({ where: { date: dateVN } });
  if (existing?.success) return;

  const persons = await prisma.person.findMany({
    select: { id: true, fullName: true, email: true, birthDate: true, deathDate: true },
  });

  const events: NotificationEvent[] = [];
  for (const p of persons) {
    if (p.birthDate) {
      const d = daysUntilNextOccurrence(p.birthDate.getUTCMonth(), p.birthDate.getUTCDate(), now);
      if (d === 0 || d === 7) events.push({ personName: p.fullName, type: 'birthday', daysUntil: d });
    }
    if (p.deathDate) {
      const d = daysUntilNextOccurrence(p.deathDate.getUTCMonth(), p.deathDate.getUTCDate(), now);
      if (d === 0 || d === 7) events.push({ personName: p.fullName, type: 'death', daysUntil: d });
    }
  }

  const recipients = persons.filter(p => p.email).map(p => p.email!);

  if (events.length === 0 || recipients.length === 0) {
    await prisma.notificationRun.upsert({
      where: { date: dateVN },
      create: { date: dateVN, success: true, sentAt: now },
      update: { success: true, sentAt: now },
    });
    return;
  }

  const [d, mo, y] = [
    dateVN.slice(8, 10), dateVN.slice(5, 7), dateVN.slice(0, 4),
  ];
  const dateLabel = `${d}/${mo}/${y}`;

  await sendNotificationBatch(recipients, events, dateLabel);

  await prisma.notificationRun.upsert({
    where: { date: dateVN },
    create: { date: dateVN, success: true, sentAt: now },
    update: { success: true, sentAt: now },
  });
}

export function startCron(): void {
  cron.schedule('*/5 * * * *', async () => {
    try {
      await runNotifications();
    } catch (err) {
      console.error('[cron] notification error:', err);
    }
  });
  console.log('[cron] notification cron started (every 5 min)');
}
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
cd backend
npm test -- --testPathPattern=cronService
```

Expected: PASS — all 8 tests passing.

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/cronService.ts
git commit -m "feat: implement cronService with notification logic"
```

---

### Task 6: Wire cronService into server.ts

**Files:**
- Modify: `backend/src/server.ts`

- [ ] **Step 1: Add RESEND env vars to .env.example or README** (if one exists, otherwise skip to step 2)

Check: `ls backend/.env* 2>/dev/null`

If `backend/.env.example` exists, add to it:
```
RESEND_API_KEY=re_your_key_here
RESEND_FROM=noreply@yourdomain.com
APP_URL=https://justinlam-familytree.fly.dev
```

- [ ] **Step 2: Update server.ts to start cron after listen**

Current `backend/src/server.ts`:
```typescript
import 'dotenv/config';
import { app } from './app';

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

Replace with:
```typescript
import 'dotenv/config';
import { app } from './app';
import { startCron } from './services/cronService';

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startCron();
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/server.ts
git commit -m "feat: start notification cron on server boot"
```

---

### Task 7: Expose email in personService

**Files:**
- Modify: `backend/src/services/personService.ts`

- [ ] **Step 1: Add email to CreatePersonInput interface**

In `backend/src/services/personService.ts`, the current `CreatePersonInput` interface:

```typescript
export interface CreatePersonInput {
  fullName: string;
  nickname?: string;
  gender: Gender;
  birthDate?: string;
  deathDate?: string;
  phone?: string;
  address?: string;
  bio?: string;
  generation: number;
  grantAccess?: boolean;
  grantRole?: Role;
  grantPassword?: string;
}
```

Add `email?: string;` after `bio?`:

```typescript
export interface CreatePersonInput {
  fullName: string;
  nickname?: string;
  gender: Gender;
  birthDate?: string;
  deathDate?: string;
  phone?: string;
  address?: string;
  bio?: string;
  email?: string;
  generation: number;
  grantAccess?: boolean;
  grantRole?: Role;
  grantPassword?: string;
}
```

`UpdatePersonInput` is `Partial<CreatePersonInput>` so it automatically includes `email?`. No other changes needed — the spread `...personData` in both `createPerson` and `updatePerson` already passes email through to Prisma.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests to confirm no regression**

```bash
cd backend
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/personService.ts
git commit -m "feat: expose email field in personService"
```

---

### Task 8: Frontend — PersonForm email field

**Files:**
- Modify: `frontend/src/components/PersonForm.vue`

- [ ] **Step 1: Add email to defaultForm()**

In `frontend/src/components/PersonForm.vue`, find:

```typescript
const defaultForm = () => ({
  fullName: '', nickname: '', gender: 'male' as 'male' | 'female',
  birthDate: '', deathDate: '', phone: '', address: '', bio: '',
  generation: 1, grantAccess: false, grantRole: 'viewer' as 'viewer' | 'editor' | 'admin',
  grantPassword: '',
  fatherId: '', motherId: '', spouseId: '',
});
```

Replace with:

```typescript
const defaultForm = () => ({
  fullName: '', nickname: '', gender: 'male' as 'male' | 'female',
  birthDate: '', deathDate: '', phone: '', address: '', bio: '', email: '',
  generation: 1, grantAccess: false, grantRole: 'viewer' as 'viewer' | 'editor' | 'admin',
  grantPassword: '',
  fatherId: '', motherId: '', spouseId: '',
});
```

- [ ] **Step 2: Populate email when editing an existing person**

In the `watch(() => props.editPerson, ...)` callback, find the `if (p)` branch where form fields are set:

```typescript
    form.value = {
      ...defaultForm(),
      fullName: p.fullName, nickname: p.nickname || '', gender: p.gender,
      birthDate: p.birthDate ? p.birthDate.slice(0, 10) : '',
      deathDate: p.deathDate ? p.deathDate.slice(0, 10) : '',
      phone: p.phone || '', address: p.address || '', bio: p.bio || '',
      generation: p.generation,
    };
```

Replace with:

```typescript
    form.value = {
      ...defaultForm(),
      fullName: p.fullName, nickname: p.nickname || '', gender: p.gender,
      birthDate: p.birthDate ? p.birthDate.slice(0, 10) : '',
      deathDate: p.deathDate ? p.deathDate.slice(0, 10) : '',
      phone: p.phone || '', address: p.address || '', bio: p.bio || '',
      email: p.email || '',
      generation: p.generation,
    };
```

- [ ] **Step 3: Add email input field to template**

In the template, find the phone field block:

```html
        <div class="field">
          <label>Số điện thoại</label>
          <input v-model="form.phone" type="tel" />
        </div>
        <div class="field">
          <label>Địa chỉ</label>
          <input v-model="form.address" />
        </div>
```

Replace with:

```html
        <div class="field">
          <label>Số điện thoại</label>
          <input v-model="form.phone" type="tel" />
        </div>
        <div class="field">
          <label>Email thông báo</label>
          <input v-model="form.email" type="email" placeholder="example@gmail.com" />
        </div>
        <div class="field">
          <label>Địa chỉ</label>
          <input v-model="form.address" />
        </div>
```

- [ ] **Step 4: Verify in browser**

Start the dev server and open PersonForm (click "+ Thêm người"). Confirm the "Email thông báo" field appears between phone and address. Edit an existing person with email set — confirm the field is pre-filled.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PersonForm.vue
git commit -m "feat: add email field to PersonForm"
```

---

### Task 9: Frontend — PersonDrawer email display

**Files:**
- Modify: `frontend/src/components/PersonDrawer.vue`

- [ ] **Step 1: Add email row to info-section**

In `frontend/src/components/PersonDrawer.vue`, find the phone row:

```html
            <div v-if="person.phone" class="info-row">
              <span class="icon">📞</span>
              <div>
                <div class="info-label">Điện thoại</div>
                <a :href="'tel:' + person.phone" class="phone-link">{{ person.phone }}</a>
              </div>
            </div>
```

After that block, add:

```html
            <div v-if="person.email" class="info-row">
              <span class="icon">✉️</span>
              <div>
                <div class="info-label">Email</div>
                <a :href="'mailto:' + person.email" class="phone-link">{{ person.email }}</a>
              </div>
            </div>
```

- [ ] **Step 2: Verify in browser**

Open PersonDrawer for a person who has email set. Confirm `✉️` email row appears with a clickable `mailto:` link.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/PersonDrawer.vue
git commit -m "feat: show email in PersonDrawer"
```

---

### Task 10: Add RESEND_API_KEY to Fly.io secrets

**Files:**
- `fly.toml` (read-only reference)

- [ ] **Step 1: Set secrets on Fly.io**

```bash
fly secrets set RESEND_API_KEY=re_your_key_here
fly secrets set RESEND_FROM=noreply@yourdomain.com
fly secrets set APP_URL=https://justinlam-familytree.fly.dev
```

Expected: `Secrets are staged for the first deployment that will update them.`

- [ ] **Step 2: Deploy and verify cron starts**

```bash
fly deploy
fly logs
```

Expected: log line `[cron] notification cron started (every 5 min)` shortly after deploy.

- [ ] **Step 3: Manual smoke test**

In the DB (via `fly postgres connect` or Prisma Studio), find a person and temporarily change their `birthDate` to today's date and add your email to `email`. Wait up to 5 minutes past 7:00 AM VN time, then check your inbox.

Alternatively: call `runNotifications` directly with a test date that has events, via a one-off `ts-node` script.
