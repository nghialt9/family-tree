import { Router } from 'express';
import { requireViewer } from '../middleware/auth';

const router = Router();

router.get('/', requireViewer, async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q) {
    res.status(400).json({ error: 'q is required' });
    return;
  }
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=3`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'FamilyTreeApp/1.0' },
    });
    if (!response.ok) {
      res.status(502).json({ error: 'Geocoding service unavailable' });
      return;
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      res.status(502).json({ error: 'Geocoding service unavailable' });
      return;
    }
    res.json((data as Array<{ lat: string; lon: string; display_name: string }>).map(item => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      displayName: item.display_name,
    })));
  } catch {
    res.status(502).json({ error: 'Geocoding service unavailable' });
  }
});

export { router as geocodeRouter };
