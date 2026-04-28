import { Router } from 'express';
import { requireViewer } from '../middleware/auth';
import { buildTree } from '../services/treeLayout';
import { prisma } from '../lib/prisma';

const router = Router();

router.get('/', requireViewer, async (_req, res) => {
  try {
    const [persons, relationships] = await Promise.all([
      prisma.person.findMany(),
      prisma.relationship.findMany(),
    ]);
    res.json(buildTree(persons, relationships));
  } catch (e: any) {
    console.error('Tree error:', e);
    res.status(500).json({ error: 'Không tải được dữ liệu gia phả.' });
  }
});

export { router as treeRouter };
