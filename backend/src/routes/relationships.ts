import { Router } from 'express';
import { requireEditor, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { logAudit } from '../services/auditService';

const router = Router();

router.post('/', requireEditor, async (req: AuthRequest, res) => {
  try {
    const rel = await prisma.relationship.create({
      data: req.body,
      include: {
        personA: { select: { fullName: true } },
        personB: { select: { fullName: true } },
      },
    });
    const label = `${rel.personA.fullName} ↔ ${rel.personB.fullName} (${rel.type})`;
    await logAudit({
      actorPhone: req.user!.phone,
      action: 'CREATE',
      entityType: 'RELATIONSHIP',
      entityId: rel.id,
      entityLabel: label,
      after: rel,
    });
    res.status(201).json(rel);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', requireEditor, async (req: AuthRequest, res) => {
  try {
    const before = await prisma.relationship.findUnique({
      where: { id: req.params.id },
      include: {
        personA: { select: { fullName: true } },
        personB: { select: { fullName: true } },
      },
    });
    if (!before) { res.status(404).json({ error: 'Not found' }); return; }
    await prisma.relationship.delete({ where: { id: req.params.id } });
    const label = `${before.personA.fullName} ↔ ${before.personB.fullName} (${before.type})`;
    await logAudit({
      actorPhone: req.user!.phone,
      action: 'DELETE',
      entityType: 'RELATIONSHIP',
      entityId: req.params.id,
      entityLabel: label,
      before,
    });
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export { router as relationshipsRouter };
