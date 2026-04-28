import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireViewer } from '../middleware/auth';
import { buildTree } from '../services/treeLayout';

const router = Router();
const prisma = new PrismaClient();

router.get('/', requireViewer, async (_req, res) => {
  const [persons, relationships] = await Promise.all([
    prisma.person.findMany(),
    prisma.relationship.findMany(),
  ]);
  res.json(buildTree(persons, relationships));
});

export { router as treeRouter };
