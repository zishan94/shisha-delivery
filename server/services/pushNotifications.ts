import db from '../db';
import https from 'https';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
}

/**
 * Send push notifications via Expo Push API
 */
function sendExpoPush(messages: PushMessage[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(messages);
    const req = https.request(
      EXPO_PUSH_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Get all push tokens for a given user
 */
export function getUserPushTokens(userId: number): string[] {
  const rows = db
    .prepare('SELECT token FROM push_tokens WHERE user_id = ?')
    .all(userId) as { token: string }[];
  return rows.map((r) => r.token);
}

/**
 * Get all push tokens for users with a specific role
 */
export function getRolePushTokens(role: string): string[] {
  const rows = db
    .prepare(
      `SELECT pt.token FROM push_tokens pt
       JOIN users u ON pt.user_id = u.id
       WHERE u.role = ?`,
    )
    .all(role) as { token: string }[];
  return rows.map((r) => r.token);
}

/**
 * Register a push token for a user (upserts)
 */
export function registerPushToken(
  userId: number,
  token: string,
  platform?: string,
): void {
  // Remove this token from other users (device changed hands)
  db.prepare('DELETE FROM push_tokens WHERE token = ?').run(token);
  // Insert for current user
  db.prepare(
    `INSERT OR REPLACE INTO push_tokens (user_id, token, platform) VALUES (?, ?, ?)`,
  ).run(userId, token, platform || null);
  console.log(`📱 Push token registered for user ${userId}`);
}

/**
 * Unregister a push token
 */
export function unregisterPushToken(token: string): void {
  db.prepare('DELETE FROM push_tokens WHERE token = ?').run(token);
}

/**
 * Unregister all push tokens for a user
 */
export function unregisterUserPushTokens(userId: number): void {
  db.prepare('DELETE FROM push_tokens WHERE user_id = ?').run(userId);
}

/**
 * Send push notification to a specific user
 */
export async function sendPushToUser(
  userId: number,
  title: string,
  body: string,
  data?: Record<string, any>,
): Promise<void> {
  const tokens = getUserPushTokens(userId);
  if (tokens.length === 0) return;

  const messages: PushMessage[] = tokens.map((token) => ({
    to: token,
    title,
    body,
    data: data || {},
    sound: 'default',
    priority: 'high',
  }));

  try {
    const result = await sendExpoPush(messages);
    console.log(`📤 Push sent to user ${userId}:`, title);
    // Clean up invalid tokens
    if (result?.data) {
      result.data.forEach((item: any, idx: number) => {
        if (
          item.status === 'error' &&
          (item.details?.error === 'DeviceNotRegistered' ||
            item.details?.error === 'InvalidCredentials')
        ) {
          console.log(`🗑️ Removing invalid token: ${tokens[idx]}`);
          unregisterPushToken(tokens[idx]);
        }
      });
    }
  } catch (e) {
    console.error('Failed to send push notification:', e);
  }
}

/**
 * Send push notification to all users with a specific role
 */
export async function sendPushToRole(
  role: string,
  title: string,
  body: string,
  data?: Record<string, any>,
): Promise<void> {
  const tokens = getRolePushTokens(role);
  if (tokens.length === 0) return;

  const messages: PushMessage[] = tokens.map((token) => ({
    to: token,
    title,
    body,
    data: data || {},
    sound: 'default',
    priority: 'high',
  }));

  try {
    const result = await sendExpoPush(messages);
    console.log(`📤 Push sent to role ${role} (${tokens.length} devices):`, title);
    if (result?.data) {
      result.data.forEach((item: any, idx: number) => {
        if (
          item.status === 'error' &&
          (item.details?.error === 'DeviceNotRegistered' ||
            item.details?.error === 'InvalidCredentials')
        ) {
          unregisterPushToken(tokens[idx]);
        }
      });
    }
  } catch (e) {
    console.error('Failed to send push to role:', e);
  }
}

/**
 * Check if a notification of a certain type has already been sent for an order
 */
export function hasNotificationBeenSent(
  orderId: number,
  type: string,
): boolean {
  const row = db
    .prepare(
      'SELECT id FROM notification_sent WHERE order_id = ? AND notification_type = ?',
    )
    .get(orderId, type);
  return !!row;
}

/**
 * Mark a notification type as sent for an order
 */
export function markNotificationSent(
  orderId: number,
  type: string,
): void {
  try {
    db.prepare(
      'INSERT OR IGNORE INTO notification_sent (order_id, notification_type) VALUES (?, ?)',
    ).run(orderId, type);
  } catch {
    // Already marked
  }
}

/**
 * Haversine distance in kilometers between two lat/lng points
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
