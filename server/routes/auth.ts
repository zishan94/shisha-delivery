import { Router } from 'express';
import db from '../db';

const router = Router();

// Request verification code (demo: always succeeds)
router.post('/request-code', (req, res) => {
  const { phone } = req.body;
  if (!phone || typeof phone !== 'string' || phone.length < 5) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }
  res.json({ success: true, message: 'Verification code sent (demo: use any 6-digit code)' });
});

// Verify code and login/register (consumer flow)
router.post('/verify', (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone and code required' });
  }
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Code must be 6 digits' });
  }

  let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone) as any;
  const isNew = !user;

  if (!user) {
    const result = db.prepare('INSERT INTO users (phone, role) VALUES (?, ?)').run(phone, 'consumer');
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  }

  res.json({ user, isNew });
});

// Staff login (username + password)
router.post('/staff-login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const cred = db.prepare('SELECT * FROM staff_credentials WHERE username = ? AND password = ?').get(username, password) as any;
  if (!cred) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(cred.user_id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user });
});

// Set user profile (name + role)
router.post('/profile', (req, res) => {
  const { userId, name, role } = req.body;
  if (!userId || !name || !role) {
    return res.status(400).json({ error: 'userId, name, and role required' });
  }
  if (!['consumer', 'approver', 'driver'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  db.prepare('UPDATE users SET name = ?, role = ? WHERE id = ?').run(name, role, userId);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  res.json({ user });
});

// Get user by id
router.get('/user/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

export default router;
