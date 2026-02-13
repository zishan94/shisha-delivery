import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Platform } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { Colors, FontSize, Spacing, BorderRadius, StatusColors, StatusLabels } from '@/constants/theme';
import { API_URL, OSRM_BASE, DELIVERY_BUFFER_MINUTES } from '@/constants/config';
import MapViewComponent from '@/components/MapView';
import ChatView from '@/components/ChatView';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticSuccess } from '@/utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STATUSES = ['pending', 'approved', 'assigned', 'delivering', 'delivered'] as const;
const STATUS_ICONS: Record<string, string> = {
  pending: 'hourglass-outline',
  approved: 'checkmark-circle-outline',
  assigned: 'car-outline',
  delivering: 'navigate-outline',
  delivered: 'gift-outline',
};
const STATUS_DESCRIPTIONS: Record<string, string> = {
  pending: 'Waiting for approval...',
  approved: 'Approved! Waiting for driver...',
  assigned: 'Driver assigned! Preparing...',
  delivering: 'On the way to you!',
  delivered: 'Delivered! Enjoy! 🎉',
};

// ─── Confetti particle ───
function ConfettiParticle({ delay, color }: { delay: number; color: string }) {
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const rotate = useSharedValue(0);
  const startX = Math.random() * SCREEN_WIDTH;

  useEffect(() => {
    translateY.value = withDelay(delay, withTiming(600, { duration: 2500, easing: Easing.out(Easing.quad) }));
    translateX.value = withDelay(delay, withTiming((Math.random() - 0.5) * 200, { duration: 2500 }));
    opacity.value = withDelay(delay + 1800, withTiming(0, { duration: 700 }));
    rotate.value = withDelay(delay, withRepeat(withTiming(360, { duration: 1000 }), -1));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: -10,
          left: startX,
          width: 10,
          height: 10,
          borderRadius: 2,
          backgroundColor: color,
          zIndex: 1000,
        },
        style,
      ]}
    />
  );
}

// ─── Pulsing dot for waiting ───
function PulsingDot({ color }: { color: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withRepeat(withSequence(
      withTiming(1.4, { duration: 800 }),
      withTiming(1, { duration: 800 }),
    ), -1);
    opacity.value = withRepeat(withSequence(
      withTiming(1, { duration: 800 }),
      withTiming(0.4, { duration: 800 }),
    ), -1);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }, animStyle]} />
  );
}

