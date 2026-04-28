import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { signToken } from '../lib/jwt';

const router = Router();
const prisma = new PrismaClient();

router.post('/check-phone', async (req, res) => {
  const { phone } = req.body as { phone: string };
  const token = await prisma.accessToken.findUnique({ where: { phone } });
  if (!token) { res.status(404).json({ error: 'Phone not found' }); return; }
  res.json({ role: token.role });
});

router.post('/login', async (req, res) => {
  const { phone, password } = req.body as { phone: string; password?: string };
  const token = await prisma.accessToken.findUnique({ where: { phone } });
  if (!token) { res.status(404).json({ error: 'Phone not found' }); return; }

  if (token.role === 'admin') {
    if (!password) { res.status(400).json({ error: 'Password required for admin' }); return; }
    const valid = await bcrypt.compare(password, token.passwordHash!);
    if (!valid) { res.status(401).json({ error: 'Invalid password' }); return; }
  }

  const jwt = signToken({ id: token.id, phone: token.phone, role: token.role });
  res.json({ token: jwt, role: token.role });
});

export { router as authRouter };
