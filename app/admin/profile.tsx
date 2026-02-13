import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '@/constants/theme';

export default function AdminProfile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Abmelden',
      'Möchtest du dich wirklich abmelden?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Abmelden',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/phone');
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.gradientStart, Colors.gradientEnd]} style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.avatarWrap}>
          <Ionicons name="shield" size={36} color={Colors.secondary} />
        </View>
        <Text style={styles.name}>{user?.name || 'Admin'}</Text>
        <Text style={styles.role}>Administrator</Text>
      </LinearGradient>

      <View style={styles.content}>
        {/* Info Cards */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color={Colors.secondary} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Telefon</Text>
              <Text style={styles.infoValue}>{user?.phone || 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={Colors.secondary} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Rolle</Text>
              <Text style={styles.infoValue}>Admin</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color={Colors.secondary} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Erstellt am</Text>
              <Text style={styles.infoValue}>
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('de-CH') : 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Links */}
        <Text style={styles.sectionTitle}>Verwaltung</Text>
        <View style={styles.linksCard}>
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/admin/products' as any)} activeOpacity={0.6}>
            <Ionicons name="cube-outline" size={20} color={Colors.text} />
            <Text style={styles.linkText}>Produkte verwalten</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/admin/category-manage' as any)} activeOpacity={0.6}>
            <Ionicons name="pricetags-outline" size={20} color={Colors.text} />
            <Text style={styles.linkText}>Kategorien verwalten</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/admin/users' as any)} activeOpacity={0.6}>
            <Ionicons name="people-outline" size={20} color={Colors.text} />
            <Text style={styles.linkText}>Benutzer verwalten</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/admin/orders' as any)} activeOpacity={0.6}>
            <Ionicons name="receipt-outline" size={20} color={Colors.text} />
            <Text style={styles.linkText}>Alle Bestellungen</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>Shisha Delivery v1.0.0</Text>
          <Text style={styles.appBuild}>Admin Panel</Text>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Abmelden</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    alignItems: 'center',
    paddingBottom: Spacing.xl,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  name: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: '#FFF',
  },
  role: {
    fontSize: FontSize.sm,
    color: Colors.secondary,
    fontWeight: '600',
    marginTop: 2,
  },
  content: { flex: 1, padding: Spacing.md },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  infoText: { flex: 1 },
  infoLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  infoValue: { fontSize: FontSize.md, color: Colors.text, fontWeight: '500' },
  divider: { height: 1, backgroundColor: Colors.border },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  linksCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm,
  },
  linkText: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  appInfo: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  appVersion: { fontSize: FontSize.sm, color: Colors.textMuted },
  appBuild: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.error + '30',
    ...Shadows.sm,
  },
  logoutText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.error,
  },
});
