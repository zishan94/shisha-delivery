import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import GradientHeader from '@/components/GradientHeader';
import AnimatedPressable from '@/components/AnimatedPressable';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { showAlert } from '@/utils/alert';

export default function DriverProfile() {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const router = useRouter();

  const handleLogout = () => {
    showAlert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/phone'); }},
    ]);
  };

  return (
    <View style={styles.container}>
      <GradientHeader title="Profile" />
      <View style={styles.content}>
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || '?'}</Text>
        </Animated.View>
        <Animated.Text entering={FadeInDown.delay(200).springify()} style={styles.name}>{user?.name}</Animated.Text>
        <Animated.Text entering={FadeInDown.delay(250).springify()} style={styles.phone}>{user?.phone}</Animated.Text>
        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.badge}>
          <Ionicons name="car" size={14} color={Colors.primary} />
          <Text style={styles.badgeText}>Driver</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Connection</Text>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: isConnected ? Colors.success : Colors.error }]} />
              <Text style={styles.infoValue}>{isConnected ? 'Connected' : 'Disconnected'}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Role</Text>
            <Text style={styles.infoValue}>Delivery Driver</Text>
          </View>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(500).springify()}>
          <AnimatedPressable style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#fff" />
            <Text style={styles.logoutText}>Logout</Text>
          </AnimatedPressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { alignItems: 'center', padding: Spacing.xl },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md,
  },
  avatarText: { fontSize: FontSize.title, fontWeight: '800', color: '#fff' },
  name: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  phone: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: 4 },
  badge: {
    backgroundColor: `${Colors.primary}15`, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, marginTop: Spacing.sm,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  badgeText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
  infoCard: {
    width: '100%', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginTop: Spacing.xl, ...Shadows.md,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  infoLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.md, color: Colors.text, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  logoutBtn: {
    marginTop: Spacing.xl, backgroundColor: Colors.error, paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md, borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  logoutText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
});
