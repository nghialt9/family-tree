import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { requireViewer, requireAdmin } from '../middleware/auth';
import { createPerson, updatePerson } from '../services/personService';

const router = Router();
const prisma = new PrismaClient();

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

router.get('/:id/relatives', requireViewer, async (req, res) => {
  const { id } = req.params;
  const [asA, asB] = await Promise.all([
    prisma.relationship.findMany({ where: { personAId: id }, include: { personB: true } }),
    prisma.relationship.findMany({ where: { personBId: id }, include: { personA: true } }),
  ]);
  const parents = asB.filter(r => r.type === 'parent_child').map(r => r.personA);
  const children = asA.filter(r => r.type === 'parent_child').map(r => r.personB);
  const spouses = [
    ...asA.filter(r => r.type === 'spouse').map(r => r.personB),
    ...asB.filter(r => r.type === 'spouse').map(r => r.personA),
  ];
  res.json({ parents, children, spouses });
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const person = await createPerson(req.body);
    res.status(201).json(person);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const person = await updatePerson(req.params.id, req.body);
    res.json(person);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  await prisma.person.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

router.post('/:id/avatar', requireAdmin, upload.single('avatar'), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'No file' }); return; }
  const avatarUrl = `/uploads/${path.basename(req.file.path)}`;
  const person = await prisma.person.update({
    where: { id: req.params.id },
    data: { avatarUrl },
  });
  res.json(person);
});

export { router as personsRouter };
