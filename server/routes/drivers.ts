import { Router } from 'express';
import db from '../db';
import { haversineDistance } from '../services/pushNotifications';

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

// Smart driver suggestion endpoint — returns drivers sorted by suitability score
router.get('/suggest', (req, res) => {
  const { lat, lng } = req.query;
  const deliveryLat = parseFloat(lat as string);
  const deliveryLng = parseFloat(lng as string);

  if (isNaN(deliveryLat) || isNaN(deliveryLng)) {
    return res.status(400).json({ error: 'lat and lng query params required' });
  }

  const drivers = db.prepare(`
    SELECT u.id, u.name, u.phone, u.region,
           dl.lat, dl.lng, dl.updated_at as location_updated_at,
           (SELECT COUNT(*) FROM orders WHERE driver_id = u.id AND status IN ('assigned','delivering')) as active_orders,
           COALESCE(
             (SELECT CASE
               WHEN status = 'delivering' THEN 'delivering'
               WHEN status = 'assigned' THEN 'assigned'
             END FROM orders WHERE driver_id = u.id AND status IN ('assigned','delivering')
             ORDER BY CASE status WHEN 'delivering' THEN 1 WHEN 'assigned' THEN 2 END LIMIT 1),
             'available'
           ) as status
    FROM users u
    LEFT JOIN driver_locations dl ON dl.driver_id = u.id
    WHERE u.role = 'driver'
  `).all() as any[];

  // Score each driver
  const scored = drivers.map((driver) => {
    let score = 0;

    // Proximity score (0-50 points, higher = closer)
    let distance: number | null = null;
    if (driver.lat != null && driver.lng != null) {
      distance = haversineDistance(driver.lat, driver.lng, deliveryLat, deliveryLng);
      // Max 50 points, inversely proportional to distance (capped at 50km)
      score += Math.max(0, 50 - (distance / 50) * 50);
    }

    // Workload score (0-25 points, fewer active orders = higher)
    const activeOrders = driver.active_orders || 0;
    score += Math.max(0, 25 - activeOrders * 10);

    // Availability score (0-25 points)
    if (driver.status === 'available') score += 25;
    else if (driver.status === 'assigned') score += 10;
    else if (driver.status === 'delivering') score += 5;

    return {
      ...driver,
      distance_km: distance != null ? Math.round(distance * 100) / 100 : null,
      score: Math.round(score * 100) / 100,
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Mark the top driver as suggested
  if (scored.length > 0) {
    scored[0].suggested = true;
  }

  res.json(scored);
});

// Get all available drivers with region, location, status, and active order count
router.get('/', (_req, res) => {
  const drivers = db.prepare(`
    SELECT u.id, u.name, u.phone, u.region,
           dl.lat, dl.lng, dl.updated_at as location_updated_at,
           (SELECT COUNT(*) FROM orders WHERE driver_id = u.id AND status IN ('assigned','delivering')) as active_orders,
           COALESCE(
             (SELECT CASE
               WHEN status = 'delivering' THEN 'delivering'
               WHEN status = 'assigned' THEN 'assigned'
             END FROM orders WHERE driver_id = u.id AND status IN ('assigned','delivering')
             ORDER BY CASE status WHEN 'delivering' THEN 1 WHEN 'assigned' THEN 2 END LIMIT 1),
             'available'
           ) as status
    FROM users u
    LEFT JOIN driver_locations dl ON dl.driver_id = u.id
    WHERE u.role = 'driver'
  `).all();
  res.json(drivers);
});

export default router;
