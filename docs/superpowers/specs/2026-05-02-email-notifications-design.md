# Email Notifications (Birthday & Death Anniversary) — Design

**Goal:** Tự động gửi email cho tất cả thành viên có email trong cây gia phả khi sắp đến ngày sinh nhật hoặc ngày giỗ của bất kỳ ai trong gia đình.

**Architecture:** Thêm field `email` vào model `Person`. Một cron job chạy mỗi 5 phút kiểm tra xem hôm nay đã gửi thông báo chưa (flag trong DB); nếu chưa và giờ >= 7:00 sáng giờ VN thì gửi batch email qua Resend API. Gửi trước 7 ngày và đúng ngày sự kiện.

**Tech Stack:** Node.js + Prisma + PostgreSQL, `node-cron`, Resend API (`resend` npm package), Vue 3 frontend.

---

## 1. Data Model

### Thay đổi `Person`

```prisma
model Person {
  // ... existing fields ...
  email     String?   // email để nhận thông báo
}
```

### Bảng mới `NotificationRun`

```prisma
model NotificationRun {
  date    String    @id       // "YYYY-MM-DD" giờ Việt Nam (UTC+7)
  success Boolean   @default(false)
  sentAt  DateTime?

  @@map("notification_runs")
}
```

Dùng để idempotency: nếu `success === true` cho ngày hôm nay thì skip, tránh gửi trùng khi app restart hay retry.

---

## 2. Backend

### Env vars mới

```
RESEND_API_KEY=re_xxxxx
RESEND_FROM=noreply@yourdomain.com
APP_URL=https://justinlam-familytree.fly.dev
```

### Files mới / thay đổi

| File | Thay đổi |
|------|---------|
| `backend/prisma/schema.prisma` | Thêm `email String?` vào Person, thêm model NotificationRun |
| `backend/src/services/emailService.ts` | Mới — wrapper Resend, hàm `sendNotificationEmail(to, subject, html)` |
| `backend/src/services/cronService.ts` | Mới — logic cron + notification |
| `backend/src/app.ts` | Khởi động cronService khi server start |
| `backend/src/routes/persons.ts` | Cho phép set/get field `email` |

### cronService.ts — Logic

```
Cron: */5 * * * *  (mỗi 5 phút)

1. Tính ngày hôm nay theo giờ VN (UTC+7): dateVN = toVNDateString(new Date())
2. Kiểm tra giờ VN hiện tại >= 7:00? Nếu không → return
3. Tìm NotificationRun[dateVN] có success=true? → return (đã gửi rồi)
4. Query tất cả Person có email != null
5. Query tất cả Person có birthDate hoặc deathDate != null
6. Tính events:
   - Với mỗi Person có birthDate: daysUntil = daysUntilNextOccurrence(month, day)
     - Nếu daysUntil === 0: thêm vào danh sách "hôm nay sinh nhật"
     - Nếu daysUntil === 7: thêm vào danh sách "7 ngày nữa sinh nhật"
   - Với mỗi Person có deathDate: tương tự cho "hôm nay ngày giỗ" / "7 ngày nữa ngày giỗ"
7. Nếu không có event nào → upsert NotificationRun { success: true } → return
8. Compose HTML email liệt kê tất cả events
9. Gửi đến tất cả Person.email qua `resend.batch.send()` (tối đa 100/lần, loop nếu > 100)
10. Thành công → upsert NotificationRun { date: dateVN, success: true, sentAt: now }
    Thất bại → log lỗi, KHÔNG save → 5 phút sau retry tự động
```

### emailService.ts — Email template (HTML tiếng Việt)

Email gồm:
- Tiêu đề: `🌳 Gia Phả Họ Lâm — Nhắc lịch ngày [DD/MM/YYYY]`
- Phần "Hôm nay": danh sách sinh nhật / ngày giỗ đúng hôm nay
- Phần "Sắp tới (7 ngày nữa)": danh sách sự kiện sắp đến
- Footer: link về trang gia phả

Không có unsubscribe link (email được admin/editor quản lý trực tiếp qua PersonForm).

### daysUntilNextOccurrence — logic giống frontend

```ts
function daysUntilNextOccurrence(month: number, day: number): number {
  // Dùng giờ VN (UTC+7), tính ngày tiếp theo của sự kiện
  const nowVN = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const todayStart = new Date(Date.UTC(nowVN.getUTCFullYear(), nowVN.getUTCMonth(), nowVN.getUTCDate()));
  let target = new Date(Date.UTC(nowVN.getUTCFullYear(), month, day));
  if (target < todayStart) target = new Date(Date.UTC(nowVN.getUTCFullYear() + 1, month, day));
  return Math.round((target.getTime() - todayStart.getTime()) / 86400000);
}
```

---

## 3. Frontend

### PersonForm.vue

Thêm field email vào form (giữa phone và address):

```html
<div class="field">
  <label>Email nhận thông báo</label>
  <input v-model="form.email" type="email" placeholder="example@gmail.com" />
</div>
```

Field không bắt buộc. Hiển thị với tất cả role editor trở lên.

### PersonDrawer.vue

Hiển thị email nếu có (tương tự phone):

```html
<div v-if="person.email" class="info-row">
  <span class="icon">✉️</span>
  <div>
    <div class="info-label">Email</div>
    <a :href="'mailto:' + person.email" class="email-link">{{ person.email }}</a>
  </div>
</div>
```

### API (persons)

Backend `persons.ts` đã có update endpoint — chỉ cần đảm bảo `email` được include trong select/update. Không cần route mới.

---

## 4. Không làm (out of scope)

- Unsubscribe link trong email (email được quản lý bởi editor, không phải self-service)
- Email confirmation / double opt-in
- Template HTML phức tạp (chỉ cần plain HTML đơn giản)
- Gửi email ngay lập tức khi thêm người mới
- Lưu lịch sử email đã gửi chi tiết (chỉ lưu success/fail per day)
