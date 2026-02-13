import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { Colors, BorderRadius, Spacing } from '@/constants/theme';

interface Props {
  count?: number;
}

function SkeletonItem() {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.card, animStyle]}>
      <View style={styles.row}>
        <View style={styles.circle} />
        <View style={styles.lines}>
          <View style={styles.lineShort} />
          <View style={styles.lineLong} />
        </View>
        <View style={styles.badge} />
      </View>
    </Animated.View>
  );
}

export default function SkeletonLoader({ count = 3 }: Props) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonItem key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md },
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  circle: {
    width: 52, height: 52, borderRadius: BorderRadius.md,
    backgroundColor: Colors.glassStrong, marginRight: Spacing.md,
  },
  lines: { flex: 1 },
  lineShort: {
    width: '60%', height: 14, borderRadius: 4,
    backgroundColor: Colors.glassStrong, marginBottom: 8,
  },
  lineLong: {
    width: '85%', height: 10, borderRadius: 4,
    backgroundColor: Colors.glassStrong,
  },
  badge: {
    width: 60, height: 22, borderRadius: BorderRadius.full,
    backgroundColor: Colors.glassStrong,
  },
});
