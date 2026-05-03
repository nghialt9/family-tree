import { Router } from 'express';
import { requireViewer, requireAdmin, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { generateSignature, deleteMedia } from '../services/cloudinaryService';
import { validateSignParams } from './mediaSignValidation';

const router = Router();

// GET /sign — all authenticated users
router.get('/sign', requireViewer, (req: AuthRequest, res) => {
  const { resourceType, personId, relationshipId } = req.query as {
    resourceType?: string;
    personId?: string;
    relationshipId?: string;
  };

  const err = validateSignParams({ resourceType, personId, relationshipId });
  if (err) { res.status(400).json({ error: err }); return; }

  try {
    const folder = personId
      ? `family-tree/persons/${personId}`
      : `family-tree/relationships/${relationshipId}`;
    const result = generateSignature({ folder, resourceType: resourceType! });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET / — admin moderation queue
router.get('/', requireAdmin, async (req, res) => {
  const rawStatus = req.query.status as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;

  const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'];
  if (rawStatus && !validStatuses.includes(rawStatus)) {
    res.status(400).json({ error: 'Invalid status value' }); return;
  }

  const where: Record<string, unknown> = {};
  if (rawStatus && rawStatus !== 'ALL') where.status = rawStatus;

  const [data, total] = await Promise.all([
    prisma.media.findMany({
      where,
      include: {
        person: { select: { fullName: true } },
        relationship: {
          select: {
            personA: { select: { fullName: true } },
            personB: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.media.count({ where }),
  ]);

  res.json({ data, total, page, limit });
});

// PATCH /:id/status — admin
router.patch('/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body as { status: string };
  if (status !== 'APPROVED' && status !== 'REJECTED') {
    res.status(400).json({ error: 'status must be APPROVED or REJECTED' });
    return;
  }
  try {
    const media = await prisma.media.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(media);
  } catch (e: any) {
    if (e.code === 'P2025') { res.status(404).json({ error: 'Not found' }); return; }
    res.status(500).json({ error: e.message });
  }
});

// DELETE /:id — admin or original uploader
router.delete('/:id', requireViewer, async (req: AuthRequest, res) => {
  try {
    const media = await prisma.media.findUnique({ where: { id: req.params.id } });
    if (!media) { res.status(404).json({ error: 'Not found' }); return; }

    if (req.user!.role !== 'admin' && media.uploadedBy !== req.user!.phone) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }

    await deleteMedia(media.cloudinaryId, media.resourceType);
    await prisma.media.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export { router as mediaRouter };
