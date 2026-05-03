import nodemailer from 'nodemailer';

export interface NotificationEvent {
  personName: string;
  type: 'birthday' | 'death';
  daysUntil: number;
}

export function buildEmailHtml(events: NotificationEvent[], dateLabel: string): string {
  const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
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
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // STARTTLS on port 587
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const html = buildEmailHtml(events, dateLabel);
  const subject = `🌳 Gia Phả Họ Lâm — Nhắc lịch ngày ${dateLabel}`;
  const from = `"Gia Phả Họ Lâm" <${process.env.GMAIL_USER}>`;

  for (const to of recipients) {
    await transporter.sendMail({ from, to, subject, html });
  }
}
