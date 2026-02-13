import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { API_URL } from '@/constants/config';

/**
 * Configure how notifications are handled when the app is in the foreground.
 * We show them as banners/alerts so users always see them.
 */
export function configureNotificationHandler() {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    // Not supported on web — in-app banners will handle foreground notifications
  }
}

/**
 * Create notification channels for Android
 */
export async function setupNotificationChannels() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Bestellungen',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1A1A2E',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('chat', {
      name: 'Chat Nachrichten',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200],
      lightColor: '#2196F3',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('delivery', {
      name: 'Lieferung',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4CAF50',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('general', {
      name: 'Allgemein',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }
}

/**
 * Request notification permissions and get the Expo push token.
 * Returns the token string or null if permissions denied.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('📱 Push notifications require a physical device');
    // On simulators/emulators, we still return null gracefully
    // The app will fall back to in-app banner notifications
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('📱 Push notification permission not granted');
      return null;
    }

    // Get the Expo push token — requires an EAS projectId.
    // If not configured (e.g. running in Expo Go without EAS), fall back gracefully.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.log('📱 No EAS projectId configured — push notifications disabled. In-app banners will still work.');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('📱 Expo push token:', tokenData.data);
    return tokenData.data;
  } catch (error) {
    // Use console.log instead of console.error to avoid triggering the red LogBox in dev
    console.log('📱 Push token registration skipped:', (error as Error)?.message || error);
    return null;
  }
}

/**
 * Send the push token to the server for a specific user
 */
export async function registerTokenWithServer(
  userId: number,
  token: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/notifications/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        token,
        platform: Platform.OS,
      }),
    });
    return res.ok;
  } catch (error) {
    console.error('Failed to register token with server:', error);
    return false;
  }
}

/**
 * Unregister push token from the server (e.g., on logout)
 */
export async function unregisterTokenFromServer(
  token: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/notifications/unregister`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return res.ok;
  } catch (error) {
    console.error('Failed to unregister token:', error);
    return false;
  }
}

/**
 * Unregister all push tokens for a user (e.g., on logout)
 */
export async function unregisterUserTokensFromServer(
  userId: number,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/notifications/unregister-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return res.ok;
  } catch (error) {
    console.error('Failed to unregister user tokens:', error);
    return false;
  }
}

/**
 * Get the badge count
 */
export async function getBadgeCount(): Promise<number> {
  if (Platform.OS === 'web') return 0;
  try {
    return await Notifications.getBadgeCountAsync();
  } catch {
    return 0;
  }
}

/**
 * Set the badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch {
    // Ignore errors on platforms that don't support badges
  }
}

/**
 * Clear all notifications from the notification center
 */
export async function clearAllNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.dismissAllNotificationsAsync();
    await setBadgeCount(0);
  } catch {
    // Ignore
  }
}
