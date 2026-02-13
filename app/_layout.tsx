import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/contexts/AuthContext';
import { SocketProvider } from '@/contexts/SocketContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { Colors } from '@/constants/theme';
import NotificationBanner from '@/components/NotificationBanner';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SocketProvider>
          <LocationProvider>
            <StatusBar style="light" />
            <NotificationBanner />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: Colors.background },
                animation: 'slide_from_right',
              }}
            />
          </LocationProvider>
        </SocketProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
