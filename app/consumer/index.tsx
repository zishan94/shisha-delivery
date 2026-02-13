import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
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

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'classic', label: 'Classic' },
  { key: 'fruity', label: 'Fruity' },
  { key: 'mint', label: 'Mint' },
  { key: 'sweet', label: 'Sweet' },
  { key: 'mix', label: 'Mix' },
  { key: 'premium', label: 'Premium' },
];

export default function BrowseScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetch(`${API_URL}/api/products`)
      .then(r => r.json())
      .then(d => { setProducts(d); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

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
    <Animated.View entering={FadeInDown.delay(index * 40).duration(400)}>
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.productCard}
        onPress={() => {
          hapticLight();
          router.push({ pathname: '/consumer/order', params: { productId: item.id.toString() } } as any);
        }}
      >
        <View style={styles.productLeft}>
          <View style={styles.emojiCircle}>
            <Text style={{ fontSize: 28 }}>{item.image_url}</Text>
          </View>
        </View>
        <View style={styles.productCenter}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.productDesc} numberOfLines={2}>{item.description}</Text>
          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{item.category}</Text>
            </View>
            <Text style={styles.perGram}>CHF {item.price_per_gram.toFixed(2)}/g</Text>
          </View>
        </View>
        <View style={styles.productRight}>
          <Text style={styles.price}>CHF {item.price_per_gram.toFixed(2)}</Text>
          <Text style={styles.priceLabel}>per gram</Text>
          <View style={styles.addBtn}>
            <Ionicons name="add" size={18} color="#fff" />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>SHISHA</Text>
          <Text style={styles.subtitle}>Discover premium flavors</Text>
        </View>
        <View style={styles.logoCircle}>
          <Text style={{ fontSize: 22 }}>💊</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search flavors..."
          placeholderTextColor={Colors.textMuted}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cats}>
        {CATEGORIES.map(cat => {
          const active = category === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              activeOpacity={0.7}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => { setCategory(cat.key); hapticLight(); }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Products */}
      <FlatList
        data={filtered}
        keyExtractor={p => p.id.toString()}
        renderItem={renderProduct}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 40 }}>🔍</Text>
              <Text style={styles.emptyText}>No flavors found</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  brand: {
    fontSize: 28,
    fontWeight: '300',
    color: Colors.primary,
    letterSpacing: 6,
  },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 14,
    height: 46,
    ...Shadows.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text, marginLeft: 10 },

  cats: { paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    marginRight: 8,
    ...Shadows.sm,
  },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  chipTextActive: { color: '#fff' },

  list: { paddingHorizontal: 20, paddingBottom: 100 },

  productCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    ...Shadows.md,
  },
  productLeft: { justifyContent: 'center' },
  emojiCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productCenter: { flex: 1, marginLeft: 14, justifyContent: 'center' },
  productName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  productDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 3, lineHeight: 16 },
  tagRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  tag: {
    backgroundColor: 'rgba(26,26,46,0.08)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: { fontSize: 10, color: Colors.primary, fontWeight: '600', textTransform: 'uppercase' },
  perGram: { fontSize: 10, color: Colors.textMuted },

  productRight: { alignItems: 'flex-end', justifyContent: 'space-between', marginLeft: 8 },
  price: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  priceLabel: { fontSize: 10, color: Colors.textMuted },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },

  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: Colors.textMuted, marginTop: 10, fontSize: 14 },
});