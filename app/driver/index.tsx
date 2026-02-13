import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import GradientHeader from '@/components/GradientHeader';
import OrderCard from '@/components/OrderCard';
import SkeletonLoader from '@/components/SkeletonLoader';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useLocation } from '@/contexts/LocationContext';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
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
        title="🚗 My Deliveries"
        subtitle={`${orders.length} order${orders.length !== 1 ? 's' : ''} assigned`}
        right={
          <AnimatedPressable onPress={tracking ? stopTracking : startTracking}>
            <View style={[
              styles.trackingBadge, 
              { backgroundColor: tracking ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.25)' }
            ]}>
              <Ionicons 
                name={tracking ? 'radio' : 'radio-outline'} 
                size={18} 
                color={tracking ? Colors.success : '#fff'} 
              />
              <Text style={[styles.trackingText, { color: tracking ? Colors.success : '#fff' }]}>
                {tracking ? '🟢 Live' : '⚫ Off'}
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
                  <AnimatedPressable style={[styles.actionBtn, { flex: 1 }]} onPress={() => startDelivering(item.id)}>
                    <Ionicons name="car-sport" size={20} color="#fff" />
                    <Text style={styles.actionText}>Start Delivering</Text>
                  </AnimatedPressable>
                )}
                {item.status === 'delivering' && (
                  <AnimatedPressable style={[styles.actionBtn, { flex: 1 }]} onPress={() => markDelivered(item.id)}>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.actionText}>Mark Delivered</Text>
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
  list: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  trackingBadge: {
    paddingHorizontal: Spacing.md, 
    paddingVertical: Spacing.sm, 
    borderRadius: BorderRadius.full,
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6,
    shadowColor: 'rgba(0,0,0,0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  trackingText: { 
    fontSize: FontSize.sm, 
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  actionRow: { 
    flexDirection: 'row', 
    gap: Spacing.md, 
    marginBottom: Spacing.lg, 
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  actionBtn: {
    backgroundColor: Colors.primary,
    padding: Spacing.lg, 
    borderRadius: BorderRadius.xl, 
    alignItems: 'center',
    flexDirection: 'row', 
    justifyContent: 'center', 
    gap: Spacing.sm,
    ...Shadows.md,
  },
  actionText: { 
    color: '#fff', 
    fontWeight: '800', 
    fontSize: FontSize.lg,
  },
  empty: { 
    alignItems: 'center', 
    marginTop: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyEmoji: { fontSize: 64, marginBottom: Spacing.lg },
  emptyText: { 
    fontSize: FontSize.xl, 
    color: Colors.text, 
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtext: { 
    fontSize: FontSize.md, 
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
