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
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, StatusColors, StatusLabels, Shadows } from '@/constants/theme';
import { API_URL, OSRM_BASE, DELIVERY_BUFFER_MINUTES } from '@/constants/config';
import MapViewComponent from '@/components/MapView';
import ChatView from '@/components/ChatView';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticSuccess } from '@/utils/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const STATUSES = ['pending', 'approved', 'assigned', 'delivering', 'delivered'] as const;
const STATUS_ICONS: Record<string, string> = {
  pending: 'hourglass-outline',
  approved: 'checkmark-circle-outline',
  assigned: 'car-outline',
  delivering: 'navigate-outline',
  delivered: 'gift-outline',
};
const STATUS_DESCRIPTIONS: Record<string, string> = {
  pending: 'Wartet auf Genehmigung...',
  approved: 'Genehmigt! Warten auf Fahrer...',
  assigned: 'Fahrer zugewiesen! Wird vorbereitet...',
  delivering: 'Ist auf dem Weg zu dir!',
  delivered: 'Geliefert! Geniess es!',
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

// ─── Pulsing dot ───
function PulsingDot({ color, size = 12 }: { color: string; size?: number }) {
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
    <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, animStyle]} />
  );
}

// ─── Queue Position Card ───
function QueuePositionCard({ orderId, status }: { orderId: string; status: string }) {
  const [queueData, setQueueData] = useState<{
    position: number;
    total_active: number;
    estimated_wait_minutes: number;
  } | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}/queue`);
      if (res.ok) {
        const data = await res.json();
        setQueueData(data);
      }
    } catch {}
  }, [orderId]);

  useEffect(() => {
    if (status === 'pending' || status === 'approved') {
      loadQueue();
      const interval = setInterval(loadQueue, 10000);
      return () => clearInterval(interval);
    }
  }, [status, loadQueue]);

  if (!queueData || (status !== 'pending' && status !== 'approved')) return null;
  if (queueData.position === 0) {
    return (
      <Animated.View entering={FadeInDown.springify()} style={qStyles.container}>
        <View style={qStyles.iconCircle}>
          <Ionicons name="flash" size={24} color={Colors.accent} />
        </View>
        <View style={qStyles.textWrap}>
          <Text style={qStyles.title}>Du bist als Nächstes dran!</Text>
          <Text style={qStyles.subtitle}>Deine Bestellung wird als nächstes bearbeitet</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.springify()} style={qStyles.container}>
      <View style={qStyles.positionCircle}>
        <Text style={qStyles.positionNumber}>{queueData.position}</Text>
        <Text style={qStyles.positionLabel}>vor dir</Text>
      </View>
      <View style={qStyles.textWrap}>
        <Text style={qStyles.title}>
          {queueData.position} Bestellung{queueData.position !== 1 ? 'en' : ''} vor dir
        </Text>
        <Text style={qStyles.subtitle}>
          Geschätzte Wartezeit: ~{queueData.estimated_wait_minutes} Min.
        </Text>
        {/* Progress bar */}
        <View style={qStyles.progressTrack}>
          <Animated.View
            style={[
              qStyles.progressFill,
              {
                width: `${Math.max(10, Math.min(90, ((queueData.total_active - queueData.position) / Math.max(queueData.total_active, 1)) * 100))}%`,
              },
            ]}
          />
        </View>
        <Text style={qStyles.progressText}>
          {queueData.total_active - queueData.position} von {queueData.total_active} abgeschlossen
        </Text>
      </View>
    </Animated.View>
  );
}

const qStyles = StyleSheet.create({
  container: {
    margin: Spacing.md,
    marginBottom: 0,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: `${Colors.accent}20`,
    ...Shadows.md,
  },
  positionCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionNumber: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.black,
    color: Colors.accent,
  },
  positionLabel: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    color: Colors.accent,
    marginTop: -2,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: { flex: 1 },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 2,
    marginTop: Spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  progressText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
});

// ─── Animated Timeline ───
function HorizontalTimeline({ currentIdx, isRejected }: { currentIdx: number; isRejected: boolean }) {
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
              <View style={[tlStyles.line, { backgroundColor: isCompleted ? Colors.success : Colors.divider }]} />
            )}
            <View style={tlStyles.step}>
              <View
                style={[
                  tlStyles.dot,
                  { backgroundColor: dotColor },
                  isCurrent && { borderWidth: 3, borderColor: `${dotColor}40` },
                ]}
              >
                {isCompleted && <Ionicons name="checkmark" size={12} color="#fff" />}
                {isCurrent && <PulsingDot color="#fff" size={6} />}
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
  line: { height: 3, flex: 1, borderRadius: 1.5, marginTop: 12, marginHorizontal: -2 },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: { fontSize: 9, textAlign: 'center', fontWeight: FontWeight.semibold },
});

// ─── ETA Countdown ───
function ETACountdown({ targetMinutes }: { targetMinutes: number }) {
  const [remaining, setRemaining] = useState(targetMinutes * 60);

  useEffect(() => {
    setRemaining(targetMinutes * 60);
  }, [targetMinutes]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(prev => Math.max(0, prev - 1));
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
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.black,
    color: Colors.accent,
    fontVariant: ['tabular-nums'],
  },
});

// ─── Main Tracking Screen ───
export default function TrackingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
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

  useEffect(() => { loadOrder(); }, [loadOrder]);

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
        if (data.driver_name) setDriverName(data.driver_name);
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

        if (mins <= 5 && !arrivingAlert) {
          setArrivingAlert(true);
          hapticSuccess();
        }
      }
    } catch (e) {
      console.error('OSRM error:', e);
    }
  }, [order, driverLoc, arrivingAlert]);

  useEffect(() => { calculateETA(); }, [calculateETA]);

  // Faster polling during delivery (every 5s)
  useEffect(() => {
    const interval = order?.status === 'delivering' ? 5000 : 15000;
    if (order?.status === 'delivering' || order?.status === 'assigned') {
      etaIntervalRef.current = setInterval(calculateETA, interval);
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
          <PulsingDot color={Colors.accent} />
          <Text style={styles.loadingText}>Bestellung wird geladen...</Text>
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
            title: `Chat — #${orderId}`,
            headerStyle: { backgroundColor: Colors.surface },
            headerTintColor: Colors.text,
            headerRight: () => (
              <AnimatedPressable onPress={() => setShowChat(false)} style={{ marginRight: 12 }}>
                <Ionicons name="map-outline" size={22} color={Colors.accent} />
              </AnimatedPressable>
            ),
          }}
        />
        <ChatView orderId={Number(orderId)} role="consumer" />
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
      title: 'Lieferadresse',
      description: order.delivery_address,
      pinColor: Colors.accent,
    });
  }
  if (driverLoc) {
    markers.push({
      id: 'driver',
      latitude: driverLoc.lat,
      longitude: driverLoc.lng,
      title: order.driver_name || driverName || 'Fahrer',
      pinColor: Colors.delivering,
    });
  }

  const mapRegion = driverLoc
    ? { latitude: driverLoc.lat, longitude: driverLoc.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : order.delivery_lat
      ? { latitude: order.delivery_lat, longitude: order.delivery_lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }
      : undefined;

  const confettiColors = ['#FF6B35', '#34C759', '#007AFF', '#AF52DE', '#FF9F0A', '#FF3B30', '#5AC8FA'];

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

      {/* Confetti */}
      {showConfetti && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {Array.from({ length: 40 }).map((_, i) => (
            <ConfettiParticle key={i} delay={i * 50} color={confettiColors[i % confettiColors.length]} />
          ))}
        </View>
      )}

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* ── Map (larger, Uber Eats style) ── */}
        <View style={styles.mapContainer}>
          <MapViewComponent region={mapRegion} markers={markers} />
          {/* Floating ETA pill */}
          {etaMinutes !== null && (
            <Animated.View entering={FadeIn.duration(400)} style={styles.etaPill}>
              <Ionicons name="navigate" size={14} color={Colors.accent} />
              <Text style={styles.etaPillText}>
                {distanceKm != null ? `${distanceKm} km` : ''} · ~{etaMinutes} min
              </Text>
            </Animated.View>
          )}
          {/* Driver info floating card */}
          {driverLoc && (order.driver_name || driverName) && (
            <Animated.View entering={FadeInUp.delay(200).duration(300)} style={styles.driverFloating}>
              <View style={styles.driverAvatar}>
                <Text style={styles.driverAvatarText}>
                  {(order.driver_name || driverName || '?')[0].toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.driverFloatingName}>{order.driver_name || driverName}</Text>
                <Text style={styles.driverFloatingStatus}>
                  {isDelivering ? 'Unterwegs zu dir' : 'Zugewiesen'}
                </Text>
              </View>
            </Animated.View>
          )}
        </View>

        {/* ── Arriving alert ── */}
        {arrivingAlert && isDelivering && (
          <Animated.View entering={FadeInDown.springify()} style={styles.arrivingBanner}>
            <Text style={styles.arrivingEmoji}>🚗💨</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.arrivingTitle}>Fahrer kommt gleich!</Text>
              <Text style={styles.arrivingSubtitle}>Weniger als 5 Minuten entfernt</Text>
            </View>
          </Animated.View>
        )}

        {/* ── Delivered celebration ── */}
        {isDelivered && (
          <Animated.View entering={FadeInDown.springify()} style={styles.deliveredBanner}>
            <Text style={styles.deliveredEmoji}>🎉</Text>
            <Text style={styles.deliveredTitle}>Bestellung geliefert!</Text>
            <Text style={styles.deliveredSubtitle}>Danke für deine Bestellung. Geniess es!</Text>
          </Animated.View>
        )}

        {/* ── Rejected ── */}
        {isRejected && (
          <Animated.View entering={FadeInDown.springify()} style={styles.rejectedBanner}>
            <Text style={styles.rejectedEmoji}>❌</Text>
            <Text style={styles.rejectedTitle}>Bestellung abgelehnt</Text>
            <Text style={styles.rejectedSubtitle}>Diese Bestellung konnte leider nicht bearbeitet werden.</Text>
          </Animated.View>
        )}

        {/* ── Queue position (for waiting states) ── */}
        {isWaiting && <QueuePositionCard orderId={orderId!} status={order.status} />}

        {/* ── Status + ETA card ── */}
        {!isRejected && (
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View style={[styles.statusIconWrap, { backgroundColor: `${StatusColors[order.status] || Colors.textMuted}15` }]}>
                <Ionicons
                  name={STATUS_ICONS[order.status] || 'ellipse'}
                  size={20}
                  color={StatusColors[order.status] || Colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusText, { color: StatusColors[order.status] || Colors.text }]}>
                  {StatusLabels[order.status] || order.status}
                </Text>
                <Text style={styles.statusDescription}>{STATUS_DESCRIPTIONS[order.status] || ''}</Text>
              </View>
              {isWaiting && <PulsingDot color={StatusColors[order.status] || Colors.warning} size={14} />}
            </View>

            {/* Live ETA countdown */}
            {etaMinutes !== null && (isDelivering || order.status === 'assigned') && (
              <View style={styles.etaSection}>
                <View style={styles.etaCountdownWrap}>
                  <Text style={styles.etaCountdownLabel}>Ankunft in</Text>
                  <ETACountdown targetMinutes={etaMinutes} />
                  <Text style={styles.etaCountdownUnit}>Minuten</Text>
                </View>
                <View style={styles.etaDivider} />
                <View style={styles.etaStats}>
                  <View style={styles.etaStatItem}>
                    <Ionicons name="navigate-outline" size={16} color={Colors.delivering} />
                    <Text style={styles.etaStatValue}>{distanceKm ?? '—'} km</Text>
                    <Text style={styles.etaStatLabel}>Entfernung</Text>
                  </View>
                  <View style={styles.etaStatItem}>
                    <Ionicons name="time-outline" size={16} color={Colors.accent} />
                    <Text style={styles.etaStatValue}>~{etaMinutes} min</Text>
                    <Text style={styles.etaStatLabel}>Geschätzt</Text>
                  </View>
                </View>
              </View>
            )}
          </Animated.View>
        )}

        {/* ── Timeline ── */}
        {!isRejected && (
          <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.timelineCard}>
            <Text style={styles.cardTitle}>Bestellfortschritt</Text>
            <HorizontalTimeline currentIdx={currentIdx} isRejected={isRejected} />
          </Animated.View>
        )}

        {/* ── Order details ── */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.detailsCard}>
          <Text style={styles.cardTitle}>Bestelldetails</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Produkt</Text>
            <Text style={styles.detailValue}>{order.product_emoji} {order.product_name}</Text>
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
          {order.delivery_address && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Adresse</Text>
              <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                {order.delivery_address}
              </Text>
            </View>
          )}
          {order.driver_name && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Fahrer</Text>
              <Text style={[styles.detailValue, { color: Colors.delivering }]}>{order.driver_name}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Bestellung #</Text>
            <Text style={styles.detailValue}>{order.id}</Text>
          </View>
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
        <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.actions}>
          <AnimatedPressable style={styles.chatBtn} onPress={() => setShowChat(true)}>
            <Ionicons name="chatbubbles-outline" size={20} color={Colors.accent} />
            <Text style={styles.chatBtnText}>Chat mit Support</Text>
          </AnimatedPressable>

          <AnimatedPressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={16} color={Colors.textSecondary} />
            <Text style={styles.backBtnText}>Zurück zu Bestellungen</Text>
          </AnimatedPressable>
        </Animated.View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: Spacing.xxl * 2 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { color: Colors.textMuted, fontSize: FontSize.md },

  // Map (larger, 55% of screen)
  mapContainer: {
    height: SCREEN_HEIGHT * 0.38,
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
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    ...Shadows.lg,
  },
  driverAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gradientStart,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverAvatarText: {
    color: '#fff',
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },
  driverFloatingName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  driverFloatingStatus: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },

  // Arriving alert
  arrivingBanner: {
    margin: Spacing.md,
    marginBottom: 0,
    backgroundColor: `${Colors.warning}12`,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: `${Colors.warning}30`,
  },
  arrivingEmoji: { fontSize: 32 },
  arrivingTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.warning },
  arrivingSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary },

  // Delivered
  deliveredBanner: {
    margin: Spacing.md,
    marginBottom: 0,
    backgroundColor: `${Colors.success}10`,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${Colors.success}30`,
  },
  deliveredEmoji: { fontSize: 56, marginBottom: Spacing.sm },
  deliveredTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.black, color: Colors.success },
  deliveredSubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: 4 },

  // Rejected
  rejectedBanner: {
    margin: Spacing.md,
    marginBottom: 0,
    backgroundColor: `${Colors.error}10`,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${Colors.error}30`,
  },
  rejectedEmoji: { fontSize: 48, marginBottom: Spacing.sm },
  rejectedTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.black, color: Colors.error },
  rejectedSubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: 4 },

  // Status card
  statusCard: {
    margin: Spacing.md,
    marginBottom: 0,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  statusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  statusDescription: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
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
  etaCountdownLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  etaCountdownUnit: {
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
  etaStatValue: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  etaStatLabel: { fontSize: FontSize.xs, color: Colors.textMuted },

  // Timeline card
  timelineCard: {
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

  // Details card
  detailsCard: {
    margin: Spacing.md,
    marginBottom: 0,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  detailLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  detailValue: { fontSize: FontSize.sm, color: Colors.text, fontWeight: FontWeight.semibold },

  // Actions
  actions: { padding: Spacing.md, gap: Spacing.sm },
  chatBtn: {
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
  chatBtnText: { color: Colors.text, fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  backBtn: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  backBtnText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
