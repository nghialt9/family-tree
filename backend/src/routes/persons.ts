import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { requireViewer, requireEditor, requireAdmin, AuthRequest } from '../middleware/auth';
import { createPerson, updatePerson } from '../services/personService';
import { prisma } from '../lib/prisma';
import { logAudit } from '../services/auditService';

const router = Router();

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

router.get('/', requireViewer, async (_req, res) => {
  const persons = await prisma.person.findMany({ orderBy: [{ generation: 'asc' }, { fullName: 'asc' }] });
  res.json(persons);
});

router.get('/:id', requireViewer, async (req, res) => {
  const person = await prisma.person.findUnique({ where: { id: req.params.id } });
  if (!person) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(person);
});

router.get('/:id/access', requireEditor, async (req, res) => {
  const token = await prisma.accessToken.findFirst({ where: { personId: req.params.id } });
  res.json({ hasAccess: !!token, role: token?.role ?? null });
});

router.get('/:id/relatives', requireViewer, async (req, res) => {
  const { id } = req.params;
  const [asA, asB] = await Promise.all([
    prisma.relationship.findMany({ where: { personAId: id }, include: { personB: true } }),
    prisma.relationship.findMany({ where: { personBId: id }, include: { personA: true } }),
  ]);
  const parents = asB.filter(r => r.type === 'parent_child').map(r => ({ ...r.personA, relationshipId: r.id }));
  const children = asA.filter(r => r.type === 'parent_child').map(r => ({ ...r.personB, relationshipId: r.id }));
  const spouses = [
    ...asA.filter(r => r.type === 'spouse').map(r => ({ ...r.personB, relationshipId: r.id })),
    ...asB.filter(r => r.type === 'spouse').map(r => ({ ...r.personA, relationshipId: r.id })),
  ];
  res.json({ parents, children, spouses });
});

router.post('/', requireEditor, async (req: AuthRequest, res) => {
  try {
    const body = { ...req.body };
    if (req.user!.role === 'editor' && body.grantAccess) {
      body.grantRole = 'viewer';
      delete body.grantPassword;
    }
    const person = await createPerson(body);
    await logAudit({
      actorPhone: req.user!.phone,
      action: 'CREATE',
      entityType: 'PERSON',
      entityId: person.id,
      entityLabel: person.fullName,
      after: person,
    });
    res.status(201).json(person);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', requireEditor, async (req: AuthRequest, res) => {
  try {
    const body = { ...req.body };
    if (req.user!.role === 'editor' && body.grantAccess) {
      const existing = await prisma.accessToken.findFirst({ where: { personId: req.params.id } });
      if (existing && existing.role !== 'viewer') {
        delete body.grantAccess;
        delete body.grantRole;
        delete body.grantPassword;
      } else {
        body.grantRole = 'viewer';
        delete body.grantPassword;
      }
    }
    const before = await prisma.person.findUnique({ where: { id: req.params.id } });
    if (!before) { res.status(404).json({ error: 'Not found' }); return; }
    const after = await updatePerson(req.params.id, body);
    await logAudit({
      actorPhone: req.user!.phone,
      action: 'UPDATE',
      entityType: 'PERSON',
      entityId: req.params.id,
      entityLabel: after.fullName,
      before: before ?? undefined,
      after,
    });
    res.json(after);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const before = await prisma.person.findUnique({ where: { id: req.params.id } });
    if (!before) { res.status(404).json({ error: 'Not found' }); return; }
    await prisma.person.delete({ where: { id: req.params.id } });
    await logAudit({
      actorPhone: req.user!.phone,
      action: 'DELETE',
      entityType: 'PERSON',
      entityId: req.params.id,
      entityLabel: before.fullName,
      before,
    });
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/media', requireViewer, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const person = await prisma.person.findUnique({ where: { id } });
  if (!person) { res.status(404).json({ error: 'Not found' }); return; }

  const { cloudinaryId, url, resourceType, format, bytes, caption } = req.body;
  if (!cloudinaryId || !url || !resourceType || !format || bytes === undefined) {
    res.status(400).json({ error: 'Missing required fields' }); return;
  }

  try {
    const media = await prisma.media.create({
      data: {
        personId: id,
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

router.get('/:id/media', requireViewer, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const person = await prisma.person.findUnique({ where: { id } });
  if (!person) { res.status(404).json({ error: 'Not found' }); return; }

  const isPrivileged = req.user!.role === 'admin' || req.user!.role === 'editor';
  const where: Record<string, unknown> = { personId: id };
  if (!isPrivileged) where.status = 'APPROVED';

  const data = await prisma.media.findMany({
    where,
    orderBy: { createdAt: 'asc' },
  });
  res.json({ data });
});

router.post('/:id/avatar', requireEditor, upload.single('avatar'), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'No file' }); return; }
  const avatarUrl = `/uploads/${path.basename(req.file.path)}`;
  const person = await prisma.person.update({
    where: { id: req.params.id },
    data: { avatarUrl },
  });
  res.json(person);
});

export { router as personsRouter };
