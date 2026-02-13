import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, FontWeight, Spacing } from '@/constants/theme';

interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  compact?: boolean;
}

export default function GradientHeader({ title, subtitle, right, compact }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Animated.View entering={FadeIn.duration(400)}>
      <LinearGradient
        colors={[Colors.gradientStart, Colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.container,
          { paddingTop: insets.top + (compact ? Spacing.sm : Spacing.md) },
        ]}
      >
        <View style={styles.content}>
          <View style={styles.textContainer}>
            <Animated.Text
              entering={SlideInDown.delay(100).duration(300).springify()}
              style={[styles.title, compact && styles.titleCompact]}
            >
              {title}
            </Animated.Text>
            {subtitle && (
              <Animated.Text
                entering={FadeIn.delay(200).duration(300)}
                style={styles.subtitle}
              >
                {subtitle}
              </Animated.Text>
            )}
          </View>
          {right && <View style={styles.rightSlot}>{right}</View>}
        </View>
        {/* Accent bottom edge */}
        <View style={styles.accentLine} />
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 0,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.md,
  },
  textContainer: { flex: 1 },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.black,
    color: Colors.textOnDark,
    letterSpacing: -0.5,
  },
  titleCompact: {
    fontSize: FontSize.xl,
  },
  subtitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  rightSlot: {
    marginLeft: Spacing.md,
  },
  accentLine: {
    height: 3,
    backgroundColor: Colors.accent,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
});
