import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { useSocket } from '@/contexts/SocketContext';

export default function NotificationBanner() {
  const { notifications, clearNotification } = useSocket();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-100);
  const current = notifications[0];

  useEffect(() => {
    if (current) {
      translateY.value = withTiming(0, { duration: 300 });
      const timeout = setTimeout(() => {
        translateY.value = withTiming(-100, { duration: 300 });
        setTimeout(() => clearNotification(current.id), 350);
      }, 4000);
      return () => clearTimeout(timeout);
    }
  }, [current?.id]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!current) return null;

  return (
    <Animated.View style={[styles.container, { top: insets.top + 8 }, animStyle]}>
      <TouchableOpacity style={styles.banner} onPress={() => clearNotification(current.id)}>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.body}>{current.body}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 999,
  },
  banner: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  body: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
});
