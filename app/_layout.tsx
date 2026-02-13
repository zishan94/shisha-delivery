import React, { useEffect, useRef } from 'react';
import { Platform, LogBox } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { Colors } from '@/constants/theme';
import NotificationBanner from '@/components/NotificationBanner';

// Suppress the expo-notifications warning in Expo Go (push notifications
// require a development build; the app falls back to in-app banners).
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  'expo-notifications: Push notifications',
  'Listening to push token changes is not yet fully supported',
]);

// Keep the native splash visible until we're ready
SplashScreen.preventAutoHideAsync().catch(() => {});

function InnerLayout() {
  const { isLoading, user } = useAuth();
  const router = useRouter();
  const notificationResponseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    if (!isLoading) {
      // Auth check done — hide native splash
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  // ── Handle notification tap (navigate to relevant screen) ──
  // Only set up on native — web doesn't support notification response listeners
  useEffect(() => {
    if (Platform.OS === 'web') return;

    notificationResponseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (!data || !user?.role) return;

        try {
          const { type, orderId, screen } = data as {
            type?: string;
            orderId?: number;
            screen?: string;
          };

          // Route based on notification type and user role
          if (type === 'order_status' || type === 'order_placed' || type === 'driver_approaching' || type === 'driver_arrived') {
            if (user.role === 'consumer' && orderId) {
              router.push({ pathname: '/consumer/tracking', params: { orderId: String(orderId) } } as any);
            }
          } else if (type === 'new_order') {
            if (user.role === 'approver') {
              router.push('/approver' as any);
            }
          } else if (type === 'new_delivery') {
            if (user.role === 'driver') {
              router.push('/driver' as any);
            }
          } else if (type === 'chat_message' && orderId) {
            if (user.role === 'consumer') {
              router.push({ pathname: '/consumer/tracking', params: { orderId: String(orderId) } } as any);
            } else if (user.role === 'approver') {
              router.push({ pathname: '/approver/chat', params: { orderId: String(orderId) } } as any);
            } else if (user.role === 'driver') {
              router.push('/driver' as any);
            }
          } else if (type === 'delivery_started' || type === 'delivery_completed') {
            if (user.role === 'approver') {
              router.push('/approver/active' as any);
            }
          } else if (screen) {
            // Fallback: navigate to the screen specified in the notification data
            router.push(`/${screen}` as any);
          }
        } catch (e) {
          console.error('Failed to handle notification tap:', e);
        }
      });

    return () => {
      if (notificationResponseListener.current) {
        // Use .remove() on the subscription object — removeNotificationSubscription
        // is not available on web.
        try {
          notificationResponseListener.current.remove();
        } catch {
          // Silently ignore on platforms where cleanup isn't supported
        }
      }
    };
  }, [user?.role, router]);

  return (
    <>
      <StatusBar style="dark" />
      <NotificationBanner />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SocketProvider>
          <LocationProvider>
            <InnerLayout />
          </LocationProvider>
        </SocketProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
