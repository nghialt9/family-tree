import { Router } from 'express';
import { requireAdmin, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

router.get('/', requireAdmin, async (req: AuthRequest, res) => {
  const {
    action,
    entityType,
    search,
    from,
    to,
    page = '1',
    limit = '50',
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  const where: Record<string, any> = {};
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (search) where.entityLabel = { contains: search, mode: 'insensitive' };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(`${to}T23:59:59.999Z`);
  }

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ data, total, page: pageNum, limit: limitNum });
});

export { router as auditRouter };
