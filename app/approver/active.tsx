import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, ScrollView, Dimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, SlideInDown, FadeInUp, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import GradientHeader from '@/components/GradientHeader';
import OrderCard from '@/components/OrderCard';
import MapViewComponent from '@/components/MapView';
import SkeletonLoader from '@/components/SkeletonLoader';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useSocket } from '@/contexts/SocketContext';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { API_URL } from '@/constants/config';
import { showAlert } from '@/utils/alert';
import { hapticSuccess, hapticLight } from '@/utils/haptics';

const REGION_COLORS: Record<string, string> = {
  Basel: '#E53935',
  'Zürich': '#1E88E5',
  Olten: '#43A047',
};

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  available: { color: '#34C759', label: 'Verfügbar', icon: 'checkmark-circle' },
  delivering: { color: '#007AFF', label: 'Unterwegs', icon: 'car' },
  assigned: { color: '#AF52DE', label: 'Zugewiesen', icon: 'time' },
};

function timeAgo(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMin = Math.round((now - then) / 60000);
  if (diffMin < 1) return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std.`;
  return `vor ${Math.round(diffH / 24)} T.`;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ActiveScreen() {
  const { socket } = useSocket();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [suggestedDrivers, setSuggestedDrivers] = useState<any[]>([]);
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

  // Fetch suggested drivers when opening assignment modal
  const loadSuggestedDrivers = useCallback(async (orderId: number) => {
    const order = orders.find(o => o.id === orderId);
    if (!order || order.delivery_lat == null || order.delivery_lng == null) {
      // Fallback to regular drivers list
      setSuggestedDrivers(drivers.map(d => ({ ...d, score: 0, distance_km: null, suggested: false })));
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/drivers/suggest?lat=${order.delivery_lat}&lng=${order.delivery_lng}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setSuggestedDrivers(data);
      }
    } catch (e) {
      setSuggestedDrivers(drivers.map(d => ({ ...d, score: 0, distance_km: null, suggested: false })));
    }
  }, [orders, drivers]);

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
    loadSuggestedDrivers(orderId);
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
      description: `${o.consumer_name || ''} — ${o.delivery_address || ''}`,
      pinColor: Colors.warning,
    })),
    ...driverLocations.map((d) => ({
      id: `driver-${d.driver_id}`,
      latitude: d.lat,
      longitude: d.lng,
      title: d.driver_name || `Driver #${d.driver_id}`,
      pinColor: Colors.delivering,
    })),
  ];

  return (
    <View style={styles.container}>
      <GradientHeader
        title="Aktive Bestellungen"
        subtitle={`${orders.length} Bestellung${orders.length !== 1 ? 'en' : ''} in Bearbeitung`}
        right={
          <TouchableOpacity onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')} style={styles.toggleBtn}>
            <Ionicons name={viewMode === 'list' ? 'map-outline' : 'list-outline'} size={20} color="#fff" />
            <Text style={styles.toggleBtnText}>{viewMode === 'list' ? 'Map' : 'List'}</Text>
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
              <OrderCard
                order={item}
                showConsumer
                showGeoData
                index={index}
                onPress={() => {
                  hapticLight();
                  router.push({
                    pathname: '/approver/order-detail',
                    params: { orderId: item.id.toString() },
                  } as any);
                }}
              />
              {item.status === 'approved' && !item.driver_id && (
                <AnimatedPressable style={styles.assignBtn} onPress={() => showAssignDialog(item.id)}>
                  <Ionicons name="car-outline" size={18} color="#fff" />
                  <Text style={styles.assignText}>Fahrer zuweisen</Text>
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
              <Text style={styles.emptyText}>Keine aktiven Bestellungen</Text>
            </Animated.View>
          }
        />
      )}

      <Modal
        visible={assignModalVisible}
        transparent
        animationType="none"
        onRequestClose={() => { setAssignModalVisible(false); setAssignOrderId(null); }}
      >
        <Animated.View entering={FadeIn.duration(200)} style={styles.modalOverlay}>
          <Animated.View
            entering={SlideInDown.duration(380).easing(Easing.out(Easing.cubic))}
            style={styles.bottomSheet}
          >
            {/* Drag handle */}
            <View style={styles.dragHandleContainer}>
              <View style={styles.dragHandle} />
            </View>

            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }} />
              <View style={styles.sheetTitleWrap}>
                <Text style={styles.sheetTitle}>Fahrer zuweisen</Text>
                <Text style={styles.sheetSubtitle}>
                  {assignOrderId ? `Bestellung #${assignOrderId}` : 'Fahrer auswählen'}
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' as const }}>
                <AnimatedPressable
                  style={styles.closeBtn}
                  onPress={() => { setAssignModalVisible(false); setAssignOrderId(null); }}
                >
                  <Ionicons name="close" size={20} color={Colors.textSecondary} />
                </AnimatedPressable>
              </View>
            </View>

            {/* Driver list sorted by suggestion score */}
            <ScrollView
              style={styles.driverScrollView}
              contentContainerStyle={styles.driverScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {suggestedDrivers.length === 0 ? (
                <View style={styles.noDriversWrap}>
                  <Ionicons name="car-outline" size={48} color={Colors.textMuted} />
                  <Text style={styles.noDrivers}>Keine Fahrer verfügbar</Text>
                </View>
              ) : (
                suggestedDrivers.map((driver: any, dIdx: number) => {
                  const statusCfg = STATUS_CONFIG[driver.status] || STATUS_CONFIG.available;
                  const regionColor = REGION_COLORS[driver.region] || Colors.textMuted;
                  const isBusy = driver.status !== 'available';
                  const locationAge = timeAgo(driver.location_updated_at);
                  const isSuggested = driver.suggested === true || driver.suggested === 1;

                  return (
                    <Animated.View
                      key={driver.id}
                      entering={FadeInDown.delay(dIdx * 50 + 120).duration(320).easing(Easing.out(Easing.quad))}
                    >
                      <AnimatedPressable
                        style={[
                          styles.driverCard,
                          isBusy && styles.driverCardBusy,
                          isSuggested && styles.driverCardSuggested,
                        ]}
                        onPress={() => assignOrderId && assignDriver(assignOrderId, driver.id)}
                      >
                        {/* Recommended badge */}
                        {isSuggested && (
                          <View style={styles.suggestedBadge}>
                            <Ionicons name="star" size={10} color="#fff" />
                            <Text style={styles.suggestedBadgeText}>Empfohlen</Text>
                          </View>
                        )}

                        {/* Avatar */}
                        <View style={[styles.driverAvatar, { backgroundColor: regionColor }]}>
                          <Text style={styles.driverAvatarText}>
                            {driver.name?.[0]?.toUpperCase() || '?'}
                          </Text>
                          <View style={[styles.avatarStatusDot, { backgroundColor: statusCfg.color, borderColor: Colors.surface }]} />
                        </View>

                        {/* Info */}
                        <View style={styles.driverInfo}>
                          <View style={styles.driverNameRow}>
                            <Text style={[styles.driverName, isBusy && styles.driverNameBusy]}>
                              {driver.name || `Fahrer #${driver.id}`}
                            </Text>
                            {driver.region && (
                              <View style={[styles.regionTag, { backgroundColor: `${regionColor}15` }]}>
                                <Text style={[styles.regionTagText, { color: regionColor }]}>{driver.region}</Text>
                              </View>
                            )}
                          </View>

                          {/* Distance to delivery */}
                          {driver.distance_km != null && (
                            <View style={styles.distanceRow}>
                              <Ionicons name="navigate" size={11} color={Colors.accent} />
                              <Text style={styles.distanceText}>
                                {driver.distance_km < 1
                                  ? `${Math.round(driver.distance_km * 1000)}m entfernt`
                                  : `${driver.distance_km.toFixed(1)} km entfernt`}
                              </Text>
                            </View>
                          )}

                          {/* GPS location */}
                          {driver.lat != null && driver.lng != null ? (
                            <View style={styles.gpsRow}>
                              <Ionicons name="location-sharp" size={11} color={regionColor} />
                              <Text style={styles.gpsText}>
                                {Number(driver.lat).toFixed(4)}, {Number(driver.lng).toFixed(4)}
                              </Text>
                              {locationAge && (
                                <Text style={styles.gpsAge}> · {locationAge}</Text>
                              )}
                            </View>
                          ) : (
                            <View style={styles.gpsRow}>
                              <Ionicons name="location-outline" size={11} color={Colors.textMuted} />
                              <Text style={[styles.gpsText, { color: Colors.textMuted }]}>Kein Standort</Text>
                            </View>
                          )}

                          {/* Status + orders row */}
                          <View style={styles.driverMeta}>
                            <View style={[styles.statusBadge, { backgroundColor: `${statusCfg.color}15` }]}>
                              <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
                              <Text style={[styles.statusLabel, { color: statusCfg.color }]}>
                                {statusCfg.label}
                              </Text>
                            </View>

                            {driver.active_orders > 0 && (
                              <View style={styles.orderCountBadge}>
                                <Ionicons name="cube-outline" size={11} color={Colors.textSecondary} />
                                <Text style={styles.orderCountText}>{driver.active_orders}</Text>
                              </View>
                            )}

                            {driver.score != null && (
                              <View style={styles.scoreBadge}>
                                <Text style={styles.scoreText}>{Math.round(driver.score)}pts</Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Arrow */}
                        <View style={styles.driverArrow}>
                          <Ionicons name="chevron-forward" size={18} color={isBusy ? Colors.textMuted : Colors.textSecondary} />
                        </View>
                      </AnimatedPressable>
                    </Animated.View>
                  );
                })
              )}
            </ScrollView>

            {/* Cancel button */}
            <View style={styles.cancelContainer}>
              <AnimatedPressable
                style={styles.cancelBtn}
                onPress={() => { setAssignModalVisible(false); setAssignOrderId(null); }}
              >
                <Text style={styles.cancelBtnText}>Abbrechen</Text>
              </AnimatedPressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  toggleBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toggleBtnText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  assignBtn: {
    backgroundColor: Colors.accent,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    marginTop: Spacing.xs,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    ...Shadows.accent,
  },
  assignText: { color: '#fff', fontWeight: FontWeight.heavy, fontSize: FontSize.md },
  empty: {
    alignItems: 'center',
    marginTop: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyEmoji: { fontSize: 64, marginBottom: Spacing.lg },
  emptyText: {
    fontSize: FontSize.xl,
    color: Colors.text,
    fontWeight: FontWeight.heavy,
    textAlign: 'center',
  },
  // Bottom-sheet modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    maxHeight: SCREEN_HEIGHT * 0.82,
    ...Shadows.xl,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: Spacing.sm + 2,
    paddingBottom: Spacing.xs,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  sheetTitleWrap: {
    alignItems: 'center',
    flex: 2,
  },
  sheetTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.black,
    color: Colors.text,
    textAlign: 'center',
  },
  sheetSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
    fontWeight: FontWeight.medium,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverScrollView: {
    flexGrow: 0,
  },
  driverScrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  noDriversWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  noDrivers: {
    color: Colors.textMuted,
    textAlign: 'center',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },

  // Driver cards
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Shadows.sm,
  },
  driverCardBusy: {
    opacity: 0.65,
  },
  driverCardSuggested: {
    borderColor: Colors.accent,
    borderWidth: 2,
    backgroundColor: `${Colors.accent}04`,
  },
  suggestedBadge: {
    position: 'absolute',
    top: -8,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    ...Shadows.accent,
  },
  suggestedBadgeText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
  driverAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  driverAvatarText: {
    color: '#fff',
    fontWeight: FontWeight.black,
    fontSize: FontSize.lg,
  },
  avatarStatusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  driverInfo: {
    flex: 1,
  },
  driverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  driverName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  driverNameBusy: {
    color: Colors.textSecondary,
  },
  regionTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  regionTagText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  distanceText: {
    fontSize: FontSize.sm,
    color: Colors.accent,
    fontWeight: FontWeight.semibold,
  },
  driverPhone: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    marginTop: 1,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  gpsText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    fontVariant: ['tabular-nums'],
  },
  gpsAge: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  driverMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  orderCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  orderCountText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
  scoreBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: `${Colors.accent}12`,
  },
  scoreText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.accent,
  },
  driverArrow: {
    marginLeft: Spacing.sm,
    opacity: 0.5,
  },

  // Cancel button
  cancelContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  cancelBtn: {
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },
});
