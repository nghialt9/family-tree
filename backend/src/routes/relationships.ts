import { Router } from 'express';
import { requireEditor, requireViewer, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { logAudit } from '../services/auditService';

const router = Router();

// GET /:id — fetch single relationship with person names
router.get('/:id', requireViewer, async (req: AuthRequest, res) => {
  try {
    const rel = await prisma.relationship.findUnique({
      where: { id: req.params.id },
      include: {
        personA: { select: { id: true, fullName: true } },
        personB: { select: { id: true, fullName: true } },
      },
    });
    if (!rel) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(rel);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /:id/media — list media for a relationship
router.get('/:id/media', requireViewer, async (req: AuthRequest, res) => {
  try {
    const rel = await prisma.relationship.findUnique({ where: { id: req.params.id } });
    if (!rel) { res.status(404).json({ error: 'Not found' }); return; }

    const isPrivileged = req.user!.role === 'admin' || req.user!.role === 'editor';
    const where: Record<string, unknown> = { relationshipId: req.params.id };
    if (!isPrivileged) where.status = 'APPROVED';

    const data = await prisma.media.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
    res.json({ data });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /:id/media — create media record for a relationship
router.post('/:id/media', requireViewer, async (req: AuthRequest, res) => {
  try {
    const rel = await prisma.relationship.findUnique({ where: { id: req.params.id } });
    if (!rel) { res.status(404).json({ error: 'Not found' }); return; }

    const { cloudinaryId, url, resourceType, format, bytes, caption } = req.body;
    if (!cloudinaryId || !url || !resourceType || !format || bytes === undefined) {
      res.status(400).json({ error: 'Missing required fields' }); return;
    }
    const media = await prisma.media.create({
      data: {
        relationshipId: req.params.id,
        cloudinaryId,
        url,
        resourceType,
        format,
        bytes,
        caption: caption ?? null,
        status: 'PENDING',
        uploadedBy: req.user!.phone,
      },
    });
    res.status(201).json(media);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

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
