import { Router } from 'express';
import { requireViewer, requireAdmin, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

router.get('/', requireViewer, async (req: AuthRequest, res) => {
  const { status, personId, page = '1', limit = '20' } = req.query as Record<string, string>;
  const isPrivileged = req.user!.role === 'admin' || req.user!.role === 'editor';

  const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'];
  if (status && !validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status value' }); return;
  }

  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const skip = (p - 1) * l;

  const where: Record<string, unknown> = {};
  if (!isPrivileged) {
    where.status = 'APPROVED';
  } else if (status && status !== 'ALL') {
    where.status = status;
  }
  if (personId) where.personId = personId;

  try {
    const [data, total] = await Promise.all([
      prisma.album.findMany({
        where,
        include: {
          person: { select: { id: true, fullName: true } },
          coverMedia: { select: { url: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: l,
      }),
      prisma.album.count({ where }),
    ]);
    res.json({ data, total });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requireViewer, async (req: AuthRequest, res) => {
  const { title, description, personId } = req.body;
  if (!title?.trim()) { res.status(400).json({ error: 'title is required' }); return; }
  try {
    const album = await prisma.album.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        personId: personId || null,
        createdBy: req.user!.phone,
        status: 'PENDING',
      },
    });
    res.status(201).json(album);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/:id', requireViewer, async (req: AuthRequest, res) => {
  try {
    const album = await prisma.album.findUnique({
      where: { id: req.params.id },
      include: {
        person: { select: { id: true, fullName: true } },
        coverMedia: { select: { url: true } },
        items: {
          include: { media: true },
          orderBy: { position: 'asc' },
        },
      },
    });
    if (!album) { res.status(404).json({ error: 'Not found' }); return; }

    const isPrivileged = req.user!.role === 'admin' || req.user!.role === 'editor';
    const isCreator = album.createdBy === req.user!.phone;
    if (album.status !== 'APPROVED' && !isPrivileged && !isCreator) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }

    const filteredItems = (isPrivileged || isCreator)
      ? album.items
      : album.items.filter(item => item.media.status === 'APPROVED');
    res.json({ ...album, items: filteredItems });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', requireViewer, async (req: AuthRequest, res) => {
  try {
    const album = await prisma.album.findUnique({ where: { id: req.params.id } });
    if (!album) { res.status(404).json({ error: 'Not found' }); return; }

    const isPrivileged = req.user!.role === 'admin' || req.user!.role === 'editor';
    if (!isPrivileged && album.createdBy !== req.user!.phone) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }

    const { title, description, coverMediaId } = req.body;
    if (title !== undefined && !title.trim()) {
      res.status(400).json({ error: 'title cannot be empty' }); return;
    }

    const updated = await prisma.album.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(coverMediaId !== undefined && { coverMediaId: coverMediaId || null }),
      },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', requireViewer, async (req: AuthRequest, res) => {
  try {
    const album = await prisma.album.findUnique({ where: { id: req.params.id } });
    if (!album) { res.status(404).json({ error: 'Not found' }); return; }

    if (req.user!.role !== 'admin' && album.createdBy !== req.user!.phone) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }
    await prisma.album.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (status !== 'APPROVED' && status !== 'REJECTED') {
    res.status(400).json({ error: 'status must be APPROVED or REJECTED' }); return;
  }
  try {
    const album = await prisma.album.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(album);
  } catch (e: any) {
    if (e.code === 'P2025') { res.status(404).json({ error: 'Not found' }); return; }
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/media', requireViewer, async (req: AuthRequest, res) => {
  try {
    const album = await prisma.album.findUnique({ where: { id: req.params.id } });
    if (!album) { res.status(404).json({ error: 'Not found' }); return; }

    const { mediaId, cloudinaryId, url, resourceType, format, bytes, caption } = req.body;

    if (mediaId) {
      const media = await prisma.media.findUnique({ where: { id: mediaId } });
      if (!media) { res.status(404).json({ error: 'Media not found' }); return; }
      if (media.status !== 'APPROVED') { res.status(400).json({ error: 'Media must be APPROVED' }); return; }

      try {
        const item = await prisma.albumMedia.create({
          data: { albumId: req.params.id, mediaId },
        });
        res.status(201).json(item);
      } catch (e: any) {
        if (e.code === 'P2002') { res.status(409).json({ error: 'Already in album' }); return; }
        throw e; // re-throw for the outer catch
      }
    } else {
      if (!cloudinaryId || !url || !resourceType || !format || bytes === undefined) {
        res.status(400).json({ error: 'cloudinaryId, url, resourceType, format, bytes are required' }); return;
      }
      const media = await prisma.media.create({
        data: {
          cloudinaryId,
          url,
          resourceType,
          format,
          bytes,
          caption: caption || null,
          status: 'PENDING',
          uploadedBy: req.user!.phone,
        },
      });
      const item = await prisma.albumMedia.create({
        data: { albumId: req.params.id, mediaId: media.id },
      });
      res.status(201).json({ ...item, media });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id/media/:mediaId', requireViewer, async (req: AuthRequest, res) => {
  try {
    const album = await prisma.album.findUnique({ where: { id: req.params.id } });
    if (!album) { res.status(404).json({ error: 'Not found' }); return; }

    const item = await prisma.albumMedia.findUnique({
      where: { albumId_mediaId: { albumId: req.params.id, mediaId: req.params.mediaId } },
      include: { media: true },
    });
    if (!item) { res.status(404).json({ error: 'Not found' }); return; }

    const isAdmin = req.user!.role === 'admin';
    const isEditor = req.user!.role === 'editor';
    const isCreator = album.createdBy === req.user!.phone;
    const isUploader = item.media.uploadedBy === req.user!.phone;
    if (!isAdmin && !isEditor && !isCreator && !isUploader) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }

    await prisma.albumMedia.delete({
      where: { albumId_mediaId: { albumId: req.params.id, mediaId: req.params.mediaId } },
    });
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export { router as albumsRouter };
