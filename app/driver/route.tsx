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
import { Colors, FontSize, Spacing, BorderRadius, StatusColors } from '@/constants/theme';
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
      <GradientHeader title="Route" subtitle={`${orders.length} stops`} />

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
                  <Text style={styles.stopAddress} numberOfLines={1}>📍 {order.delivery_address}</Text>
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
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingVertical: Spacing.sm,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: { fontSize: FontSize.md, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  mapContainer: { height: '40%' },
  stops: { flex: 1 },
  stopsContent: { padding: Spacing.md },
  recalcBtn: {
    backgroundColor: Colors.glassStrong, padding: Spacing.sm,
    borderRadius: BorderRadius.md, alignItems: 'center', marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  recalcText: { color: Colors.text, fontWeight: '600' },
  stopCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  stopNumber: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
    marginRight: Spacing.md,
  },
  stopNumberText: { color: '#fff', fontWeight: '800', fontSize: FontSize.md },
  stopInfo: { flex: 1 },
  stopName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  stopAddress: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  stopEta: { alignItems: 'flex-end', gap: 4 },
  etaText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.secondary },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  emptyContainer: { alignItems: 'center', marginTop: Spacing.xl },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.sm },
  emptyText: { color: Colors.textMuted, textAlign: 'center' },
});
