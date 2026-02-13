import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import GradientHeader from '@/components/GradientHeader';
import OrderCard from '@/components/OrderCard';
import MapViewComponent from '@/components/MapView';
import SkeletonLoader from '@/components/SkeletonLoader';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useSocket } from '@/contexts/SocketContext';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { API_URL } from '@/constants/config';
import { showAlert } from '@/utils/alert';
import { hapticSuccess, hapticLight } from '@/utils/haptics';

export default function ActiveScreen() {
  const { socket } = useSocket();
  const [orders, setOrders] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [driverLocations, setDriverLocations] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignOrderId, setAssignOrderId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [ordersRes, driversRes, locsRes] = await Promise.all([
        fetch(`${API_URL}/api/orders/active`),
        fetch(`${API_URL}/api/drivers`),
        fetch(`${API_URL}/api/drivers/locations`),
      ]);
      const ordersData = await ordersRes.json();
      const driversData = await driversRes.json();
      const locsData = await locsRes.json();
      if (Array.isArray(ordersData)) setOrders(ordersData);
      if (Array.isArray(driversData)) setDrivers(driversData);
      if (Array.isArray(locsData)) setDriverLocations(locsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => loadData();
    socket.on('order:updated', handler);
    socket.on('order:new', handler);
    socket.on('driver:location-update', (data: any) => {
      setDriverLocations((prev) => {
        const idx = prev.findIndex((d) => d.driver_id === data.driver_id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], lat: data.lat, lng: data.lng };
          return next;
        }
        return [...prev, data];
      });
    });
    return () => {
      socket.off('order:updated', handler);
      socket.off('order:new', handler);
      socket.off('driver:location-update');
    };
  }, [socket, loadData]);

  const assignDriver = async (orderId: number, driverId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId }),
      });
      if (!res.ok) throw new Error('Failed');
      const order = await res.json();
      socket?.emit('order:status', { orderId, status: 'assigned', order });
      hapticSuccess();
      setAssignModalVisible(false);
      setAssignOrderId(null);
      loadData();
    } catch (e) {
      showAlert('Error', 'Failed to assign driver');
    }
  };

  const showAssignDialog = (orderId: number) => {
    setAssignOrderId(orderId);
    setAssignModalVisible(true);
    hapticLight();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const markers = [
    ...orders.filter((o) => o.delivery_lat).map((o) => ({
      id: `order-${o.id}`,
      latitude: o.delivery_lat,
      longitude: o.delivery_lng,
      title: `#${o.id} ${o.product_name}`,
      description: o.consumer_name,
      pinColor: Colors.warning,
    })),
    ...driverLocations.map((d) => ({
      id: `driver-${d.driver_id}`,
      latitude: d.lat,
      longitude: d.lng,
      title: d.driver_name || `Driver #${d.driver_id}`,
      pinColor: Colors.info,
    })),
  ];

  return (
    <View style={styles.container}>
      <GradientHeader
        title="Active Orders"
        subtitle={`${orders.length} active`}
        right={
          <TouchableOpacity onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')} style={styles.toggleBtn}>
            <Ionicons name={viewMode === 'list' ? 'map-outline' : 'list-outline'} size={20} color="#fff" />
          </TouchableOpacity>
        }
      />
      {viewMode === 'map' ? (
        <MapViewComponent markers={markers} />
      ) : !loaded ? (
        <SkeletonLoader count={3} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id.toString()}
          renderItem={({ item, index }) => (
            <View>
              <OrderCard order={item} showConsumer index={index} />
              {item.status === 'approved' && !item.driver_id && (
                <AnimatedPressable style={styles.assignBtn} onPress={() => showAssignDialog(item.id)}>
                  <Ionicons name="car-outline" size={18} color="#fff" />
                  <Text style={styles.assignText}>Assign Driver</Text>
                </AnimatedPressable>
              )}
            </View>
          )}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <Animated.View entering={FadeIn.delay(200)} style={styles.empty}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyText}>No active orders</Text>
            </Animated.View>
          }
        />
      )}

      <Modal
        visible={assignModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAssignModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeInUp.springify()} style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assign Driver</Text>
            <Text style={styles.modalSubtitle}>
              {assignOrderId ? `Order #${assignOrderId}` : 'Select a driver'}
            </Text>
            <ScrollView style={styles.driverList}>
              {drivers.length === 0 ? (
                <Text style={styles.noDrivers}>No drivers available</Text>
              ) : (
                drivers.map((driver) => (
                  <AnimatedPressable
                    key={driver.id}
                    style={styles.driverItem}
                    onPress={() => assignOrderId && assignDriver(assignOrderId, driver.id)}
                  >
                    <View style={styles.driverAvatar}>
                      <Text style={styles.driverAvatarText}>{driver.name?.[0]?.toUpperCase() || '?'}</Text>
                    </View>
                    <View style={styles.driverInfo}>
                      <Text style={styles.driverName}>{driver.name || `Driver #${driver.id}`}</Text>
                      <Text style={styles.driverPhone}>{driver.phone}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={18} color={Colors.textMuted} />
                  </AnimatedPressable>
                ))
              )}
            </ScrollView>
            <AnimatedPressable
              style={styles.modalCancel}
              onPress={() => { setAssignModalVisible(false); setAssignOrderId(null); }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </AnimatedPressable>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md },
  toggleBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8,
  },
  assignBtn: {
    backgroundColor: Colors.info, padding: Spacing.sm, borderRadius: BorderRadius.md,
    alignItems: 'center', marginBottom: Spacing.md, marginTop: -Spacing.xs,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  assignText: { color: '#fff', fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: Spacing.xxl },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: FontSize.lg, color: Colors.text, fontWeight: '700', marginTop: Spacing.md },
  modalOverlay: {
    flex: 1, backgroundColor: Colors.overlay,
    justifyContent: 'center', alignItems: 'center', padding: Spacing.xl,
  },
  modalContent: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    padding: Spacing.lg, width: '100%', maxWidth: 400, maxHeight: '70%',
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  modalSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.lg },
  driverList: { maxHeight: 300 },
  noDrivers: { color: Colors.textMuted, textAlign: 'center', padding: Spacing.lg },
  driverItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  driverAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.info,
    justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md,
  },
  driverAvatarText: { color: '#fff', fontWeight: '800', fontSize: FontSize.lg },
  driverInfo: { flex: 1 },
  driverName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  driverPhone: { fontSize: FontSize.sm, color: Colors.textSecondary },
  modalCancel: {
    marginTop: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md,
    backgroundColor: Colors.glassStrong, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  modalCancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: FontSize.md },
});
