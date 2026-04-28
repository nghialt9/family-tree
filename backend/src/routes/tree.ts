import { Router } from 'express';
import { requireViewer } from '../middleware/auth';
import { buildTree } from '../services/treeLayout';
import { prisma } from '../lib/prisma';

const router = Router();

router.get('/', requireViewer, async (_req, res) => {
  const [persons, relationships] = await Promise.all([
    prisma.person.findMany(),
    prisma.relationship.findMany(),
  ]);
  res.json(buildTree(persons, relationships));
});

export { router as treeRouter };
