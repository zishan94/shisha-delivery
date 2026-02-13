import { Router } from 'express';
import db from '../db';

const router = Router();

// Get messages for an order
router.get('/:orderId', (req, res) => {
  const messages = db.prepare(`
    SELECT m.*, u.name as sender_name, u.role as sender_role
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.order_id = ?
    ORDER BY m.created_at ASC
  `).all(req.params.orderId);
  res.json(messages);
});

// Send message
router.post('/', (req, res) => {
  const { order_id, sender_id, text } = req.body;
  if (!order_id || !sender_id || !text) {
    return res.status(400).json({ error: 'order_id, sender_id, and text required' });
  }

  const result = db.prepare('INSERT INTO messages (order_id, sender_id, text) VALUES (?, ?, ?)').run(order_id, sender_id, text);
  const message = db.prepare(`
    SELECT m.*, u.name as sender_name, u.role as sender_role
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.id = ?
  `).get(result.lastInsertRowid);
  res.json(message);
});

export default router;
