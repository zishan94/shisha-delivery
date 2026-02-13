import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import GradientHeader from '@/components/GradientHeader';
import ChatView from '@/components/ChatView';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { API_URL } from '@/constants/config';

export default function DriverChatScreen() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/orders/driver/${user.id}`);
      const data = await res.json();
      if (Array.isArray(data)) setOrders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoaded(true);
    }
  }, [user]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => loadOrders();
    socket.on('order:updated', handler);
    return () => { socket.off('order:updated', handler); };
  }, [socket, loadOrders]);

  if (selectedOrderId) {
    return (
      <View style={styles.container}>
        <GradientHeader
          title="Chat mit Approver"
          subtitle={`Bestellung #${selectedOrderId}`}
          compact
          right={
            <TouchableOpacity onPress={() => setSelectedOrderId(null)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
          }
        />
        <ChatView orderId={selectedOrderId} role="driver" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GradientHeader
        title="Chat mit Approver"
        subtitle={`${orders.length} aktive Bestellung${orders.length !== 1 ? 'en' : ''}`}
      />
      {!loaded ? (
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Laden...</Text>
        </View>
      ) : orders.length === 0 ? (
        <Animated.View entering={FadeIn.delay(200)} style={styles.emptyWrap}>
          <Ionicons name="chatbubble-ellipses-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Keine aktiven Bestellungen</Text>
          <Text style={styles.emptySubtitle}>Approver-Chat wird verfügbar wenn Bestellungen zugewiesen sind</Text>
        </Animated.View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id.toString()}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
              <AnimatedPressable
                style={styles.orderCard}
                onPress={() => setSelectedOrderId(item.id)}
              >
                <View style={styles.orderEmoji}>
                  <Ionicons name="shield-checkmark" size={24} color={Colors.accent} />
                </View>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderTitle}>Bestellung #{item.id}</Text>
                  <Text style={styles.orderProduct}>{item.product_name} · {item.amount_grams}g</Text>
                  <Text style={styles.orderCustomer} numberOfLines={1}>
                    Approver-Chat
                  </Text>
                </View>
                <View style={styles.chatArrow}>
                  <Ionicons name="chatbubble" size={20} color={Colors.accent} />
                </View>
              </AnimatedPressable>
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  orderCard: {
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
  orderEmoji: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  orderInfo: { flex: 1 },
  orderTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  orderProduct: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  orderCustomer: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  chatArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
});
