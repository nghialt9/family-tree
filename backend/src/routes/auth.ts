import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { signToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';

const router = Router();

router.post('/check-phone', async (req, res) => {
  try {
    const { phone } = req.body as { phone: string };
    const token = await prisma.accessToken.findUnique({ where: { phone } });
    if (!token) { res.status(404).json({ error: 'Phone not found' }); return; }
    res.json({ role: token.role });
  } catch (err) {
    console.error('Check-phone error:', err);
    res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body as { phone: string; password?: string };
    const token = await prisma.accessToken.findUnique({ where: { phone } });
    if (!token) { res.status(404).json({ error: 'Phone not found' }); return; }

    if (token.role === 'admin' || token.role === 'editor') {
      if (!password) { res.status(400).json({ error: 'Mật khẩu bắt buộc' }); return; }
      if (!token.passwordHash) { res.status(401).json({ error: 'Tài khoản chưa được cấp mật khẩu. Liên hệ admin.' }); return; }
      const valid = await bcrypt.compare(password, token.passwordHash);
      if (!valid) { res.status(401).json({ error: 'Mật khẩu không đúng' }); return; }
    }

    const person = token.personId
      ? await prisma.person.findUnique({ where: { id: token.personId }, select: { fullName: true } })
      : null;
    const jwt = signToken({ id: token.id, phone: token.phone, role: token.role });
    res.json({ token: jwt, role: token.role, personName: person?.fullName ?? null, phone: token.phone, personId: token.personId ?? null });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Lỗi đăng nhập. Vui lòng thử lại.' });
  }
});

export { router as authRouter };
