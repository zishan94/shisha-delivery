import { Router } from 'express';
import db from '../db';

const router = Router();

// Get messages for an order
// Accepts optional ?role=consumer to filter out staff-only messages
router.get('/:orderId', (req, res) => {
  const role = req.query.role as string | undefined;

  let sql = `
    SELECT m.*, u.name as sender_name, u.role as sender_role
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.order_id = ?
  `;

  // If consumer is viewing, hide staff-only messages
  if (role === 'consumer') {
    sql += ` AND (m.visibility = 'all' OR m.visibility IS NULL)`;
  }

  // If driver is viewing, only show staff messages (driver <-> approver)
  if (role === 'driver') {
    sql += ` AND m.visibility = 'staff'`;
  }

  sql += ` ORDER BY m.created_at ASC`;

  const messages = db.prepare(sql).all(req.params.orderId);
  res.json(messages);
});

// Send message
// Accepts optional visibility field: 'all' (default) or 'staff' (driver + approver only)
router.post('/', (req, res) => {
  const { order_id, sender_id, text, visibility } = req.body;
  if (!order_id || !sender_id || !text) {
    return res.status(400).json({ error: 'order_id, sender_id, and text required' });
  }

  // Determine visibility: staff messages from driver/approver, 'all' from consumers
  const sender = db.prepare('SELECT role FROM users WHERE id = ?').get(sender_id) as any;
  let msgVisibility = visibility || 'all';

  // Auto-set visibility based on sender role: drivers and approvers send staff-only by default
  if (!visibility && sender && (sender.role === 'driver' || sender.role === 'approver')) {
    msgVisibility = 'staff';
  }

  const result = db.prepare('INSERT INTO messages (order_id, sender_id, text, visibility) VALUES (?, ?, ?, ?)').run(
    order_id, sender_id, text, msgVisibility
  );
  const message = db.prepare(`
    SELECT m.*, u.name as sender_name, u.role as sender_role
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.id = ?
  `).get(result.lastInsertRowid);
  res.json(message);
});

export default router;
