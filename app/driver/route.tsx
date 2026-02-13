import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import GradientHeader from '@/components/GradientHeader';
import MapViewComponent from '@/components/MapView';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useLocation } from '@/contexts/LocationContext';
import { useOSRM } from '@/hooks/useOSRM';
import { Colors, FontSize, Spacing, BorderRadius, StatusColors, Shadows } from '@/constants/theme';
import { API_URL } from '@/constants/config';

export default function RouteScreen() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { getCurrentLocation, location } = useLocation();
  const { getRoute, getETAs } = useOSRM();
  const [orders, setOrders] = useState<any[]>([]);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [etas, setEtas] = useState<number[]>([]);
  const [totalDistance, setTotalDistance] = useState(0);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/orders/driver/${user.id}`);
      const data = await res.json();
      if (Array.isArray(data)) setOrders(data);
    } catch (e) {
      console.error(e);
    }
  }, [user]);

  useEffect(() => { loadOrders(); getCurrentLocation(); }, [loadOrders]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => loadOrders();
    socket.on('order:updated', handler);
    return () => { socket.off('order:updated', handler); };
  }, [socket, loadOrders]);

  const calculateRoute = useCallback(async () => {
    if (orders.length === 0) {
      setRouteCoords([]);
      setEtas([]);
      setTotalDistance(0);
      return;
    }
    const start = location || { latitude: 47.3769, longitude: 8.5417 };
    const waypoints = [
      start,
      ...orders.filter((o) => o.delivery_lat && o.delivery_lng).map((o) => ({
        latitude: o.delivery_lat,
        longitude: o.delivery_lng,
      })),
    ];
    if (waypoints.length < 2) return;

    const result = await getRoute(waypoints);
    if (result) {
      setRouteCoords(result.coordinates.map(([lat, lng]) => ({ latitude: lat, longitude: lng })));
      setEtas(getETAs(result.legs));
      setTotalDistance(result.distance);
    }
  }, [orders, location]);

  useEffect(() => { calculateRoute(); }, [calculateRoute]);

  const markers = [
    ...(location ? [{ id: 'me', latitude: location.latitude, longitude: location.longitude, title: 'You', pinColor: Colors.info }] : []),
    ...orders.filter((o) => o.delivery_lat).map((o, i) => ({
      id: `order-${o.id}`,
      latitude: o.delivery_lat,
      longitude: o.delivery_lng,
      title: `#${i + 1} ${o.product_name}`,
      description: `${o.consumer_name} — ${o.amount_grams}g`,
      pinColor: StatusColors[o.status] || Colors.warning,
    })),
  ];

  const formatDistance = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;

  return (
    <View style={styles.container}>
      <GradientHeader title="🗺️ Route" subtitle={`${orders.length} stop${orders.length !== 1 ? 's' : ''} planned`} />

      {/* Stats bar */}
      {orders.length > 0 && (
        <View style={styles.statsBar}>
          <View style={styles.stat}>
            <Ionicons name="navigate-outline" size={18} color={Colors.primary} />
            <Text style={styles.statValue}>{formatDistance(totalDistance)}</Text>
            <Text style={styles.statLabel}>total</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="time-outline" size={18} color={Colors.secondary} />
            <Text style={styles.statValue}>{etas.length > 0 ? etas[etas.length - 1] : '—'}</Text>
            <Text style={styles.statLabel}>min ETA</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="flag-outline" size={18} color={Colors.info} />
            <Text style={styles.statValue}>{orders.length}</Text>
            <Text style={styles.statLabel}>stops</Text>
          </View>
        </View>
      )}

      <View style={styles.mapContainer}>
        <MapViewComponent
          region={location || undefined}
          markers={markers}
          routeCoords={routeCoords}
        />
      </View>
      <ScrollView style={styles.stops} contentContainerStyle={styles.stopsContent}>
        <AnimatedPressable style={styles.recalcBtn} onPress={calculateRoute}>
          <Ionicons name="refresh" size={18} color={Colors.primary} />
          <Text style={styles.recalcText}>Recalculate Route</Text>
        </AnimatedPressable>
        {orders.map((order, index) => (
          <Animated.View key={order.id} entering={FadeInDown.delay(index * 80).springify()}>
            <View style={styles.stopCard}>
              <View style={styles.stopNumber}>
                <Text style={styles.stopNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.stopInfo}>
                <Text style={styles.stopName}>{order.product_emoji} {order.product_name}</Text>
                <Text style={styles.stopAddress}>{order.consumer_name} — {order.amount_grams}g</Text>
                {order.delivery_address && (
                  <Text style={styles.stopAddress}>📍 {order.delivery_address}</Text>
                )}
              </View>
              <View style={styles.stopEta}>
                {etas[index] !== undefined && (
                  <Text style={styles.etaText}>{etas[index]} min</Text>
                )}
                <View style={[styles.statusDot, { backgroundColor: StatusColors[order.status] || Colors.textMuted }]} />
              </View>
            </View>
          </Animated.View>
        ))}
        {orders.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🗺</Text>
            <Text style={styles.emptyText}>No stops — waiting for assignments</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  statsBar: {
    flexDirection: 'row', 
    justifyContent: 'space-around',
    backgroundColor: Colors.surface, 
    paddingVertical: Spacing.md,
    ...Shadows.md,
  },
  stat: { 
    flexDirection: 'column', 
    alignItems: 'center', 
    gap: 2,
    minWidth: 80,
  },
  statValue: { 
    fontSize: FontSize.lg, 
    fontWeight: '900', 
    color: Colors.text,
    textAlign: 'center',
  },
  statLabel: { 
    fontSize: FontSize.xs, 
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mapContainer: { height: '42%' },
  stops: { flex: 1, backgroundColor: Colors.surface },
  stopsContent: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  recalcBtn: {
    backgroundColor: Colors.surface, 
    padding: Spacing.md,
    borderRadius: BorderRadius.xl, 
    alignItems: 'center', 
    marginBottom: Spacing.lg,
    flexDirection: 'row', 
    justifyContent: 'center', 
    gap: Spacing.sm,
    ...Shadows.md,
  },
  recalcText: { 
    color: Colors.text, 
    fontWeight: '700',
    fontSize: FontSize.md,
  },
  stopCard: {
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: Colors.surface, 
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg, 
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  stopNumber: {
    width: 40, 
    height: 40, 
    borderRadius: 20,
    backgroundColor: Colors.primary, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: Spacing.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  stopNumberText: { 
    color: '#fff', 
    fontWeight: '900', 
    fontSize: FontSize.lg 
  },
  stopInfo: { flex: 1 },
  stopName: { 
    fontSize: FontSize.lg, 
    fontWeight: '800', 
    color: Colors.text,
    marginBottom: 4,
  },
  stopAddress: { 
    fontSize: FontSize.sm, 
    color: Colors.textSecondary, 
    fontWeight: '500',
    lineHeight: 18,
  },
  stopEta: { 
    alignItems: 'flex-end', 
    gap: 6 
  },
  etaText: { 
    fontSize: FontSize.lg, 
    fontWeight: '800', 
    color: Colors.secondary 
  },
  statusDot: { 
    width: 12, 
    height: 12, 
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  emptyContainer: { 
    alignItems: 'center', 
    marginTop: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyEmoji: { fontSize: 64, marginBottom: Spacing.md },
  emptyText: { 
    color: Colors.textMuted, 
    textAlign: 'center',
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
