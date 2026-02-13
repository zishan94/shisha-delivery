import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, FontSize, BorderRadius, Shadows, StatusColors, StatusLabels } from '@/constants/theme';
import { API_URL } from '@/constants/config';

interface Stats {
  totalUsers: number;
  totalOrders: number;
  totalProducts: number;
  totalRevenue: number;
  todayOrders: number;
  todayRevenue: number;
  ordersByStatus: { status: string; count: number }[];
  usersByRole: { role: string; count: number }[];
  recentOrders: any[];
}

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const onRefresh = () => { setRefreshing(true); fetchStats(); };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.secondary} style={{ marginTop: 100 }} />
      </View>
    );
  }

  const statusData = stats?.ordersByStatus || [];
  const roleData = stats?.usersByRole || [];

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.gradientStart, Colors.gradientEnd]} style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Admin Dashboard</Text>
            <Text style={styles.headerSubtitle}>Gesamtübersicht</Text>
          </View>
          <TouchableOpacity style={styles.logoutIconBtn} onPress={handleLogout} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.secondary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Stat Cards */}
        <View style={styles.statsGrid}>
          <StatCard icon="cart" label="Bestellungen" value={stats?.totalOrders ?? 0} color={Colors.info} />
          <StatCard icon="cash" label="Umsatz (CHF)" value={`${(stats?.totalRevenue ?? 0).toFixed(2)}`} color={Colors.success} />
          <StatCard icon="people" label="Benutzer" value={stats?.totalUsers ?? 0} color={Colors.assigned} />
          <StatCard icon="cube" label="Produkte" value={stats?.totalProducts ?? 0} color={Colors.secondary} />
        </View>

        {/* Today Highlight */}
        <View style={styles.todayCard}>
          <LinearGradient colors={['#C8A97E', '#D4BA94']} style={styles.todayGradient}>
            <Text style={styles.todayTitle}>Heute</Text>
            <View style={styles.todayRow}>
              <View style={styles.todayStat}>
                <Text style={styles.todayValue}>{stats?.todayOrders ?? 0}</Text>
                <Text style={styles.todayLabel}>Bestellungen</Text>
              </View>
              <View style={styles.todayDivider} />
              <View style={styles.todayStat}>
                <Text style={styles.todayValue}>CHF {(stats?.todayRevenue ?? 0).toFixed(2)}</Text>
                <Text style={styles.todayLabel}>Umsatz</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Order Status Breakdown */}
        <Text style={styles.sectionTitle}>Bestellstatus</Text>
        <View style={styles.statusGrid}>
          {statusData.map((s) => (
            <View key={s.status} style={styles.statusChip}>
              <View style={[styles.statusDot, { backgroundColor: StatusColors[s.status] || Colors.textMuted }]} />
              <Text style={styles.statusLabel}>{StatusLabels[s.status] || s.status}</Text>
              <Text style={styles.statusCount}>{s.count}</Text>
            </View>
          ))}
          {statusData.length === 0 && <Text style={styles.emptyText}>Keine Bestellungen</Text>}
        </View>

        {/* Users by Role */}
        <Text style={styles.sectionTitle}>Benutzer nach Rolle</Text>
        <View style={styles.roleGrid}>
          {roleData.map((r) => (
            <View key={r.role} style={styles.roleChip}>
              <Ionicons
                name={r.role === 'consumer' ? 'person' : r.role === 'driver' ? 'car' : r.role === 'admin' ? 'shield' : 'checkmark-circle'}
                size={18}
                color={Colors.secondary}
              />
              <Text style={styles.roleLabel}>{r.role === 'consumer' ? 'Kunden' : r.role === 'driver' ? 'Fahrer' : r.role === 'admin' ? 'Admins' : 'Genehmiger'}</Text>
              <Text style={styles.roleCount}>{r.count}</Text>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Schnellaktionen</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/admin/products' as any)} activeOpacity={0.7}>
            <Ionicons name="add-circle" size={24} color={Colors.secondary} />
            <Text style={styles.actionText}>Produkt hinzufügen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/admin/orders' as any)} activeOpacity={0.7}>
            <Ionicons name="list" size={24} color={Colors.secondary} />
            <Text style={styles.actionText}>Alle Bestellungen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/admin/users' as any)} activeOpacity={0.7}>
            <Ionicons name="people" size={24} color={Colors.secondary} />
            <Text style={styles.actionText}>Konten verwalten</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Orders */}
        <Text style={styles.sectionTitle}>Letzte Bestellungen</Text>
        {(stats?.recentOrders || []).length === 0 ? (
          <Text style={styles.emptyText}>Keine Bestellungen vorhanden</Text>
        ) : (
          (stats?.recentOrders || []).map((order: any) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderId}>#{order.id}</Text>
                <View style={[styles.orderStatusBadge, { backgroundColor: (StatusColors[order.status] || Colors.textMuted) + '20' }]}>
                  <Text style={[styles.orderStatusText, { color: StatusColors[order.status] || Colors.textMuted }]}>
                    {StatusLabels[order.status] || order.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.orderProduct}>{order.product_name}</Text>
              <View style={styles.orderDetails}>
                <Text style={styles.orderDetail}>{order.consumer_name || 'Kunde'}</Text>
                <Text style={styles.orderDetail}>{order.amount_grams}g</Text>
                <Text style={styles.orderPrice}>CHF {order.total_price?.toFixed(2)}</Text>
              </View>
              {order.driver_name && (
                <Text style={styles.orderDriver}>Fahrer: {order.driver_name}</Text>
              )}
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconWrap, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  logoutIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  content: { flex: 1 },
  contentContainer: { padding: Spacing.md },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  todayCard: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  todayGradient: {
    padding: Spacing.lg,
  },
  todayTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: Spacing.md,
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  todayStat: {
    flex: 1,
    alignItems: 'center',
  },
  todayValue: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  todayLabel: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  todayDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    height: 36,
    paddingHorizontal: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  statusCount: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    height: 38,
    paddingHorizontal: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  roleLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  roleCount: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 6,
    ...Shadows.sm,
  },
  actionText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  orderCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderId: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  orderStatusBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  orderStatusText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  orderProduct: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  orderDetails: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
  },
  orderDetail: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  orderPrice: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.secondary,
  },
  orderDriver: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    padding: Spacing.lg,
  },
});
