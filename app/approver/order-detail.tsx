import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSocket } from '@/contexts/SocketContext';
import {
  Colors,
  FontSize,
  FontWeight,
  Spacing,
  BorderRadius,
  StatusColors,
  StatusLabels,
  Shadows,
} from '@/constants/theme';
import { API_URL, OSRM_BASE, DELIVERY_BUFFER_MINUTES } from '@/constants/config';
import MapViewComponent from '@/components/MapView';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight } from '@/utils/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const STATUS_ICONS: Record<string, string> = {
  pending: 'hourglass-outline',
  approved: 'checkmark-circle-outline',
  assigned: 'car-outline',
  delivering: 'navigate-outline',
  delivered: 'gift-outline',
  rejected: 'close-circle-outline',
};

const STATUSES = ['pending', 'approved', 'assigned', 'delivering', 'delivered'] as const;

// ─── Pulsing dot animation ───
function PulsingDot({ color, size = 10 }: { color: string; size?: number }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animStyle,
      ]}
    />
  );
}

// ─── Live ETA Countdown ───
function ETACountdown({ targetMinutes }: { targetMinutes: number }) {
  const [remaining, setRemaining] = useState(targetMinutes * 60);

  useEffect(() => {
    setRemaining(targetMinutes * 60);
  }, [targetMinutes]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <Text style={etaStyles.countdown}>
      {mins}:{secs.toString().padStart(2, '0')}
    </Text>
  );
}

