import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OrderCard from '@/components/OrderCard';
import SkeletonLoader from '@/components/SkeletonLoader';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { Colors, FontSize, Spacing, Shadows } from '@/constants/theme';
import { API_URL } from '@/constants/config';

export default function OrdersScreen() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const loadOrders = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/orders/consumer/${user.id}`);
      const data = await res.json();
      if (Array.isArray(data)) setOrders(data);
    } catch (e) {
      console.error('Failed to load orders:', e);
    } finally {
      setLoaded(true);
    }
  }, [user]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => loadOrders();
    socket.on('order:updated', handler);
    socket.on('order:status-changed', handler);
    return () => {
      socket.off('order:updated', handler);
      socket.off('order:status-changed', handler);
    };
  }, [socket, loadOrders]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Orders</Text>
        <Text style={styles.subtitle}>{orders.length} order{orders.length !== 1 ? 's' : ''}</Text>
      </View>
      {!loaded ? (
        <SkeletonLoader count={3} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id.toString()}
          renderItem={({ item, index }) => (
            <OrderCard
              order={item}
              index={index}
              onPress={() => router.push({ pathname: '/consumer/tracking', params: { orderId: item.id.toString() } } as any)}
            />
          )}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={onRefresh}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Animated.View entering={FadeIn.delay(200)} style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📦</Text>
              <Text style={styles.emptyText}>No orders yet</Text>
              <Text style={styles.emptySubtext}>Browse products and place your first order!</Text>
            </Animated.View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  list: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  emptyContainer: { 
    alignItems: 'center', 
    marginTop: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyEmoji: { 
    fontSize: 64, 
    marginBottom: Spacing.lg 
  },
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
    lineHeight: 20,
  },
});
