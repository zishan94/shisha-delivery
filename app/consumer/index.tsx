import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import GradientHeader from '@/components/GradientHeader';
import AnimatedPressable from '@/components/AnimatedPressable';
import SkeletonLoader from '@/components/SkeletonLoader';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { API_URL } from '@/constants/config';
import { hapticLight } from '@/utils/haptics';

interface Product {
  id: number;
  name: string;
  description: string;
  price_per_gram: number;
  image_url: string;
  category: string;
}

const categoryColors: Record<string, string> = {
  classic: '#F97316',
  fruity: '#EC4899',
  mint: '#10B981',
  sweet: '#F59E0B',
};

export default function BrowseScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();

  const loadProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/products`);
      const data = await res.json();
      setProducts(data);
    } catch (e) {
      console.error('Failed to load products:', e);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => { loadProducts(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

  const renderProduct = ({ item, index }: { item: Product; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 100).springify()} style={{ flex: 1 }}>
      <AnimatedPressable
        style={styles.productCard}
        onPress={() => {
          hapticLight();
          router.push({ pathname: '/consumer/order', params: { productId: item.id.toString() } } as any);
        }}
      >
        <View style={styles.productHeader}>
          <View style={styles.emojiContainer}>
            <Text style={styles.emoji}>{item.image_url}</Text>
          </View>
          <View style={[styles.categoryBadge, { backgroundColor: `${categoryColors[item.category] || Colors.textMuted}25` }]}>
            <Text style={[styles.categoryText, { color: categoryColors[item.category] || Colors.textMuted }]}>{item.category}</Text>
          </View>
        </View>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productDesc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>CHF {item.price_per_gram.toFixed(2)}</Text>
          <Text style={styles.perGram}>/gram</Text>
        </View>
        <LinearGradient
          colors={[Colors.gradientStart, Colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.orderBtn}
        >
          <Text style={styles.orderBtnText}>Order Now</Text>
        </LinearGradient>
      </AnimatedPressable>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <GradientHeader title="Browse" subtitle="Premium shisha tobacco" />
      {!loaded ? (
        <SkeletonLoader count={4} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id.toString()}
          renderItem={renderProduct}
          contentContainerStyle={styles.list}
          numColumns={2}
          columnWrapperStyle={styles.row}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.empty}>No products available</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.md },
  row: { gap: Spacing.sm },
  emptyContainer: { alignItems: 'center', marginTop: Spacing.xxl },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.md },
  empty: { color: Colors.textMuted, textAlign: 'center' },
  productCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  emojiContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.glassStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: { fontSize: 32 },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  categoryText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  productName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  productDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginBottom: Spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Spacing.sm,
  },
  price: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.secondary,
  },
  perGram: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginLeft: 2,
  },
  orderBtn: {
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  orderBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#fff',
  },
});
