import { Router } from 'express';
import { requireEditor } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

router.post('/', requireEditor, async (req, res) => {
  try {
    const rel = await prisma.relationship.create({ data: req.body });
    res.status(201).json(rel);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', requireEditor, async (req, res) => {
  await prisma.relationship.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export { router as relationshipsRouter };
