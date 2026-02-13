import { Router } from 'express';
import {
  registerPushToken,
  unregisterPushToken,
  unregisterUserPushTokens,
} from '../services/pushNotifications';

const router = Router();

/**
 * POST /api/notifications/register
 * Register a push token for a user
 */
router.post('/register', (req, res) => {
  const { userId, token, platform } = req.body;

  if (!userId || !token) {
    return res.status(400).json({ error: 'userId and token are required' });
  }

  try {
    registerPushToken(userId, token, platform);
    res.json({ success: true });
  } catch (e: any) {
    console.error('Failed to register push token:', e);
    res.status(500).json({ error: 'Failed to register push token' });
  }
});

/**
 * POST /api/notifications/unregister
 * Unregister a specific push token
 */
router.post('/unregister', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'token is required' });
  }

  try {
    unregisterPushToken(token);
    res.json({ success: true });
  } catch (e: any) {
    console.error('Failed to unregister push token:', e);
    res.status(500).json({ error: 'Failed to unregister push token' });
  }
});

/**
 * POST /api/notifications/unregister-user
 * Unregister all push tokens for a user (e.g., on logout)
 */
router.post('/unregister-user', (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    unregisterUserPushTokens(userId);
    res.json({ success: true });
  } catch (e: any) {
    console.error('Failed to unregister user push tokens:', e);
    res.status(500).json({ error: 'Failed to unregister user tokens' });
  }
});

export default router;
