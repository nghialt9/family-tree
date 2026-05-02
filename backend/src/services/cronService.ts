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

// month is 0-indexed (0 = January), matching Date.getUTCMonth()
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

  // success is only saved after send completes — if send throws, upsert is skipped and cron retries
  await sendNotificationBatch(recipients, events, dateLabel);

  console.log(`[cron] sent notifications: ${events.length} events to ${recipients.length} recipients`);

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
