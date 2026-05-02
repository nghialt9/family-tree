import { toVNDateString, daysUntilNextOccurrence, runNotifications } from '../cronService';

// --- Pure function tests ---

describe('toVNDateString', () => {
  it('converts UTC to VN date (UTC+7)', () => {
    // 2026-05-01 22:00 UTC = 2026-05-02 05:00 VN → date is 2026-05-02
    const d = new Date('2026-05-01T22:00:00Z');
    expect(toVNDateString(d)).toBe('2026-05-02');
  });

  it('returns correct date for 00:00 UTC (07:00 VN)', () => {
    const d = new Date('2026-05-02T00:00:00Z');
    expect(toVNDateString(d)).toBe('2026-05-02');
  });
});

describe('daysUntilNextOccurrence', () => {
  it('returns 0 when event is today', () => {
    const now = new Date('2026-05-02T00:00:00Z'); // 07:00 VN
    expect(daysUntilNextOccurrence(4, 2, now)).toBe(0); // month=4 (May), day=2
  });

  it('returns 7 when event is 7 days away', () => {
    const now = new Date('2026-05-02T00:00:00Z');
    expect(daysUntilNextOccurrence(4, 9, now)).toBe(7); // May 9
  });

  it('wraps to next year when date already passed', () => {
    const now = new Date('2026-05-02T00:00:00Z');
    const d = daysUntilNextOccurrence(0, 1, now); // Jan 1 already passed
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

const mockSend = sendNotificationBatch as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.notificationRun.findUnique as jest.Mock).mockResolvedValue(null);
  (prisma.notificationRun.upsert as jest.Mock).mockResolvedValue({});
  (prisma.person.findMany as jest.Mock).mockResolvedValue([]);
  mockSend.mockResolvedValue(undefined);
});

describe('runNotifications', () => {
  it('skips when VN hour < 7', async () => {
    const now = new Date('2026-05-01T23:00:00Z'); // 06:00 VN
    await runNotifications(now);
    expect(prisma.notificationRun.findUnique).not.toHaveBeenCalled();
  });

  it('skips when today already succeeded', async () => {
    (prisma.notificationRun.findUnique as jest.Mock).mockResolvedValue({ success: true });
    const now = new Date('2026-05-02T00:00:00Z'); // 07:00 VN
    await runNotifications(now);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('marks success without sending when no events', async () => {
    const now = new Date('2026-05-02T00:00:00Z');
    (prisma.person.findMany as jest.Mock).mockResolvedValue([
      { id: '1', fullName: 'Test', email: 'a@b.com', birthDate: null, deathDate: null },
    ]);
    await runNotifications(now);
    expect(mockSend).not.toHaveBeenCalled();
    expect(prisma.notificationRun.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ success: true }) }),
    );
  });

  it('sends email when birthday is today', async () => {
    const now = new Date('2026-05-02T00:00:00Z');
    (prisma.person.findMany as jest.Mock).mockResolvedValue([
      {
        id: '1', fullName: 'Lâm Văn A', email: 'a@b.com',
        birthDate: new Date('1980-05-02T00:00:00Z'),
        deathDate: null,
      },
    ]);
    await runNotifications(now);
    expect(mockSend).toHaveBeenCalledWith(
      ['a@b.com'],
      expect.arrayContaining([expect.objectContaining({ type: 'birthday', daysUntil: 0 })]),
      expect.any(String),
    );
    expect(prisma.notificationRun.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ success: true }) }),
    );
  });

  it('does NOT save success when sendNotificationBatch throws', async () => {
    const now = new Date('2026-05-02T00:00:00Z');
    (prisma.person.findMany as jest.Mock).mockResolvedValue([
      {
        id: '1', fullName: 'X', email: 'x@x.com',
        birthDate: new Date('1980-05-02T00:00:00Z'),
        deathDate: null,
      },
    ]);
    mockSend.mockRejectedValue(new Error('Resend API error'));
    await expect(runNotifications(now)).rejects.toThrow('Resend API error');
    expect(prisma.notificationRun.upsert).not.toHaveBeenCalled();
  });
});