// ─── Animated timeline step ───
function HorizontalTimeline({ currentIdx, isRejected }: { currentIdx: number; isRejected: boolean }) {
  return (
    <View style={tlStyles.container}>
      {STATUSES.map((status, i) => {
        const isCompleted = i < currentIdx;
        const isCurrent = i === currentIdx && !isRejected;
        const dotColor = isCompleted
          ? Colors.success
          : isCurrent
            ? StatusColors[status] || Colors.primary
            : Colors.textMuted;

        return (
          <React.Fragment key={status}>
            {i > 0 && (
              <View style={[tlStyles.line, { backgroundColor: isCompleted ? Colors.success : Colors.border }]} />
            )}
            <View style={tlStyles.step}>
              <View
                style={[
                  tlStyles.dot,
                  { backgroundColor: dotColor },
                  isCurrent && { borderWidth: 3, borderColor: `${dotColor}50` },
                ]}
              >
                {isCompleted && <Ionicons name="checkmark" size={12} color="#fff" />}
                {isCurrent && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />}
              </View>
              <Text
                style={[
                  tlStyles.label,
                  { color: isCompleted || isCurrent ? Colors.text : Colors.textMuted },
                  isCurrent && { fontWeight: '800' },
                ]}
                numberOfLines={1}
              >
                {StatusLabels[status]}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const tlStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { alignItems: 'center', width: 56 },
  line: { height: 3, flex: 1, borderRadius: 1.5, marginTop: 12, marginHorizontal: -2 },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: { fontSize: 9, textAlign: 'center', fontWeight: '600' },
});

// ─── Main Tracking Screen ───
export default function TrackingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [arrivingAlert, setArrivingAlert] = useState(false);
  const prevStatusRef = useRef<string>('');
  const etaIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load order ──
  const loadOrder = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}`);
      if (!res.ok) return;
      const data = await res.json();
      setOrder(data);

      // Load driver location if assigned
      if (data.driver_id) {
        try {
          const locRes = await fetch(`${API_URL}/api/drivers/location/${data.driver_id}`);
          if (locRes.ok) {
            const loc = await locRes.json();
            setDriverLoc(loc);
          }
        } catch {}
      }
    } catch (e) {
      console.error(e);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  // ── Socket events ──
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = (data: any) => {
      if (data.orderId === Number(orderId) || data.id === Number(orderId)) {
        loadOrder();
      }
    };
    const handleDriverLoc = (data: any) => {
      if (order?.driver_id === data.driver_id) {
        setDriverLoc({ lat: data.lat, lng: data.lng });
      }
    };
    socket.on('order:updated', handleUpdate);
    socket.on('order:status-changed', handleUpdate);
    socket.on('driver:location-update', handleDriverLoc);
    return () => {
      socket.off('order:updated', handleUpdate);
      socket.off('order:status-changed', handleUpdate);
      socket.off('driver:location-update', handleDriverLoc);
    };
  }, [socket, orderId, order?.driver_id, loadOrder]);

  // ── ETA calculation via OSRM ──
  const calculateETA = useCallback(async () => {
    if (!order || !driverLoc || !order.delivery_lat || !order.delivery_lng) {
      setEtaMinutes(null);
      setDistanceKm(null);
      return;
    }
    if (order.status !== 'delivering' && order.status !== 'assigned') {
      setEtaMinutes(null);
      setDistanceKm(null);
      return;
    }
    try {
      const url = `${OSRM_BASE}/${driverLoc.lng},${driverLoc.lat};${order.delivery_lng},${order.delivery_lat}?overview=false`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code === 'Ok' && data.routes?.[0]) {
        const route = data.routes[0];
        const mins = Math.ceil(route.duration / 60) + DELIVERY_BUFFER_MINUTES;
        const km = Math.round(route.distance / 100) / 10;
        setEtaMinutes(mins);
        setDistanceKm(km);

        // Arriving alert
        if (mins <= 5 && !arrivingAlert) {
          setArrivingAlert(true);
          hapticSuccess();
        }
      }
    } catch (e) {
      console.error('OSRM error:', e);
    }
  }, [order, driverLoc, arrivingAlert]);

  // Recalculate ETA when driver location changes
  useEffect(() => {
    calculateETA();
  }, [calculateETA]);

  // Periodic ETA refresh
  useEffect(() => {
    if (order?.status === 'delivering' || order?.status === 'assigned') {
      etaIntervalRef.current = setInterval(calculateETA, 15000);
    }
    return () => {
      if (etaIntervalRef.current) clearInterval(etaIntervalRef.current);
    };
  }, [order?.status, calculateETA]);

  // ── Confetti on delivered ──
  useEffect(() => {
    if (order?.status === 'delivered' && prevStatusRef.current !== 'delivered') {
      setShowConfetti(true);
      hapticSuccess();
      setTimeout(() => setShowConfetti(false), 3500);
    }
    if (order?.status) prevStatusRef.current = order.status;
  }, [order?.status]);

  // ── Loading state ──
  if (!order) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: true, title: 'Tracking', headerStyle: { backgroundColor: Colors.surface }, headerTintColor: Colors.text }} />
        <View style={styles.loadingContainer}>
          <PulsingDot color={Colors.primary} />
          <Text style={styles.loadingText}>Loading order...</Text>
        </View>
      </View>
    );
  }

  // ── Chat view ──
  if (showChat) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: `Chat — Order #${orderId}`,
            headerStyle: { backgroundColor: Colors.surface },
            headerTintColor: Colors.text,
            headerRight: () => (
              <AnimatedPressable onPress={() => setShowChat(false)} style={{ marginRight: 12 }}>
                <Ionicons name="map-outline" size={22} color={Colors.primary} />
              </AnimatedPressable>
            ),
          }}
        />
        <ChatView orderId={Number(orderId)} />
      </>
    );
  }

  const currentIdx = STATUSES.indexOf(order.status as any);
  const isRejected = order.status === 'rejected';
  const isWaiting = order.status === 'pending' || order.status === 'approved';
  const isDelivering = order.status === 'delivering';
  const isDelivered = order.status === 'delivered';

  // Map markers
  const markers: any[] = [];
  if (order.delivery_lat && order.delivery_lng) {
    markers.push({
      id: 'delivery',
      latitude: order.delivery_lat,
      longitude: order.delivery_lng,
      title: 'Delivery Address',
      pinColor: Colors.primary,
    });
  }
  if (driverLoc) {
    markers.push({
      id: 'driver',
      latitude: driverLoc.lat,
      longitude: driverLoc.lng,
      title: order.driver_name ? `🚗 ${order.driver_name}` : 'Driver',
      pinColor: Colors.info,
    });
  }

  const mapRegion = driverLoc
    ? { latitude: driverLoc.lat, longitude: driverLoc.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : order.delivery_lat
      ? { latitude: order.delivery_lat, longitude: order.delivery_lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }
      : undefined;

  const confettiColors = ['#10B981', '#F59E0B', '#3B82F6', '#EC4899', '#8B5CF6', '#EF4444', '#06B6D4'];

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: `Order #${orderId}`,
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.text,
        }}
      />

      {/* Confetti */}
      {showConfetti && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {Array.from({ length: 40 }).map((_, i) => (
            <ConfettiParticle key={i} delay={i * 50} color={confettiColors[i % confettiColors.length]} />
          ))}
        </View>
      )}

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* ── Map ── */}
        <View style={styles.mapContainer}>
          <MapViewComponent region={mapRegion} markers={markers} />
          {/* ETA overlay */}
          {etaMinutes !== null && (
            <Animated.View entering={FadeIn.duration(400)} style={styles.etaOverlay}>
              <View style={styles.etaOverlayInner}>
                <Text style={styles.etaOverlayLabel}>ETA</Text>
                <Text style={styles.etaOverlayValue}>~{etaMinutes} min</Text>
                {distanceKm !== null && (
                  <Text style={styles.etaOverlayDist}>{distanceKm} km away</Text>
                )}
              </View>
            </Animated.View>
          )}
        </View>

        {/* ── Arriving alert ── */}
        {arrivingAlert && isDelivering && (
          <Animated.View entering={FadeInDown.springify()} style={styles.arrivingBanner}>
            <Text style={styles.arrivingEmoji}>🚗💨</Text>
            <View>
              <Text style={styles.arrivingTitle}>Driver is arriving!</Text>
              <Text style={styles.arrivingSubtitle}>Less than 5 minutes away</Text>
            </View>
          </Animated.View>
        )}

        {/* ── Delivered celebration ── */}
        {isDelivered && (
          <Animated.View entering={FadeInDown.springify()} style={styles.deliveredBanner}>
            <Text style={styles.deliveredEmoji}>🎉</Text>
            <Text style={styles.deliveredTitle}>Order Delivered!</Text>
            <Text style={styles.deliveredSubtitle}>Thank you for your order. Enjoy!</Text>
          </Animated.View>
        )}

        {/* ── Rejected ── */}
        {isRejected && (
          <Animated.View entering={FadeInDown.springify()} style={styles.rejectedBanner}>
            <Text style={styles.rejectedEmoji}>❌</Text>
            <Text style={styles.rejectedTitle}>Order Rejected</Text>
            <Text style={styles.rejectedSubtitle}>Sorry, this order could not be fulfilled.</Text>
          </Animated.View>
        )}

        {/* ── Status + ETA card ── */}
        {!isRejected && (
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View style={[styles.statusDot, { backgroundColor: StatusColors[order.status] || Colors.textMuted }]} />
              <Text style={[styles.statusText, { color: StatusColors[order.status] || Colors.text }]}>
                {StatusLabels[order.status] || order.status}
              </Text>
              {isWaiting && <PulsingDot color={StatusColors[order.status] || Colors.warning} />}
            </View>
            <Text style={styles.statusDescription}>{STATUS_DESCRIPTIONS[order.status] || ''}</Text>

            {/* ETA row */}
            {etaMinutes !== null && (isDelivering || order.status === 'assigned') && (
              <View style={styles.etaRow}>
                <View style={styles.etaItem}>
                  <Ionicons name="time-outline" size={20} color={Colors.secondary} />
                  <Text style={styles.etaValue}>~{etaMinutes} min</Text>
                  <Text style={styles.etaLabel}>estimated</Text>
                </View>
                {distanceKm !== null && (
                  <View style={styles.etaItem}>
                    <Ionicons name="navigate-outline" size={20} color={Colors.info} />
                    <Text style={styles.etaValue}>{distanceKm} km</Text>
                    <Text style={styles.etaLabel}>away</Text>
                  </View>
                )}
              </View>
            )}
          </Animated.View>
        )}

        {/* ── Timeline ── */}
        {!isRejected && (
          <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.timelineCard}>
            <Text style={styles.cardTitle}>Order Progress</Text>
            <HorizontalTimeline currentIdx={currentIdx} isRejected={isRejected} />
          </Animated.View>
        )}

        {/* ── Order details ── */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.detailsCard}>
          <Text style={styles.cardTitle}>Order Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Product</Text>
            <Text style={styles.detailValue}>{order.product_emoji} {order.product_name}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Amount</Text>
            <Text style={styles.detailValue}>{order.amount_grams}g</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total</Text>
            <Text style={[styles.detailValue, { color: Colors.secondary, fontWeight: '800' }]}>
              CHF {order.total_price?.toFixed(2)}
            </Text>
          </View>
          {order.delivery_address && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Address</Text>
              <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                📍 {order.delivery_address}
              </Text>
            </View>
          )}
          {order.driver_name && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Driver</Text>
              <Text style={[styles.detailValue, { color: Colors.info }]}>🚗 {order.driver_name}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Order #</Text>
            <Text style={styles.detailValue}>{order.id}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Placed</Text>
            <Text style={styles.detailValue}>
              {order.created_at
                ? new Date(order.created_at).toLocaleString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    month: 'short',
                    day: 'numeric',
                  })
                : '—'}
            </Text>
          </View>
        </Animated.View>

        {/* ── Actions ── */}
        <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.actions}>
          <AnimatedPressable style={styles.chatBtn} onPress={() => setShowChat(true)}>
            <Ionicons name="chatbubbles-outline" size={22} color={Colors.primary} />
            <Text style={styles.chatBtnText}>Chat with Support</Text>
          </AnimatedPressable>

          <AnimatedPressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color={Colors.textSecondary} />
            <Text style={styles.backBtnText}>Back to Orders</Text>
          </AnimatedPressable>
        </Animated.View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: Spacing.xxl },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { color: Colors.textMuted, fontSize: FontSize.md },

  // Map
  mapContainer: { height: 260, position: 'relative' },
  etaOverlay: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
  },
  etaOverlayInner: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  etaOverlayLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '700', letterSpacing: 1 },
  etaOverlayValue: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.secondary },
  etaOverlayDist: { fontSize: FontSize.xs, color: Colors.textSecondary },

  // Arriving alert
  arrivingBanner: {
    margin: Spacing.md,
    marginBottom: 0,
    backgroundColor: `${Colors.warning}15`,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: `${Colors.warning}40`,
  },
  arrivingEmoji: { fontSize: 32 },
  arrivingTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.secondary },
  arrivingSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary },

  // Delivered
  deliveredBanner: {
    margin: Spacing.md,
    marginBottom: 0,
    backgroundColor: `${Colors.success}15`,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${Colors.success}40`,
  },
  deliveredEmoji: { fontSize: 56, marginBottom: Spacing.sm },
  deliveredTitle: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.success },
  deliveredSubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: 4 },

  // Rejected
  rejectedBanner: {
    margin: Spacing.md,
    marginBottom: 0,
    backgroundColor: `${Colors.error}15`,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${Colors.error}40`,
  },
  rejectedEmoji: { fontSize: 48, marginBottom: Spacing.sm },
  rejectedTitle: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.error },
  rejectedSubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: 4 },

  // Status card
  statusCard: {
    margin: Spacing.md,
    marginBottom: 0,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusDot: { width: 14, height: 14, borderRadius: 7 },
  statusText: { fontSize: FontSize.xl, fontWeight: '800', flex: 1 },
  statusDescription: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  etaRow: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    gap: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  etaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  etaValue: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  etaLabel: { fontSize: FontSize.xs, color: Colors.textMuted },

  // Timeline card
  timelineCard: {
    margin: Spacing.md,
    marginBottom: 0,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  timelineRow: {},

  // Details card
  detailsCard: {
    margin: Spacing.md,
    marginBottom: 0,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  detailValue: { fontSize: FontSize.md, color: Colors.text, fontWeight: '600' },

  // Actions
  actions: { padding: Spacing.md, gap: Spacing.sm },
  chatBtn: {
    backgroundColor: Colors.glassStrong,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  chatBtnText: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
  backBtn: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  backBtnText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
});
