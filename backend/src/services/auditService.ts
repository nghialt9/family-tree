import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface LogParams {
  actorPhone: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: 'PERSON' | 'RELATIONSHIP';
  entityId: string;
  entityLabel: string;
  before?: object;
  after?: object;
}

export async function logAudit(params: LogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorPhone: params.actorPhone,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        entityLabel: params.entityLabel,
        beforeJson: params.before ?? Prisma.JsonNull,
        afterJson: params.after ?? Prisma.JsonNull,
      },
    });
  } catch (err) {
    console.error('[audit] failed to write log:', err);
    // Never throw — audit failure must not break the primary operation
  }
}
