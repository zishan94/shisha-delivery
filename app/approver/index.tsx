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
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
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
            <LinearGradient colors={[Colors.success, '#059669']} style={styles.approveBtnInner}>
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.approveText}>Approve</Text>
            </LinearGradient>
          </AnimatedPressable>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <GradientHeader
        title="Pending Orders"
        subtitle={`${orders.length} awaiting review`}
        right={
          <View style={styles.headerRight}>
            {orders.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{orders.length}</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => { setBatchMode(!batchMode); setSelected(new Set()); }}>
              <Text style={styles.batchToggle}>{batchMode ? 'Cancel' : 'Batch'}</Text>
            </TouchableOpacity>
          </View>
        }
      />
      {batchMode && selected.size > 0 && (
        <AnimatedPressable onPress={batchApprove}>
          <LinearGradient colors={[Colors.success, '#059669']} style={styles.batchBar}>
            <Ionicons name="checkmark-done" size={20} color="#fff" />
            <Text style={styles.batchText}>Approve {selected.size} orders</Text>
          </LinearGradient>
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
  list: { padding: Spacing.md },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countBadge: {
    backgroundColor: '#fff', borderRadius: 12, minWidth: 24, height: 24,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
  },
  countText: { color: Colors.primary, fontSize: 12, fontWeight: '800' },
  batchToggle: { color: '#fff', fontSize: FontSize.sm, fontWeight: '700' },
  batchBar: {
    margin: Spacing.md, marginBottom: 0, padding: Spacing.md,
    borderRadius: BorderRadius.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  batchText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700' },
  actionRow: {
    flexDirection: 'row', gap: Spacing.sm,
    marginBottom: Spacing.md, marginTop: -Spacing.xs,
  },
  rejectBtn: {
    flex: 1, backgroundColor: Colors.glassStrong, padding: Spacing.sm,
    borderRadius: BorderRadius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
    flexDirection: 'row', justifyContent: 'center', gap: 4,
  },
  rejectText: { color: Colors.error, fontWeight: '600' },
  chatBtn: {
    padding: Spacing.sm, borderRadius: BorderRadius.md,
    backgroundColor: Colors.glassStrong, borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center', width: 44,
  },
  approveBtn: { flex: 1 },
  approveBtnInner: {
    padding: Spacing.sm, borderRadius: BorderRadius.md, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 4,
  },
  approveText: { color: '#fff', fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: Spacing.xxl },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.md },
  emptyText: { fontSize: FontSize.lg, color: Colors.text, fontWeight: '700' },
  emptySubtext: { fontSize: FontSize.sm, color: Colors.textMuted },
});
