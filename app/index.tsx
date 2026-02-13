import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, FontSize } from '@/constants/theme';

export default function Index() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    if (isLoading || navigating) return;

    // Navigate immediately once auth is resolved
    setNavigating(true);

    // Use a microtask delay so the router is fully mounted
    const timer = setTimeout(() => {
      if (!user) {
        router.replace('/(auth)/phone');
      } else if (!user.role || !user.name) {
        router.replace('/(auth)/setup');
      } else {
        router.replace(`/${user.role}` as any);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isLoading, user]);

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeIn.duration(600)} style={styles.content}>
        <Animated.Text entering={FadeInDown.delay(100).duration(500)} style={styles.brand}>
          SHISHA
        </Animated.Text>
        <Text style={styles.icon}>💊</Text>
        <Animated.Text entering={FadeInDown.delay(200).duration(500)} style={styles.tagline}>
          Premium Lieferung
        </Animated.Text>
        <ActivityIndicator
          size="small"
          color={Colors.textMuted}
          style={styles.loader}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  content: {
    alignItems: 'center',
  },
  brand: {
    fontSize: 48,
    fontWeight: '300',
    color: Colors.primary,
    letterSpacing: 8,
    marginBottom: 20,
  },
  icon: {
    fontSize: 56,
    marginBottom: 12,
  },
  tagline: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    fontWeight: '400',
    letterSpacing: 2,
  },
  loader: {
    marginTop: 32,
  },
});
