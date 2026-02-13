import { Router } from 'express';
import db from '../db';

const router = Router();

// Update driver location
router.post('/location', (req, res) => {
  const { driver_id, lat, lng } = req.body;
  if (!driver_id || lat == null || lng == null) {
    return res.status(400).json({ error: 'driver_id, lat, lng required' });
  }

  db.prepare(`
    INSERT INTO driver_locations (driver_id, lat, lng, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(driver_id) DO UPDATE SET lat = ?, lng = ?, updated_at = CURRENT_TIMESTAMP
  `).run(driver_id, lat, lng, lat, lng);

  res.json({ success: true });
});

// Get driver location
router.get('/location/:driverId', (req, res) => {
  const loc = db.prepare('SELECT * FROM driver_locations WHERE driver_id = ?').get(req.params.driverId);
  if (!loc) return res.status(404).json({ error: 'Location not found' });
  res.json(loc);
});

// Get all driver locations
router.get('/locations', (_req, res) => {
  const locations = db.prepare(`
    SELECT dl.*, u.name as driver_name
    FROM driver_locations dl
    JOIN users u ON dl.driver_id = u.id
    WHERE dl.updated_at > datetime('now', '-5 minutes')
  `).all();
  res.json(locations);
});

// Get all available drivers
router.get('/', (_req, res) => {
  const drivers = db.prepare(`SELECT id, name, phone FROM users WHERE role = 'driver'`).all();
  res.json(drivers);
});

export default router;
