import { Router } from 'express';
import db from '../db';

const router = Router();

// Create order
router.post('/', (req, res) => {
  const { consumer_id, product_id, amount_grams, delivery_address, delivery_lat, delivery_lng, customer_name } = req.body;

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id) as any;
  if (!product) return res.status(404).json({ error: 'Product not found' });

  if (amount_grams < 25 || amount_grams > 500 || amount_grams % 25 !== 0) {
    return res.status(400).json({ error: 'Amount must be 25-500g in steps of 25' });
  }

  const total_price = Math.round(product.price_per_gram * amount_grams * 100) / 100;

  const result = db.prepare(`
    INSERT INTO orders (consumer_id, product_id, amount_grams, total_price, delivery_address, delivery_lat, delivery_lng, customer_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(consumer_id, product_id, amount_grams, total_price, delivery_address, delivery_lat, delivery_lng, customer_name);

  const order = db.prepare(`
    SELECT o.*, p.name as product_name, p.image_url as product_emoji, p.price_per_gram,
           u.name as consumer_name, u.phone as consumer_phone
    FROM orders o
    JOIN products p ON o.product_id = p.id
    JOIN users u ON o.consumer_id = u.id
    WHERE o.id = ?
  `).get(result.lastInsertRowid);

  res.json(order);
});

// Get orders for consumer
router.get('/consumer/:consumerId', (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, p.name as product_name, p.image_url as product_emoji, p.price_per_gram,
           d.name as driver_name
    FROM orders o
    JOIN products p ON o.product_id = p.id
    LEFT JOIN users d ON o.driver_id = d.id
    WHERE o.consumer_id = ?
    ORDER BY o.created_at DESC
  `).all(req.params.consumerId);
  res.json(orders);
});

// Get pending orders (for approver)
router.get('/pending', (_req, res) => {
  const orders = db.prepare(`
    SELECT o.*, p.name as product_name, p.image_url as product_emoji, p.price_per_gram,
           u.name as consumer_name, u.phone as consumer_phone
    FROM orders o
    JOIN products p ON o.product_id = p.id
    JOIN users u ON o.consumer_id = u.id
    WHERE o.status = 'pending'
    ORDER BY o.created_at ASC
  `).all();
  res.json(orders);
});

// Get all active orders (for approver map view)
router.get('/active', (_req, res) => {
  const orders = db.prepare(`
    SELECT o.*, p.name as product_name, p.image_url as product_emoji, p.price_per_gram,
           u.name as consumer_name, u.phone as consumer_phone,
           d.name as driver_name
    FROM orders o
    JOIN products p ON o.product_id = p.id
    JOIN users u ON o.consumer_id = u.id
    LEFT JOIN users d ON o.driver_id = d.id
    WHERE o.status IN ('pending', 'approved', 'assigned', 'delivering')
    ORDER BY o.created_at DESC
  `).all();
  res.json(orders);
});

// Get orders assigned to driver
router.get('/driver/:driverId', (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, p.name as product_name, p.image_url as product_emoji, p.price_per_gram,
           u.name as consumer_name, u.phone as consumer_phone
    FROM orders o
    JOIN products p ON o.product_id = p.id
    JOIN users u ON o.consumer_id = u.id
    WHERE o.driver_id = ? AND o.status IN ('assigned', 'delivering')
    ORDER BY o.created_at ASC
  `).all(req.params.driverId);
  res.json(orders);
});

// Get queue position for an order
router.get('/:id/queue', (req, res) => {
  const order = db.prepare('SELECT id, status, created_at FROM orders WHERE id = ?').get(req.params.id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // Count orders ahead (created before this one, still active)
  const ahead = db.prepare(`
    SELECT COUNT(*) as count FROM orders
    WHERE status IN ('pending', 'approved', 'assigned')
      AND created_at < ?
      AND id != ?
  `).get(order.created_at, order.id) as any;

  const totalActive = db.prepare(`
    SELECT COUNT(*) as count FROM orders
    WHERE status IN ('pending', 'approved', 'assigned', 'delivering')
  `).get() as any;

  const position = ahead.count;
  // Rough estimate: ~8 minutes per order ahead
  const estimated_wait_minutes = Math.max(5, position * 8);

  res.json({
    order_id: order.id,
    status: order.status,
    position,
    total_active: totalActive.count,
    estimated_wait_minutes,
  });
});

// Get single order
router.get('/:id', (req, res) => {
  const order = db.prepare(`
    SELECT o.*, p.name as product_name, p.image_url as product_emoji, p.price_per_gram,
           u.name as consumer_name, u.phone as consumer_phone,
           d.name as driver_name
    FROM orders o
    JOIN products p ON o.product_id = p.id
    JOIN users u ON o.consumer_id = u.id
    LEFT JOIN users d ON o.driver_id = d.id
    WHERE o.id = ?
  `).get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// Approve order
router.post('/:id/approve', (req, res) => {
  db.prepare(`UPDATE orders SET status = 'approved', approved_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`).run(req.params.id);
  const order = db.prepare(`
    SELECT o.*, p.name as product_name, p.image_url as product_emoji, u.name as consumer_name
    FROM orders o JOIN products p ON o.product_id = p.id JOIN users u ON o.consumer_id = u.id
    WHERE o.id = ?
  `).get(req.params.id);
  res.json(order);
});

// Reject order
router.post('/:id/reject', (req, res) => {
  db.prepare(`UPDATE orders SET status = 'rejected' WHERE id = ? AND status = 'pending'`).run(req.params.id);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  res.json(order);
});

// Batch approve
router.post('/batch-approve', (req, res) => {
  const { orderIds } = req.body;
  if (!Array.isArray(orderIds)) return res.status(400).json({ error: 'orderIds array required' });

  const stmt = db.prepare(`UPDATE orders SET status = 'approved', approved_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`);
  const tx = db.transaction((ids: number[]) => {
    for (const id of ids) stmt.run(id);
  });
  tx(orderIds);
  res.json({ success: true, count: orderIds.length });
});

// Assign to driver
router.post('/:id/assign', (req, res) => {
  const { driver_id } = req.body;
  db.prepare(`UPDATE orders SET status = 'assigned', driver_id = ? WHERE id = ? AND status = 'approved'`).run(driver_id, req.params.id);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  res.json(order);
});

// Start delivering
router.post('/:id/delivering', (req, res) => {
  db.prepare(`UPDATE orders SET status = 'delivering' WHERE id = ? AND status = 'assigned'`).run(req.params.id);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  res.json(order);
});

// Mark delivered
router.post('/:id/delivered', (req, res) => {
  db.prepare(`UPDATE orders SET status = 'delivered' WHERE id = ?`).run(req.params.id);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  res.json(order);
});

export default router;
