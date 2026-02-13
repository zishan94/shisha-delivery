import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import GradientHeader from '@/components/GradientHeader';
import OrderCard from '@/components/OrderCard';
import SkeletonLoader from '@/components/SkeletonLoader';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useSocket } from '@/contexts/SocketContext';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { API_URL } from '@/constants/config';
import { showAlert } from '@/utils/alert';
import { hapticSuccess, hapticError } from '@/utils/haptics';

export default function ApproverDashboard() {
  const { socket } = useSocket();
  const [orders, setOrders] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const router = useRouter();

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/orders/pending`);
      const data = await res.json();
      if (Array.isArray(data)) setOrders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => loadOrders();
    socket.on('order:new', handler);
    socket.on('order:updated', handler);
    return () => {
      socket.off('order:new', handler);
      socket.off('order:updated', handler);
    };
  }, [socket, loadOrders]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const approveOrder = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/api/orders/${id}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      const order = await res.json();
      socket?.emit('order:status', { orderId: id, status: 'approved', order });
      hapticSuccess();
      loadOrders();
    } catch (e) {
      showAlert('Error', 'Failed to approve');
      hapticError();
    }
  };

  const rejectOrder = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/api/orders/${id}/reject`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      const order = await res.json();
      socket?.emit('order:status', { orderId: id, status: 'rejected', order });
      hapticError();
      loadOrders();
    } catch (e) {
      showAlert('Error', 'Failed to reject');
    }
  };

  const batchApprove = async () => {
    if (selected.size === 0) return;
    try {
      await fetch(`${API_URL}/api/orders/batch-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: Array.from(selected) }),
      });
      selected.forEach((id) => socket?.emit('order:status', { orderId: id, status: 'approved' }));
      hapticSuccess();
      setSelected(new Set());
      setBatchMode(false);
      loadOrders();
    } catch (e) {
      showAlert('Error', 'Batch approve failed');
    }
  };

  const renderOrder = ({ item, index }: { item: any; index: number }) => (
    <View>
      <OrderCard
        order={item}
        showConsumer
        selectable={batchMode}
        selected={selected.has(item.id)}
        index={index}
        onPress={() => batchMode ? toggleSelect(item.id) : undefined}
      />
      {!batchMode && (
        <View style={styles.actionRow}>
          <AnimatedPressable style={styles.rejectBtn} onPress={() => rejectOrder(item.id)}>
            <Ionicons name="close" size={18} color={Colors.error} />
            <Text style={styles.rejectText}>Reject</Text>
          </AnimatedPressable>
          <AnimatedPressable onPress={() => router.push({ pathname: '/approver/chat', params: { orderId: item.id.toString() } } as any)}>
            <View style={styles.chatBtn}>
              <Ionicons name="chatbubble-outline" size={18} color={Colors.textSecondary} />
            </View>
          </AnimatedPressable>
          <AnimatedPressable style={styles.approveBtn} onPress={() => approveOrder(item.id)}>
            <View style={styles.approveBtnInner}>
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.approveText}>Approve</Text>
            </View>
          </AnimatedPressable>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <GradientHeader
        title="✅ Pending Orders"
        subtitle={`${orders.length} order${orders.length !== 1 ? 's' : ''} awaiting review`}
        right={
          <View style={styles.headerRight}>
            {orders.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{orders.length}</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => { setBatchMode(!batchMode); setSelected(new Set()); }}>
              <Text style={styles.batchToggle}>{batchMode ? '❌ Cancel' : '📋 Batch'}</Text>
            </TouchableOpacity>
          </View>
        }
      />
      {batchMode && selected.size > 0 && (
        <AnimatedPressable onPress={batchApprove}>
          <View style={styles.batchBar}>
            <Ionicons name="checkmark-done" size={20} color="#fff" />
            <Text style={styles.batchText}>Approve {selected.size} orders</Text>
          </View>
        </AnimatedPressable>
      )}
      {!loaded ? (
        <SkeletonLoader count={3} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id.toString()}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <Animated.View entering={FadeIn.delay(200)} style={styles.empty}>
              <Text style={styles.emptyEmoji}>✅</Text>
              <Text style={styles.emptyText}>All caught up!</Text>
              <Text style={styles.emptySubtext}>No pending orders</Text>
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  countBadge: {
    backgroundColor: '#fff', borderRadius: 14, minWidth: 28, height: 28,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.sm,
    ...Shadows.sm,
  },
  countText: { color: Colors.primary, fontSize: 13, fontWeight: '900' },
  batchToggle: { 
    color: '#fff', 
    fontSize: FontSize.md, 
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  batchBar: {
    margin: Spacing.md, marginBottom: 0, padding: Spacing.lg,
    borderRadius: BorderRadius.xl, alignItems: 'center', flexDirection: 'row', 
    justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.success,
    ...Shadows.lg,
  },
  batchText: { color: '#fff', fontSize: FontSize.lg, fontWeight: '800' },
  actionRow: {
    flexDirection: 'row', gap: Spacing.md,
    marginBottom: Spacing.lg, marginTop: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  rejectBtn: {
    flex: 1, backgroundColor: Colors.surface, padding: Spacing.md,
    borderRadius: BorderRadius.xl, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 6,
    ...Shadows.sm,
  },
  rejectText: { color: Colors.error, fontWeight: '700', fontSize: FontSize.md },
  chatBtn: {
    padding: Spacing.md, borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center', width: 52,
    ...Shadows.sm,
  },
  approveBtn: { flex: 1 },
  approveBtnInner: {
    padding: Spacing.md, borderRadius: BorderRadius.xl, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.success,
    ...Shadows.md,
  },
  approveText: { color: '#fff', fontWeight: '800', fontSize: FontSize.md },
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
