import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, FontSize, Spacing, BorderRadius, StatusColors, StatusLabels } from '@/constants/theme';
import AnimatedPressable from './AnimatedPressable';

interface Order {
  id: number;
  product_name: string;
  product_emoji: string;
  amount_grams: number;
  total_price: number;
  status: string;
  delivery_address?: string;
  consumer_name?: string;
  driver_name?: string;
  created_at: string;
}

interface Props {
  order: Order;
  onPress?: () => void;
  showConsumer?: boolean;
  selectable?: boolean;
  selected?: boolean;
  index?: number;
}

const categoryForProduct: Record<string, { label: string; color: string }> = {
  '🍎': { label: 'classic', color: '#F97316' },
  '💕': { label: 'fruity', color: '#EC4899' },
  '🌿': { label: 'mint', color: '#10B981' },
  '🐻': { label: 'sweet', color: '#F59E0B' },
  '🍇': { label: 'fruity', color: '#EC4899' },
};

export default function OrderCard({ order, onPress, showConsumer, selectable, selected, index = 0 }: Props) {
  const cat = categoryForProduct[order.product_emoji] || { label: 'tobacco', color: Colors.textMuted };

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
      <AnimatedPressable
        style={[styles.card, selected && styles.cardSelected]}
        onPress={onPress}
      >
        <View style={styles.row}>
          <View style={styles.emoji}>
            <Text style={styles.emojiText}>{order.product_emoji || '💨'}</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.productName}>{order.product_name}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.amount}>{order.amount_grams}g</Text>
              <Text style={styles.priceDot}>•</Text>
              <Text style={styles.price}>CHF {order.total_price?.toFixed(2)}</Text>
            </View>
            {showConsumer && order.consumer_name && (
              <Text style={styles.consumer}>👤 {order.consumer_name}</Text>
            )}
            {order.delivery_address && (
              <Text style={styles.address} numberOfLines={1}>📍 {order.delivery_address}</Text>
            )}
          </View>
          <View style={styles.statusContainer}>
            {selectable && (
              <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
                {selected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: `${StatusColors[order.status] || Colors.textMuted}20` }]}>
              <Text style={[styles.statusText, { color: StatusColors[order.status] || Colors.textMuted }]}>
                {StatusLabels[order.status] || order.status}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.footer}>
          <Text style={styles.orderId}>#{order.id}</Text>
          {order.driver_name && <Text style={styles.driverName}>🚗 {order.driver_name}</Text>}
          <Text style={styles.time}>
            {order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </Text>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emoji: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.glassStrong,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  emojiText: { fontSize: 28 },
  info: { flex: 1 },
  productName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  amount: { fontSize: FontSize.sm, color: Colors.textSecondary },
  priceDot: { fontSize: FontSize.sm, color: Colors.textMuted, marginHorizontal: 6 },
  price: { fontSize: FontSize.sm, color: Colors.secondary, fontWeight: '700' },
  consumer: {
    fontSize: FontSize.xs,
    color: Colors.primaryLight,
    marginTop: 3,
  },
  address: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statusContainer: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  orderId: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  driverName: {
    fontSize: FontSize.xs,
    color: Colors.info,
    fontWeight: '600',
  },
  time: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
