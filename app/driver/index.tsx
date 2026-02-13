import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import GradientHeader from '@/components/GradientHeader';
import OrderCard from '@/components/OrderCard';
import SkeletonLoader from '@/components/SkeletonLoader';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useLocation } from '@/contexts/LocationContext';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { API_URL, DRIVER_LOCATION_INTERVAL_MS } from '@/constants/config';
import { showAlert } from '@/utils/alert';
import { hapticSuccess, hapticMedium } from '@/utils/haptics';

export default function DriverDashboard() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { getCurrentLocation } = useLocation();
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [tracking, setTracking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/orders/driver/${user.id}`);
      const data = await res.json();
      if (Array.isArray(data)) setOrders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoaded(true);
    }
  }, [user]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => loadOrders();
    socket.on('order:updated', handler);
    return () => { socket.off('order:updated', handler); };
  }, [socket, loadOrders]);

  const startTracking = () => {
    setTracking(true);
    const broadcast = async () => {
      const loc = await getCurrentLocation();
      if (loc && user) {
        socket?.emit('driver:location', { driver_id: user.id, lat: loc.latitude, lng: loc.longitude });
      }
    };
    broadcast();
    intervalRef.current = setInterval(broadcast, DRIVER_LOCATION_INTERVAL_MS);
  };

  const stopTracking = () => {
    setTracking(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  useEffect(() => { return () => { if (intervalRef.current) clearInterval(intervalRef.current); }; }, []);

  const startDelivering = async (orderId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}/delivering`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      const order = await res.json();
      socket?.emit('order:status', { orderId, status: 'delivering', order });
      hapticMedium();
      if (!tracking) startTracking();
      loadOrders();
    } catch (e) {
      showAlert('Error', 'Failed to start delivery');
    }
  };

  const markDelivered = async (orderId: number) => {
    showAlert('Confirm Delivery', 'Mark this order as delivered?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delivered', onPress: async () => {
        try {
          const res = await fetch(`${API_URL}/api/orders/${orderId}/delivered`, { method: 'POST' });
          if (!res.ok) throw new Error('Failed');
          const order = await res.json();
          socket?.emit('order:status', { orderId, status: 'delivered', order });
          hapticSuccess();
          loadOrders();
          const remaining = orders.filter((o) => o.id !== orderId && o.status === 'delivering');
          if (remaining.length === 0) stopTracking();
        } catch (e) {
          showAlert('Error', 'Failed to mark as delivered');
        }
      }},
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <GradientHeader
        title="Deliveries"
        subtitle={`${orders.length} assigned`}
        right={
          <AnimatedPressable onPress={tracking ? stopTracking : startTracking}>
            <View style={[styles.trackingBadge, { backgroundColor: tracking ? 'rgba(16,185,129,0.3)' : Colors.glassStrong }]}>
              <Ionicons name={tracking ? 'radio' : 'radio-outline'} size={16} color={tracking ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.trackingText, { color: tracking ? Colors.primary : Colors.textMuted }]}>
                {tracking ? 'Live' : 'Off'}
              </Text>
            </View>
          </AnimatedPressable>
        }
      />
      {!loaded ? (
        <SkeletonLoader count={3} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id.toString()}
          renderItem={({ item, index }) => (
            <View>
              <OrderCard order={item} showConsumer index={index} />
              <View style={styles.actionRow}>
                {item.status === 'assigned' && (
                  <AnimatedPressable style={{ flex: 1 }} onPress={() => startDelivering(item.id)}>
                    <LinearGradient colors={[Colors.info, '#2563EB']} style={styles.actionBtn}>
                      <Ionicons name="car-sport" size={20} color="#fff" />
                      <Text style={styles.actionText}>Start Delivering</Text>
                    </LinearGradient>
                  </AnimatedPressable>
                )}
                {item.status === 'delivering' && (
                  <AnimatedPressable style={{ flex: 1 }} onPress={() => markDelivered(item.id)}>
                    <LinearGradient colors={[Colors.success, '#059669']} style={styles.actionBtn}>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.actionText}>Mark Delivered</Text>
                    </LinearGradient>
                  </AnimatedPressable>
                )}
              </View>
            </View>
          )}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <Animated.View entering={FadeIn.delay(200)} style={styles.empty}>
              <Text style={styles.emptyEmoji}>🚗</Text>
              <Text style={styles.emptyText}>No deliveries</Text>
              <Text style={styles.emptySubtext}>Waiting for orders to be assigned</Text>
            </Animated.View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md },
  trackingBadge: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  trackingText: { fontSize: FontSize.xs, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, marginTop: -Spacing.xs },
  actionBtn: {
    padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  actionText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },
  empty: { alignItems: 'center', marginTop: Spacing.xxl },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.md },
  emptyText: { fontSize: FontSize.lg, color: Colors.text, fontWeight: '700' },
  emptySubtext: { fontSize: FontSize.sm, color: Colors.textMuted },
});
