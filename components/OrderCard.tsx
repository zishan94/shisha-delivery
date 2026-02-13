import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, FontSize, Spacing, BorderRadius, StatusColors, StatusLabels, Shadows } from '@/constants/theme';
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
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  cardSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
    ...Shadows.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emoji: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
    ...Shadows.sm,
  },
  emojiText: { fontSize: 32 },
  info: { flex: 1 },
  productName: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  amount: { 
    fontSize: FontSize.md, 
    color: Colors.textSecondary, 
    fontWeight: '600' 
  },
  priceDot: { 
    fontSize: FontSize.md, 
    color: Colors.textMuted, 
    marginHorizontal: 8 
  },
  price: { 
    fontSize: FontSize.md, 
    color: Colors.secondary, 
    fontWeight: '800' 
  },
  consumer: {
    fontSize: FontSize.sm,
    color: Colors.primaryLight,
    marginBottom: 3,
    fontWeight: '600',
  },
  address: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  statusContainer: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    ...Shadows.sm,
  },
  statusText: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    letterSpacing: 0.3,
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
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: `${Colors.border}60`,
  },
  orderId: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  driverName: {
    fontSize: FontSize.sm,
    color: Colors.info,
    fontWeight: '700',
  },
  time: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: '500',
  },
});
