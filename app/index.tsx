import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeIn, runOnJS } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, FontSize } from '@/constants/theme';

export default function Index() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const navigateToApp = () => {
    if (!user) {
      router.replace('/(auth)/phone');
    } else if (!user.role || !user.name) {
      router.replace('/(auth)/setup');
    } else {
      router.replace(`/${user.role}` as any);
    }
  };

  useEffect(() => {
    if (!isLoading) {
      // Wait for animation to complete, then navigate
      const timer = setTimeout(navigateToApp, 2000);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Animated.View entering={FadeIn.duration(800)} style={styles.content}>
          <Animated.Text entering={FadeInDown.delay(200).duration(800)} style={styles.brand}>
            SHISHA
          </Animated.Text>
          <Animated.View entering={FadeInDown.delay(400).duration(800)} style={styles.iconContainer}>
            <Text style={styles.icon}>💊</Text>
          </Animated.View>
          <Animated.Text entering={FadeInDown.delay(600).duration(800)} style={styles.tagline}>
            Premium Delivery
          </Animated.Text>
        </Animated.View>
      </View>
    );
  }

  // Show loading state briefly during navigation
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>SHISHA</Text>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>💊</Text>
      </View>
      <Text style={styles.tagline}>Premium Delivery</Text>
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
    marginBottom: 24,
  },
  iconContainer: {
    marginBottom: 16,
  },
  icon: {
    fontSize: 64,
  },
  tagline: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    fontWeight: '400',
    letterSpacing: 2,
  },
});