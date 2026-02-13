import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, StatusColors, StatusLabels, Shadows } from '@/constants/theme';
import AnimatedPressable from './AnimatedPressable';

interface Order {
  id: number;
  product_name: string;
  product_emoji: string;
  amount_grams: number;
  total_price: number;
  status: string;
  delivery_address?: string;
  delivery_lat?: number;
  delivery_lng?: number;
  consumer_name?: string;
  customer_name?: string;
  consumer_phone?: string;
  driver_name?: string;
  created_at: string;
}

interface Props {
  order: Order;
  onPress?: () => void;
  showConsumer?: boolean;
  showGeoData?: boolean;
  showDistance?: string;
  selectable?: boolean;
  selected?: boolean;
  index?: number;
}

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'gerade eben';
  if (diffMins < 60) return `vor ${diffMins}m`;
  if (diffHours < 24) return `vor ${diffHours}h ${diffMins % 60}m`;
  return `vor ${diffDays}d`;
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate();
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const month = months[date.getMonth()];
  const hours = date.getHours().toString().padStart(2, '0');
  const mins = date.getMinutes().toString().padStart(2, '0');
  return `${day}. ${month}, ${hours}:${mins}`;
}

export default function OrderCard({ order, onPress, showConsumer, showGeoData, showDistance, selectable, selected, index = 0 }: Props) {
  const displayName = order.customer_name || order.consumer_name;
  const statusColor = StatusColors[order.status] || Colors.textMuted;

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <AnimatedPressable
        style={[styles.card, selected && styles.cardSelected]}
        onPress={onPress}
      >
        {/* Status accent left border */}
        <View style={[styles.statusStripe, { backgroundColor: statusColor }]} />

        <View style={styles.cardInner}>
          {/* Top row: product + status */}
          <View style={styles.topRow}>
            <View style={styles.emojiContainer}>
              <Text style={styles.emojiText}>{order.product_emoji || '💨'}</Text>
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>{order.product_name}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.amount}>{order.amount_grams}g</Text>
                <View style={styles.metaDot} />
                <Text style={styles.price}>CHF {order.total_price?.toFixed(2)}</Text>
              </View>
            </View>
            <View style={styles.statusArea}>
              {selectable && (
                <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
                  {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
              )}
              <View style={[styles.statusBadge, { backgroundColor: `${statusColor}14` }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {StatusLabels[order.status] || order.status}
                </Text>
              </View>
            </View>
          </View>

          {/* Details section */}
          {(showConsumer || order.delivery_address || showGeoData || showDistance) && (
            <View style={styles.detailsSection}>
              {showConsumer && displayName && (
                <View style={styles.detailRow}>
                  <View style={[styles.detailIconWrap, { backgroundColor: `${Colors.primary}08` }]}>
                    <Ionicons name="person" size={13} color={Colors.primary} />
                  </View>
                  <Text style={styles.customerName}>{displayName}</Text>
                </View>
              )}
              {order.delivery_address && (
                <View style={styles.detailRow}>
                  <View style={[styles.detailIconWrap, { backgroundColor: `${Colors.accent}12` }]}>
                    <Ionicons name="location" size={13} color={Colors.accent} />
                  </View>
                  <Text style={styles.address} numberOfLines={2}>{order.delivery_address}</Text>
                </View>
              )}
              {showGeoData && order.delivery_lat != null && order.delivery_lng != null && (
                <View style={styles.detailRow}>
                  <View style={[styles.detailIconWrap, { backgroundColor: `${Colors.info}12` }]}>
                    <Ionicons name="navigate" size={13} color={Colors.info} />
                  </View>
                  <Text style={styles.geoText}>
                    {order.delivery_lat.toFixed(4)}, {order.delivery_lng.toFixed(4)}
                  </Text>
                </View>
              )}
              {showDistance && (
                <View style={styles.detailRow}>
                  <View style={[styles.detailIconWrap, { backgroundColor: `${Colors.success}12` }]}>
                    <Ionicons name="speedometer" size={13} color={Colors.success} />
                  </View>
                  <Text style={styles.distanceText}>{showDistance}</Text>
                </View>
              )}
              {showConsumer && order.consumer_phone && (
                <View style={styles.detailRow}>
                  <View style={[styles.detailIconWrap, { backgroundColor: `${Colors.success}12` }]}>
                    <Ionicons name="call" size={12} color={Colors.success} />
                  </View>
                  <Text style={styles.phone}>{order.consumer_phone}</Text>
                </View>
              )}
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.orderId}>#{order.id}</Text>
            {order.driver_name && (
              <View style={styles.driverTag}>
                <Ionicons name="car" size={11} color={Colors.delivering} />
                <Text style={styles.driverName}>{order.driver_name}</Text>
              </View>
            )}
            <View style={styles.timeContainer}>
              {order.created_at ? (
                <>
                  <Text style={styles.timeDate}>{formatDateTime(order.created_at)}</Text>
                  <View style={styles.relativeTimeBadge}>
                    <Text style={styles.relativeTime}>{getRelativeTime(order.created_at)}</Text>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm + 2,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Shadows.md,
  },
  cardSelected: {
    borderColor: Colors.accent,
    borderWidth: 2,
    ...Shadows.lg,
  },
  statusStripe: {
    width: 4,
    borderTopLeftRadius: BorderRadius.lg,
    borderBottomLeftRadius: BorderRadius.lg,
  },
  cardInner: {
    flex: 1,
    padding: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emojiContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    ...Shadows.sm,
  },
  emojiText: { fontSize: 30 },
  productInfo: { flex: 1 },
  productName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: 3,
    lineHeight: 20,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  amount: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textMuted,
    marginHorizontal: 8,
  },
  price: {
    fontSize: FontSize.md,
    color: Colors.accent,
    fontWeight: FontWeight.heavy,
  },
  statusArea: {
    alignItems: 'flex-end',
    gap: 8,
    marginLeft: Spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent,
  },
  detailsSection: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: 7,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  customerName: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: FontWeight.semibold,
    flex: 1,
    lineHeight: 24,
  },
  address: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    flex: 1,
    lineHeight: 20,
  },
  geoText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
    fontVariant: ['tabular-nums'],
    flex: 1,
    lineHeight: 24,
  },
  distanceText: {
    fontSize: FontSize.sm,
    color: Colors.success,
    fontWeight: FontWeight.semibold,
    flex: 1,
    lineHeight: 24,
  },
  phone: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    flex: 1,
    lineHeight: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  orderId: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  driverTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${Colors.delivering}10`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  driverName: {
    fontSize: FontSize.xs,
    color: Colors.delivering,
    fontWeight: FontWeight.bold,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeDate: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  relativeTimeBadge: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  relativeTime: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: FontWeight.bold,
  },
});
