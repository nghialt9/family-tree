import { Prisma } from '@prisma/client';
import { logAudit } from '../auditService';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: jest.fn(),
    },
  },
}));

import { prisma } from '../../lib/prisma';

describe('logAudit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls prisma.auditLog.create with correct data for CREATE', async () => {
    jest.mocked(prisma.auditLog.create).mockResolvedValueOnce({} as any);

    await logAudit({
      actorPhone: '0901234567',
      action: 'CREATE',
      entityType: 'PERSON',
      entityId: 'abc123',
      entityLabel: 'Lâm Văn A',
      after: { id: 'abc123', fullName: 'Lâm Văn A' },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorPhone: '0901234567',
        action: 'CREATE',
        entityType: 'PERSON',
        entityId: 'abc123',
        entityLabel: 'Lâm Văn A',
        beforeJson: Prisma.JsonNull,  // Prisma.JsonNull, not plain null — required for Json? columns
        afterJson: { id: 'abc123', fullName: 'Lâm Văn A' },
      },
    });
  });

  it('calls prisma.auditLog.create with before and after for UPDATE', async () => {
    jest.mocked(prisma.auditLog.create).mockResolvedValueOnce({} as any);

    await logAudit({
      actorPhone: '0901234567',
      action: 'UPDATE',
      entityType: 'PERSON',
      entityId: 'abc123',
      entityLabel: 'Lâm Văn A',
      before: { id: 'abc123', fullName: 'Lâm Văn Cũ' },
      after: { id: 'abc123', fullName: 'Lâm Văn A' },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'UPDATE',
        beforeJson: { id: 'abc123', fullName: 'Lâm Văn Cũ' },
        afterJson: { id: 'abc123', fullName: 'Lâm Văn A' },
      }),
    });
  });

  it('does not throw when prisma.auditLog.create rejects', async () => {
    jest.mocked(prisma.auditLog.create).mockRejectedValueOnce(new Error('DB down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      logAudit({
        actorPhone: '0901234567',
        action: 'DELETE',
        entityType: 'PERSON',
        entityId: 'abc123',
        entityLabel: 'Test',
      })
    ).resolves.toBeUndefined();

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[audit]'), expect.any(Error));
    spy.mockRestore();
  });
});
