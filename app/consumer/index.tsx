import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { API_URL } from '@/constants/config';
import { hapticLight } from '@/utils/haptics';
import AnimatedPressable from '@/components/AnimatedPressable';

interface Product {
  id: number;
  name: string;
  description: string;
  price_per_gram: number;
  image_url: string;
  category: string;
}

const CATEGORIES = [
  { key: 'all', label: 'Alle', icon: '🔥' },
  { key: 'classic', label: 'Klassik', icon: '🍎' },
  { key: 'fruity', label: 'Fruchtig', icon: '🍓' },
  { key: 'mint', label: 'Minze', icon: '🌿' },
  { key: 'sweet', label: 'Süss', icon: '🍬' },
  { key: 'mix', label: 'Mix', icon: '🍹' },
  { key: 'premium', label: 'Premium', icon: '⭐' },
];

export default function BrowseScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const loadProducts = async () => {
    try {
      setError(false);
      const res = await fetch(`${API_URL}/api/products`);
      const data = await res.json();
      if (Array.isArray(data)) setProducts(data);
    } catch {
      setError(true);
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadProducts(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };

  const filtered = useMemo(() => {
    let list = products;
    if (category !== 'all') list = list.filter(p => p.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    return list;
  }, [products, category, search]);

  const renderProduct = ({ item, index }: { item: Product; index: number }) => (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 40, 400)).duration(400)}>
      <AnimatedPressable
        style={styles.productCard}
        onPress={() => {
          hapticLight();
          router.push({ pathname: '/consumer/order', params: { productId: item.id.toString() } } as any);
        }}
      >
        {/* Product emoji */}
        <View style={styles.emojiContainer}>
          <Text style={styles.emojiText}>{item.image_url}</Text>
        </View>

        {/* Product info */}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.productDesc} numberOfLines={2}>{item.description}</Text>
          <View style={styles.productMeta}>
            <View style={styles.categoryTag}>
              <Text style={styles.categoryTagText}>{item.category}</Text>
            </View>
            <Text style={styles.perGram}>CHF {item.price_per_gram.toFixed(2)}/g</Text>
          </View>
        </View>

        {/* Price + Add */}
        <View style={styles.productAction}>
          <Text style={styles.price}>CHF {item.price_per_gram.toFixed(2)}</Text>
          <Text style={styles.priceLabel}>pro Gramm</Text>
          <View style={styles.addBtn}>
            <Ionicons name="add" size={18} color="#fff" />
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Hero Header */}
      <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
        <View>
          <Text style={styles.brand}>SHISHA</Text>
          <Text style={styles.subtitle}>Entdecke Premium-Geschmäcker</Text>
        </View>
        <View style={styles.logoCircle}>
          <Text style={{ fontSize: 22 }}>💨</Text>
        </View>
      </Animated.View>

      {/* Search Bar */}
      <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Geschmäcker suchen..."
          placeholderTextColor={Colors.textMuted}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Categories */}
      <View style={styles.catsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catsContent}
        >
          {CATEGORIES.map((cat, i) => {
            const active = category === cat.key;
            const count = cat.key === 'all'
              ? products.length
              : products.filter(p => p.category === cat.key).length;
            return (
              <Animated.View key={cat.key} entering={FadeInRight.delay(i * 40).duration(300)}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => { setCategory(cat.key); hapticLight(); }}
                >
                  <Text style={styles.chipIcon}>{cat.icon}</Text>
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                    {cat.label}
                  </Text>
                  <View style={[styles.chipCount, active && styles.chipCountActive]}>
                    <Text style={[styles.chipCountText, active && styles.chipCountTextActive]}>
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </ScrollView>
      </View>

      {/* Products */}
      {!loaded ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Produkte werden geladen...</Text>
        </View>
      ) : error && products.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 40 }}>⚠️</Text>
          <Text style={styles.emptyTitle}>Verbindungsfehler</Text>
          <Text style={styles.emptyText}>Server nicht erreichbar.{'\n'}Bitte prüfe deine WLAN-Verbindung.</Text>
          <AnimatedPressable style={styles.retryBtn} onPress={loadProducts}>
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={styles.retryText}>Erneut versuchen</Text>
          </AnimatedPressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={p => p.id.toString()}
          renderItem={renderProduct}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
          ListEmptyComponent={
            loaded ? (
              <View style={styles.empty}>
                <Text style={{ fontSize: 40 }}>🔍</Text>
                <Text style={styles.emptyTitle}>Keine Produkte gefunden</Text>
                <Text style={styles.emptyText}>Versuch eine andere Suche oder Kategorie</Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Hero header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  brand: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.black,
    color: Colors.text,
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: FontWeight.medium,
  },
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },

  // Search bar
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    marginLeft: Spacing.sm,
    paddingVertical: 0,
  },

  // Categories
  catsContainer: {
    height: 58,
    minHeight: 58,
    maxHeight: 58,
  },
  catsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    height: 58,
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  chipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
    ...Shadows.accent,
  },
  chipIcon: {
    fontSize: 14,
    marginRight: 5,
  },
  chipLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginRight: 6,
  },
  chipLabelActive: {
    color: '#FFFFFF',
  },
  chipCount: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: BorderRadius.sm,
    minWidth: 22,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  chipCountActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  chipCountText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
  },
  chipCountTextActive: {
    color: '#FFFFFF',
  },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  loadingText: { color: Colors.textMuted, fontSize: FontSize.sm },

  list: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },

  // Product card
  productCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Shadows.md,
  },
  emojiContainer: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  emojiText: { fontSize: 30 },
  productInfo: { flex: 1, marginLeft: Spacing.md, justifyContent: 'center' },
  productName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  productDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 3,
    lineHeight: 17,
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: Spacing.sm,
  },
  categoryTag: {
    backgroundColor: Colors.accentSoft,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryTagText: {
    fontSize: 10,
    color: Colors.accent,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  perGram: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },

  productAction: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginLeft: Spacing.sm,
  },
  price: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.heavy,
    color: Colors.text,
  },
  priceLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    ...Shadows.accent,
  },

  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: Spacing.xl },
  emptyTitle: {
    color: Colors.text,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.lg,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    ...Shadows.accent,
  },
  retryText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
});
