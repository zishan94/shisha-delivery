import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ScrollView,
  RefreshControl, Switch, Alert, ActivityIndicator, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '@/constants/theme';
import { API_URL } from '@/constants/config';

interface Product {
  id: number;
  name: string;
  description: string;
  price_per_gram: number;
  image_url: string;
  category: string;
  category_id: number | null;
  category_name: string | null;
  available: number;
}

interface Category {
  id: number;
  name: string;
  product_count: number;
}

export default function AdminProducts() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/products`),
        fetch(`${API_URL}/api/admin/categories`),
      ]);
      if (prodRes.ok) setProducts(await prodRes.json());
      if (catRes.ok) setCategories(await catRes.json());
    } catch (e) {
      console.error('Failed to fetch products:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const toggleAvailability = async (product: Product) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: !product.available }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
      }
    } catch (e) {
      Alert.alert('Fehler', 'Verfügbarkeit konnte nicht geändert werden');
    }
  };

  const deleteProduct = (product: Product) => {
    Alert.alert(
      'Produkt löschen',
      `"${product.name}" wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/api/admin/products/${product.id}`, { method: 'DELETE' });
              if (res.ok) {
                fetchData();
              }
            } catch (e) {
              Alert.alert('Fehler', 'Produkt konnte nicht gelöscht werden');
            }
          },
        },
      ],
    );
  };

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.description || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = !selectedCategory || p.category_id === selectedCategory;
    return matchSearch && matchCat;
  });

  const isEmoji = (str: string) => !str || !str.startsWith('/uploads/');

  const allCategories = [{ id: null, name: 'Alle' } as any, ...categories];

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.productCard}
      activeOpacity={0.7}
      onPress={() => router.push({ pathname: '/admin/product-edit' as any, params: { id: String(item.id) } })}
      onLongPress={() => deleteProduct(item)}
    >
      <View style={styles.productImageWrap}>
        {item.image_url && !isEmoji(item.image_url) ? (
          <Image source={{ uri: `${API_URL}${item.image_url}` }} style={styles.productImage} />
        ) : (
          <Text style={styles.productEmoji}>{item.image_url || '📦'}</Text>
        )}
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.productCategory}>{item.category_name || item.category || 'Keine Kategorie'}</Text>
        <Text style={styles.productPrice}>CHF {item.price_per_gram?.toFixed(2)} / g</Text>
      </View>
      <View style={styles.productActions}>
        <Switch
          value={!!item.available}
          onValueChange={() => toggleAvailability(item)}
          trackColor={{ false: '#ddd', true: Colors.success + '50' }}
          thumbColor={item.available ? Colors.success : '#ccc'}
        />
        <TouchableOpacity onPress={() => deleteProduct(item)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={18} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.gradientStart, Colors.gradientEnd]} style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Produkte</Text>
            <Text style={styles.headerSubtitle}>{products.length} Produkte</Text>
          </View>
          <TouchableOpacity
            style={styles.categoryBtn}
            onPress={() => router.push('/admin/category-manage' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="pricetags" size={18} color={Colors.secondary} />
            <Text style={styles.categoryBtnText}>Kategorien</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Produkt suchen..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search !== '' && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catFilterList}
      >
        {allCategories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <TouchableOpacity
              key={String(cat.id ?? 'all')}
              style={[styles.catChip, isActive && styles.catChipActive]}
              onPress={() => setSelectedCategory(cat.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.catChipText, isActive && styles.catChipTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.secondary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderProduct}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.secondary} />}
          ListEmptyComponent={<Text style={styles.emptyText}>Keine Produkte gefunden</Text>}
        />
      )}

      {/* FAB to add product */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => router.push({ pathname: '/admin/product-edit' as any, params: { id: 'new' } })}
      >
        <LinearGradient colors={[Colors.secondary, Colors.secondaryLight]} style={styles.fabGradient}>
          <Ionicons name="add" size={28} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: '700', color: '#FFF', letterSpacing: 0.5 },
  headerSubtitle: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    gap: 6,
  },
  categoryBtnText: { fontSize: FontSize.sm, color: Colors.secondary, fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 8,
    ...Shadows.sm,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  catFilterList: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: 8,
  },
  catChip: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    height: 36,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  catChipActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  catChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  catChipTextActive: { color: '#FFF' },
  list: { paddingHorizontal: Spacing.md, paddingBottom: 100 },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  productImageWrap: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  productImage: { width: 50, height: 50, borderRadius: BorderRadius.sm },
  productEmoji: { fontSize: 28 },
  productInfo: { flex: 1 },
  productName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  productCategory: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  productPrice: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.secondary, marginTop: 2 },
  productActions: { alignItems: 'center', gap: 8 },
  deleteBtn: { padding: 4 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    ...Shadows.lg,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
    padding: Spacing.xl,
  },
});
