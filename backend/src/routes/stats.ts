import { Router } from 'express';
import { requireViewer, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

// tokenId → last-seen timestamp (in-memory, resets on restart)
const onlineMap = new Map<string, number>();
const ONLINE_WINDOW_MS = 2 * 60 * 1000;

function pruneAndCount(): number {
  const cutoff = Date.now() - ONLINE_WINDOW_MS;
  for (const [key, ts] of onlineMap) {
    if (ts < cutoff) onlineMap.delete(key);
  }
  return onlineMap.size;
}

// GET /api/stats — public, no auth
router.get('/', async (_req, res) => {
  try {
    const stats = await prisma.siteStats.findUnique({ where: { id: 'global' } });
    res.json({ totalVisits: stats?.totalVisits ?? 0, onlineNow: pruneAndCount() });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/stats/ping — called by frontend on mount + every 60s
// body: { newVisit: boolean }
router.post('/ping', requireViewer, async (req: AuthRequest, res) => {
  try {
    const key = req.user!.id;
    onlineMap.set(key, Date.now());

    const { newVisit } = req.body as { newVisit?: boolean };
    const stats = await prisma.siteStats.upsert({
      where: { id: 'global' },
      create: { id: 'global', totalVisits: newVisit ? 1 : 0 },
      update: newVisit ? { totalVisits: { increment: 1 } } : {},
    });

    res.json({ totalVisits: stats.totalVisits, onlineNow: pruneAndCount() });
  } catch (error) {
    console.error('Error updating stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/stats/leave — called on tab close via keepalive fetch
router.post('/leave', requireViewer, (req: AuthRequest, res) => {
  onlineMap.delete(req.user!.id);
  res.json({ ok: true });
});

export { router as statsRouter };
