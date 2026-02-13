import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSize, BorderRadius, Shadows, StatusColors, StatusLabels } from '@/constants/theme';
import { API_URL } from '@/constants/config';

const ALL_STATUSES = ['all', 'pending', 'approved', 'assigned', 'delivering', 'delivered', 'rejected'];

interface Order {
  id: number;
  consumer_id: number;
  product_id: number;
  amount_grams: number;
  total_price: number;
  delivery_address: string;
  customer_name: string;
  status: string;
  created_at: string;
  driver_id: number | null;
  consumer_name: string;
  consumer_phone: string;
  product_name: string;
  product_image: string;
  driver_name: string | null;
  driver_region: string | null;
}

export default function AdminOrders() {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchOrders = useCallback(async () => {
    try {
      let url = `${API_URL}/api/admin/orders?limit=50`;
      if (statusFilter !== 'all') url += `&status=${statusFilter}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders);
        setTotal(data.total);
      }
    } catch (e) {
      console.error('Failed to fetch orders:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = () => { setRefreshing(true); fetchOrders(); };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const renderOrder = ({ item }: { item: Order }) => {
    const statusColor = StatusColors[item.status] || Colors.textMuted;
    return (
      <View style={styles.orderCard}>
        <View style={styles.orderTop}>
          <View style={styles.orderIdRow}>
            <Text style={styles.orderId}>#{item.id}</Text>
            <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {StatusLabels[item.status] || item.status}
            </Text>
          </View>
        </View>

        <View style={styles.orderBody}>
          <View style={styles.orderRow}>
            <Ionicons name="cube-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.orderBodyText} numberOfLines={1}>
              {item.product_name} - {item.amount_grams}g
            </Text>
          </View>
          <View style={styles.orderRow}>
            <Ionicons name="person-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.orderBodyText}>{item.consumer_name || 'Unbekannt'}</Text>
            <Text style={styles.orderPhone}>{item.consumer_phone}</Text>
          </View>
          {item.driver_name && (
            <View style={styles.orderRow}>
              <Ionicons name="car-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.orderBodyText}>{item.driver_name}</Text>
              {item.driver_region && <Text style={styles.orderRegion}>{item.driver_region}</Text>}
            </View>
          )}
          {item.delivery_address && (
            <View style={styles.orderRow}>
              <Ionicons name="location-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.orderBodyText} numberOfLines={1}>{item.delivery_address}</Text>
            </View>
          )}
        </View>

        <View style={styles.orderFooter}>
          <Text style={styles.orderPrice}>CHF {item.total_price?.toFixed(2)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.gradientStart, Colors.gradientEnd]} style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={styles.headerTitle}>Bestellungen</Text>
        <Text style={styles.headerSubtitle}>{total} gesamt</Text>
      </LinearGradient>

      {/* Status Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
      >
        {ALL_STATUSES.map((status) => {
          const isActive = statusFilter === status;
          const color = status === 'all' ? Colors.primary : (StatusColors[status] || Colors.textMuted);
          return (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                isActive && { backgroundColor: color, borderColor: color },
              ]}
              onPress={() => setStatusFilter(status)}
              activeOpacity={0.7}
            >
              {status !== 'all' && (
                <View style={[styles.filterDot, { backgroundColor: isActive ? '#FFF' : color }]} />
              )}
              <Text style={[styles.filterChipText, isActive && { color: '#FFF' }]}>
                {status === 'all' ? 'Alle' : (StatusLabels[status] || status)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.secondary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.secondary} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="receipt-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Keine Bestellungen gefunden</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: '700', color: '#FFF', letterSpacing: 0.5 },
  headerSubtitle: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  filterList: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    height: 36,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    gap: 6,
  },
  filterDot: { width: 7, height: 7, borderRadius: 4 },
  filterChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  list: { paddingHorizontal: Spacing.md, paddingBottom: 40 },
  orderCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  orderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  orderIdRow: { gap: 4 },
  orderId: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  orderDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    gap: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: FontSize.xs, fontWeight: '600' },
  orderBody: { gap: 4, marginBottom: Spacing.sm },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderBodyText: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  orderPhone: { fontSize: FontSize.xs, color: Colors.textMuted },
  orderRegion: { fontSize: FontSize.xs, color: Colors.secondary, fontWeight: '600' },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  orderPrice: { fontSize: FontSize.md, fontWeight: '700', color: Colors.secondary },
  emptyWrap: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted },
});