const etaStyles = StyleSheet.create({
  countdown: {
    fontSize: FontSize.xxl + 4,
    fontWeight: FontWeight.black,
    color: Colors.accent,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
});

// ─── Horizontal Status Timeline ───
function StatusTimeline({ currentStatus }: { currentStatus: string }) {
  const currentIdx = STATUSES.indexOf(currentStatus as any);
  const isRejected = currentStatus === 'rejected';

  return (
    <View style={tlStyles.container}>
      {STATUSES.map((status, i) => {
        const isCompleted = i < currentIdx;
        const isCurrent = i === currentIdx && !isRejected;
        const dotColor = isCompleted
          ? Colors.success
          : isCurrent
            ? StatusColors[status] || Colors.accent
            : Colors.textMuted;

        return (
          <React.Fragment key={status}>
            {i > 0 && (
              <View
                style={[
                  tlStyles.line,
                  { backgroundColor: isCompleted ? Colors.success : Colors.divider },
                ]}
              />
            )}
            <View style={tlStyles.step}>
              <View
                style={[
                  tlStyles.dot,
                  { backgroundColor: dotColor },
                  isCurrent && { borderWidth: 3, borderColor: `${dotColor}40` },
                ]}
              >
                {isCompleted && <Ionicons name="checkmark" size={11} color="#fff" />}
                {isCurrent && <PulsingDot color="#fff" size={5} />}
              </View>
              <Text
                style={[
                  tlStyles.label,
                  { color: isCompleted || isCurrent ? Colors.text : Colors.textMuted },
                  isCurrent && { fontWeight: FontWeight.heavy },
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
  line: {
    height: 3,
    flex: 1,
    borderRadius: 1.5,
    marginTop: 12,
    marginHorizontal: -2,
  },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 9,
    textAlign: 'center',
    fontWeight: FontWeight.semibold,
  },
});

// ─── Info Pill ───
function InfoPill({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <View style={[pillStyles.container, { borderColor: `${color}20` }]}>
      <View style={[pillStyles.iconWrap, { backgroundColor: `${color}12` }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <View>
        <Text style={pillStyles.value}>{value}</Text>
        <Text style={pillStyles.label}>{label}</Text>
      </View>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    ...Shadows.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  label: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
    marginTop: 1,
  },
});

// ─── Driver's other orders mini-card ───
function DriverOrderMiniCard({ order, isCurrentOrder }: { order: any; isCurrentOrder: boolean }) {
  const statusColor = StatusColors[order.status] || Colors.textMuted;
  return (
    <View style={[miniStyles.card, isCurrentOrder && miniStyles.cardCurrent]}>
      <View style={[miniStyles.statusDot, { backgroundColor: statusColor }]} />
      <View style={miniStyles.info}>
        <Text style={miniStyles.product} numberOfLines={1}>
          {order.product_emoji || '💨'} {order.product_name}
        </Text>
        <Text style={miniStyles.address} numberOfLines={1}>
          {order.delivery_address || 'Keine Adresse'}
        </Text>
      </View>
      <View style={miniStyles.right}>
        <View style={[miniStyles.statusBadge, { backgroundColor: `${statusColor}14` }]}>
          <Text style={[miniStyles.statusText, { color: statusColor }]}>
            {StatusLabels[order.status] || order.status}
          </Text>
        </View>
        <Text style={miniStyles.id}>#{order.id}</Text>
      </View>
      {isCurrentOrder && (
        <View style={miniStyles.currentBadge}>
          <Text style={miniStyles.currentBadgeText}>Aktuell</Text>
        </View>
      )}
    </View>
  );
}

const miniStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  cardCurrent: {
    backgroundColor: `${Colors.accent}08`,
    borderWidth: 1,
    borderColor: `${Colors.accent}20`,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  info: { flex: 1 },
  product: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  address: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  right: { alignItems: 'flex-end', gap: 2 },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  id: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
    fontVariant: ['tabular-nums'],
  },
  currentBadge: {
    position: 'absolute',
    top: -6,
    right: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  currentBadgeText: {
    fontSize: 8,
    fontWeight: FontWeight.bold,
    color: '#fff',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});

// ─── Main Screen ───
export default function ApproverOrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { socket } = useSocket();
  const router = useRouter();

  const [order, setOrder] = useState<any>(null);
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [driverOrders, setDriverOrders] = useState<any[]>([]);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const etaIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load order ──
  const loadOrder = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}`);
      if (!res.ok) return;
      const data = await res.json();
      setOrder(data);

      // Load driver location
      if (data.driver_id) {
        try {
          const locRes = await fetch(`${API_URL}/api/drivers/location/${data.driver_id}`);
          if (locRes.ok) {
            const loc = await locRes.json();
            setDriverLoc({ lat: loc.lat, lng: loc.lng });
          }
        } catch {}

        // Load all orders for this driver
        try {
          const dRes = await fetch(`${API_URL}/api/orders/driver/${data.driver_id}`);
          if (dRes.ok) {
            const dOrders = await dRes.json();
            if (Array.isArray(dOrders)) setDriverOrders(dOrders);
          }
        } catch {}
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  // ── Socket real-time updates ──
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

  // ── ETA + Route calculation via OSRM ──
  const calculateETA = useCallback(async () => {
    if (!order || !driverLoc || !order.delivery_lat || !order.delivery_lng) {
      setEtaMinutes(null);
      setDistanceKm(null);
      setRouteCoords([]);
      return;
    }
    if (order.status !== 'delivering' && order.status !== 'assigned') {
      setEtaMinutes(null);
      setDistanceKm(null);
      setRouteCoords([]);
      return;
    }
    try {
      const url = `${OSRM_BASE}/${driverLoc.lng},${driverLoc.lat};${order.delivery_lng},${order.delivery_lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code === 'Ok' && data.routes?.[0]) {
        const route = data.routes[0];
        const mins = Math.ceil(route.duration / 60) + DELIVERY_BUFFER_MINUTES;
        const km = Math.round(route.distance / 100) / 10;
        setEtaMinutes(mins);
        setDistanceKm(km);

        // Extract route geometry for polyline
        if (route.geometry?.coordinates) {
          const coords = route.geometry.coordinates.map((c: [number, number]) => ({
            latitude: c[1],
            longitude: c[0],
          }));
          setRouteCoords(coords);
        }
      }
    } catch (e) {
      console.error('OSRM error:', e);
    }
  }, [order, driverLoc]);

  useEffect(() => {
    calculateETA();
  }, [calculateETA]);

  // Recalculate ETA periodically
  useEffect(() => {
    if (order?.status === 'delivering' || order?.status === 'assigned') {
      const interval = order.status === 'delivering' ? 8000 : 20000;
      etaIntervalRef.current = setInterval(calculateETA, interval);
    }
    return () => {
      if (etaIntervalRef.current) clearInterval(etaIntervalRef.current);
    };
  }, [order?.status, calculateETA]);

  // ── Call consumer ──
  const callConsumer = () => {
    if (order?.consumer_phone) {
      Linking.openURL(`tel:${order.consumer_phone}`);
      hapticLight();
    }
  };

  // ── Loading state ──
  if (loading || !order) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Bestelldetails',
            headerStyle: { backgroundColor: Colors.surface },
            headerTintColor: Colors.text,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Wird geladen...</Text>
        </View>
      </View>
    );
  }

  const statusColor = StatusColors[order.status] || Colors.textMuted;
  const hasDriver = !!order.driver_id;
  const isDelivering = order.status === 'delivering';
  const isAssigned = order.status === 'assigned';
  const hasLiveTracking = (isDelivering || isAssigned) && driverLoc;
  const pendingDriverOrders = driverOrders.filter(
    (o) => o.status === 'assigned' || o.status === 'delivering'
  );

  // Map markers
  const markers: any[] = [];
  if (order.delivery_lat && order.delivery_lng) {
    markers.push({
      id: 'delivery',
      latitude: order.delivery_lat,
      longitude: order.delivery_lng,
      title: 'Lieferadresse',
      description: order.delivery_address,
      pinColor: Colors.accent,
    });
  }
  if (driverLoc && hasDriver) {
    markers.push({
      id: 'driver',
      latitude: driverLoc.lat,
      longitude: driverLoc.lng,
      title: order.driver_name || 'Fahrer',
      description: isDelivering ? 'Unterwegs' : 'Zugewiesen',
      pinColor: Colors.delivering,
    });
  }
  // Show all driver's other delivery destinations
  if (hasDriver && driverOrders.length > 0) {
    driverOrders
      .filter((o) => o.id !== Number(orderId) && o.delivery_lat)
      .forEach((o) => {
        markers.push({
          id: `order-${o.id}`,
          latitude: o.delivery_lat,
          longitude: o.delivery_lng,
          title: `#${o.id} ${o.product_name}`,
          description: o.delivery_address,
          pinColor: Colors.assigned,
        });
      });
  }

  const mapRegion = driverLoc
    ? {
        latitude: driverLoc.lat,
        longitude: driverLoc.lng,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      }
    : order.delivery_lat
      ? {
          latitude: order.delivery_lat,
          longitude: order.delivery_lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }
      : undefined;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: `Bestellung #${orderId}`,
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontWeight: FontWeight.bold },
        }}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* ── Map Section ── */}
        <View style={styles.mapContainer}>
          <MapViewComponent
            region={mapRegion}
            markers={markers}
            routeCoords={routeCoords.length > 1 ? routeCoords : undefined}
          />

          {/* Floating ETA pill */}
          {etaMinutes !== null && (
            <Animated.View entering={FadeIn.duration(400)} style={styles.etaPill}>
              <Ionicons name="navigate" size={14} color={Colors.accent} />
              <Text style={styles.etaPillText}>
                {distanceKm != null ? `${distanceKm} km` : ''} · ~{etaMinutes} min
              </Text>
            </Animated.View>
          )}

          {/* Driver floating card */}
          {driverLoc && order.driver_name && (
            <Animated.View
              entering={FadeInUp.delay(200).duration(300)}
              style={styles.driverFloating}
            >
              <View style={styles.driverFloatingAvatar}>
                <Text style={styles.driverFloatingAvatarText}>
                  {order.driver_name[0]?.toUpperCase() || '?'}
                </Text>
                <View
                  style={[
                    styles.floatingStatusDot,
                    { backgroundColor: isDelivering ? Colors.delivering : Colors.assigned },
                  ]}
                />
              </View>
              <View>
                <Text style={styles.driverFloatingName}>{order.driver_name}</Text>
                <Text style={styles.driverFloatingStatus}>
                  {isDelivering ? 'Unterwegs' : 'Zugewiesen'} · {pendingDriverOrders.length}{' '}
                  Auftrag{pendingDriverOrders.length !== 1 ? 'e' : ''}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Order count floating badge */}
          {pendingDriverOrders.length > 1 && (
            <Animated.View entering={FadeIn.delay(400)} style={styles.orderCountFloat}>
              <Ionicons name="layers" size={14} color="#fff" />
              <Text style={styles.orderCountFloatText}>
                {pendingDriverOrders.length} Lieferungen
              </Text>
            </Animated.View>
          )}
        </View>

        {/* ── Status Card with live indicator ── */}
        <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusIconWrap, { backgroundColor: `${statusColor}15` }]}>
              <Ionicons
                name={(STATUS_ICONS[order.status] || 'ellipse') as any}
                size={22}
                color={statusColor}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {StatusLabels[order.status] || order.status}
              </Text>
              <Text style={styles.statusDescription}>
                {order.status === 'pending' && 'Wartet auf Genehmigung'}
                {order.status === 'approved' && 'Genehmigt, wartet auf Fahrerzuweisung'}
                {order.status === 'assigned' && 'Fahrer zugewiesen, wird vorbereitet'}
                {order.status === 'delivering' && 'Fahrer ist auf dem Weg zum Kunden'}
                {order.status === 'delivered' && 'Erfolgreich geliefert'}
                {order.status === 'rejected' && 'Bestellung abgelehnt'}
              </Text>
            </View>
            {(isDelivering || isAssigned) && (
              <PulsingDot color={statusColor} size={14} />
            )}
          </View>

          {/* ETA Section */}
          {etaMinutes !== null && hasLiveTracking && (
            <View style={styles.etaSection}>
              <View style={styles.etaCountdownWrap}>
                <Text style={styles.etaLabel}>GESCHÄTZTE ANKUNFT</Text>
                <ETACountdown targetMinutes={etaMinutes} />
                <Text style={styles.etaUnit}>Minuten verbleibend</Text>
              </View>
              <View style={styles.etaDivider} />
              <View style={styles.etaStats}>
                <View style={styles.etaStatItem}>
                  <Ionicons name="navigate-outline" size={18} color={Colors.delivering} />
                  <Text style={styles.etaStatValue}>{distanceKm ?? '—'} km</Text>
                  <Text style={styles.etaStatLabel}>Entfernung</Text>
                </View>
                <View style={styles.etaStatItem}>
                  <Ionicons name="time-outline" size={18} color={Colors.accent} />
                  <Text style={styles.etaStatValue}>~{etaMinutes} min</Text>
                  <Text style={styles.etaStatLabel}>Geschätzt</Text>
                </View>
                <View style={styles.etaStatItem}>
                  <Ionicons name="layers-outline" size={18} color={Colors.assigned} />
                  <Text style={styles.etaStatValue}>{pendingDriverOrders.length}</Text>
                  <Text style={styles.etaStatLabel}>Aufträge</Text>
                </View>
              </View>
            </View>
          )}
        </Animated.View>

        {/* ── Quick Stats Pills ── */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.pillRow}>
          <InfoPill
            icon="cube"
            label="Menge"
            value={`${order.amount_grams}g`}
            color={Colors.primary}
          />
          <InfoPill
            icon="cash"
            label="Total"
            value={`CHF ${order.total_price?.toFixed(2)}`}
            color={Colors.accent}
          />
        </Animated.View>

        {/* ── Timeline ── */}
        {order.status !== 'rejected' && (
          <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.card}>
            <Text style={styles.cardTitle}>Bestellfortschritt</Text>
            <StatusTimeline currentStatus={order.status} />
          </Animated.View>
        )}

        {/* ── Driver Info Card ── */}
        {hasDriver && (
          <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.card}>
            <Text style={styles.cardTitle}>Fahrer</Text>
            <View style={styles.driverInfoRow}>
              <View style={styles.driverAvatar}>
                <Text style={styles.driverAvatarText}>
                  {order.driver_name?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>{order.driver_name}</Text>
                <View style={styles.driverMetaRow}>
                  <View
                    style={[styles.driverStatusBadge, { backgroundColor: `${statusColor}14` }]}
                  >
                    <View
                      style={[styles.driverStatusDot, { backgroundColor: statusColor }]}
                    />
                    <Text style={[styles.driverStatusText, { color: statusColor }]}>
                      {isDelivering ? 'Unterwegs' : isAssigned ? 'Zugewiesen' : StatusLabels[order.status]}
                    </Text>
                  </View>
                  <Text style={styles.driverOrderCount}>
                    {pendingDriverOrders.length} aktiv{pendingDriverOrders.length !== 1 ? 'e' : 'er'}{' '}
                    Auftrag{pendingDriverOrders.length !== 1 ? '' : ''}
                  </Text>
                </View>
              </View>
            </View>
            {driverLoc && (
              <View style={styles.driverLocationRow}>
                <Ionicons name="location-sharp" size={14} color={Colors.delivering} />
                <Text style={styles.driverLocationText}>
                  {Number(driverLoc.lat).toFixed(5)}, {Number(driverLoc.lng).toFixed(5)}
                </Text>
                {hasLiveTracking && (
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                )}
              </View>
            )}
          </Animated.View>
        )}

        {/* ── Driver's Route / All Active Orders ── */}
        {hasDriver && pendingDriverOrders.length > 0 && (
          <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Fahrer Lieferroute</Text>
              <View style={styles.routeCountBadge}>
                <Text style={styles.routeCountText}>{pendingDriverOrders.length}</Text>
              </View>
            </View>
            <Text style={styles.routeSubtitle}>
              Alle aktiven Lieferungen dieses Fahrers
            </Text>
            <View style={styles.routeList}>
              {pendingDriverOrders.map((o, i) => (
                <DriverOrderMiniCard
                  key={o.id}
                  order={o}
                  isCurrentOrder={o.id === Number(orderId)}
                />
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── Order Details Card ── */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.card}>
          <Text style={styles.cardTitle}>Bestelldetails</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Produkt</Text>
            <Text style={styles.detailValue}>
              {order.product_emoji || '💨'} {order.product_name}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Menge</Text>
            <Text style={styles.detailValue}>{order.amount_grams}g</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total</Text>
            <Text style={[styles.detailValue, { color: Colors.accent, fontWeight: FontWeight.heavy }]}>
              CHF {order.total_price?.toFixed(2)}
            </Text>
          </View>

          <View style={styles.sectionDivider} />

          {(order.consumer_name || order.customer_name) && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Kunde</Text>
              <Text style={styles.detailValue}>
                {order.customer_name || order.consumer_name}
              </Text>
            </View>
          )}
          {order.consumer_phone && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Telefon</Text>
              <AnimatedPressable onPress={callConsumer}>
                <Text style={[styles.detailValue, { color: Colors.delivering }]}>
                  {order.consumer_phone}
                </Text>
              </AnimatedPressable>
            </View>
          )}
          {order.delivery_address && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Adresse</Text>
              <Text
                style={[styles.detailValue, { flex: 1, textAlign: 'right' }]}
                numberOfLines={2}
              >
                {order.delivery_address}
              </Text>
            </View>
          )}

          <View style={styles.sectionDivider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Bestellnr.</Text>
            <Text style={styles.detailValue}>#{order.id}</Text>
          </View>
          {order.driver_name && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Fahrer</Text>
              <Text style={[styles.detailValue, { color: Colors.delivering }]}>
                {order.driver_name}
              </Text>
            </View>
          )}
          <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.detailLabel}>Bestellt am</Text>
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
        <Animated.View entering={FadeInUp.delay(350).springify()} style={styles.actions}>
          {order.consumer_phone && (
            <AnimatedPressable style={styles.actionBtn} onPress={callConsumer}>
              <Ionicons name="call-outline" size={18} color={Colors.success} />
              <Text style={styles.actionBtnText}>Kunde anrufen</Text>
            </AnimatedPressable>
          )}

          <AnimatedPressable
            style={styles.actionBtn}
            onPress={() => {
              hapticLight();
              router.push({
                pathname: '/approver/chat',
                params: { orderId: orderId! },
              } as any);
            }}
          >
            <Ionicons name="chatbubbles-outline" size={18} color={Colors.accent} />
            <Text style={styles.actionBtnText}>Chat</Text>
          </AnimatedPressable>

          <AnimatedPressable
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={16} color={Colors.textSecondary} />
            <Text style={styles.backBtnText}>Zurück</Text>
          </AnimatedPressable>
        </Animated.View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: Spacing.xxl * 2 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },

  // Map
  mapContainer: {
    height: SCREEN_HEIGHT * 0.35,
    position: 'relative',
    overflow: 'hidden',
  },
  etaPill: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    ...Shadows.lg,
  },
  etaPillText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  driverFloating: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
    ...Shadows.lg,
  },
  driverFloatingAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.gradientStart,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverFloatingAvatarText: {
    color: '#fff',
    fontWeight: FontWeight.black,
    fontSize: FontSize.md,
  },
  floatingStatusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  driverFloatingName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  driverFloatingStatus: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  orderCountFloat: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.assigned,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    ...Shadows.lg,
  },
  orderCountFloatText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#fff',
  },

  // Status card
  statusCard: {
    margin: Spacing.md,
    marginBottom: 0,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  statusIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  statusDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: FontWeight.medium,
  },
  etaSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  etaCountdownWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  etaLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  etaUnit: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
    marginTop: 2,
  },
  etaDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.sm,
  },
  etaStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  etaStatItem: { alignItems: 'center', gap: 4 },
  etaStatValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  etaStatLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },

  // Pill row
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },

  // Generic card
  card: {
    margin: Spacing.md,
    marginBottom: 0,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  routeCountBadge: {
    backgroundColor: Colors.assigned,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeCountText: {
    fontSize: 12,
    fontWeight: FontWeight.black,
    color: '#fff',
  },
  routeSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
    fontWeight: FontWeight.medium,
  },
  routeList: {
    gap: Spacing.sm,
  },

  // Driver info
  driverInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.gradientStart,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverAvatarText: {
    color: '#fff',
    fontWeight: FontWeight.black,
    fontSize: FontSize.xl,
  },
  driverName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: 4,
  },
  driverMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  driverStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  driverStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  driverStatusText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  driverOrderCount: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  driverLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  driverLocationText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
    fontWeight: FontWeight.medium,
    flex: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${Colors.success}14`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  liveText: {
    fontSize: 9,
    fontWeight: FontWeight.black,
    color: Colors.success,
    letterSpacing: 1,
  },

  // Details
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  detailLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  detailValue: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: FontWeight.semibold,
  },
  sectionDivider: {
    height: Spacing.sm,
  },

  // Actions
  actions: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  actionBtn: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Shadows.sm,
  },
  actionBtnText: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  backBtn: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  backBtnText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
