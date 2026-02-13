import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Switch, Alert, Image, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '@/constants/theme';
import { API_URL } from '@/constants/config';

interface Category {
  id: number;
  name: string;
}

export default function ProductEdit() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pricePerGram, setPricePerGram] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [available, setAvailable] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
    if (!isNew) fetchProduct();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/categories`);
      if (res.ok) setCategories(await res.json());
    } catch (e) {
      console.error('Failed to fetch categories:', e);
    }
  };

  const fetchProduct = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/products`);
      if (res.ok) {
        const products = await res.json();
        const product = products.find((p: any) => p.id === Number(id));
        if (product) {
          setName(product.name);
          setDescription(product.description || '');
          setPricePerGram(String(product.price_per_gram));
          setImageUrl(product.image_url || '');
          setCategoryId(product.category_id);
          setAvailable(!!product.available);
        }
      }
    } catch (e) {
      console.error('Failed to fetch product:', e);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Berechtigung erforderlich', 'Bitte erlaube den Zugriff auf die Galerie.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setLocalImageUri(result.assets[0].uri);
    }
  };

  const uploadImage = async (productId: number): Promise<boolean> => {
    if (!localImageUri) return true;

    try {
      const formData = new FormData();
      const ext = localImageUri.split('.').pop() || 'jpg';
      formData.append('image', {
        uri: localImageUri,
        name: `product-${productId}.${ext}`,
        type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      } as any);

      const res = await fetch(`${API_URL}/api/admin/products/${productId}/image`, {
        method: 'POST',
        body: formData,
      });
      return res.ok;
    } catch (e) {
      console.error('Image upload failed:', e);
      return false;
    }
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Fehler', 'Name ist erforderlich');
      return;
    }
    if (!pricePerGram || isNaN(Number(pricePerGram))) {
      Alert.alert('Fehler', 'Gültiger Preis pro Gramm ist erforderlich');
      return;
    }

    setSaving(true);
    try {
      const body: any = {
        name: name.trim(),
        description: description.trim(),
        price_per_gram: parseFloat(pricePerGram),
        category_id: categoryId,
        category: categories.find(c => c.id === categoryId)?.name?.toLowerCase() || null,
        available,
      };

      // If no local image and user set an emoji/text manually
      if (!localImageUri && imageUrl && !imageUrl.startsWith('/uploads/')) {
        body.image_url = imageUrl;
      }

      let productId: number;

      if (isNew) {
        if (!localImageUri && imageUrl) body.image_url = imageUrl;
        const res = await fetch(`${API_URL}/api/admin/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Create failed');
        const created = await res.json();
        productId = created.id;
      } else {
        productId = Number(id);
        const res = await fetch(`${API_URL}/api/admin/products/${productId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Update failed');
      }

      // Upload image if selected
      if (localImageUri) {
        await uploadImage(productId);
      }

      router.back();
    } catch (e: any) {
      Alert.alert('Fehler', e.message || 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  const isEmoji = (str: string) => !str || !str.startsWith('/uploads/');
  const displayImage = localImageUri || (imageUrl && !isEmoji(imageUrl) ? `${API_URL}${imageUrl}` : null);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.secondary} style={{ marginTop: 100 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.gradientStart, Colors.gradientEnd]} style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isNew ? 'Neues Produkt' : 'Produkt bearbeiten'}</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
          {/* Image */}
          <TouchableOpacity style={styles.imagePickerWrap} onPress={pickImage} activeOpacity={0.7}>
            {displayImage ? (
              <Image source={{ uri: displayImage }} style={styles.imagePreview} />
            ) : imageUrl && isEmoji(imageUrl) ? (
              <View style={styles.emojiPreview}>
                <Text style={styles.emojiText}>{imageUrl}</Text>
                <Text style={styles.emojiHint}>Tippe um Bild zu wählen</Text>
              </View>
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="camera" size={40} color={Colors.textMuted} />
                <Text style={styles.imagePlaceholderText}>Bild auswählen</Text>
              </View>
            )}
            <View style={styles.imageOverlay}>
              <Ionicons name="camera" size={20} color="#FFF" />
            </View>
          </TouchableOpacity>

          {/* Emoji fallback input */}
          <View style={styles.field}>
            <Text style={styles.label}>Emoji (falls kein Bild)</Text>
            <TextInput
              style={styles.input}
              value={isEmoji(imageUrl) ? imageUrl : ''}
              onChangeText={(text) => { setImageUrl(text); setLocalImageUri(null); }}
              placeholder="z.B. 🍎"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Produktname"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>Beschreibung</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Produktbeschreibung..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Price */}
          <View style={styles.field}>
            <Text style={styles.label}>Preis pro Gramm (CHF) *</Text>
            <TextInput
              style={styles.input}
              value={pricePerGram}
              onChangeText={setPricePerGram}
              placeholder="0.10"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Category */}
          <View style={styles.field}>
            <Text style={styles.label}>Kategorie</Text>
            <View style={styles.categoryGrid}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catOption, categoryId === cat.id && styles.catOptionActive]}
                  onPress={() => setCategoryId(cat.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.catOptionText, categoryId === cat.id && styles.catOptionTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Available */}
          <View style={styles.switchRow}>
            <Text style={styles.label}>Verfügbar</Text>
            <Switch
              value={available}
              onValueChange={setAvailable}
              trackColor={{ false: '#ddd', true: Colors.success + '50' }}
              thumbColor={available ? Colors.success : '#ccc'}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.8} disabled={saving}>
            <LinearGradient colors={[Colors.secondary, Colors.secondaryLight]} style={styles.saveBtnGradient}>
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color="#FFF" />
                  <Text style={styles.saveBtnText}>Speichern</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '700', color: '#FFF' },
  content: { flex: 1 },
  contentInner: { padding: Spacing.lg },
  imagePickerWrap: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceLight,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  imagePreview: { width: '100%', height: '100%' },
  emojiPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: { fontSize: 64 },
  emojiHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 8 },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imagePlaceholderText: { fontSize: FontSize.sm, color: Colors.textMuted },
  imageOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  field: { marginBottom: Spacing.md },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  catOption: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catOptionActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  catOptionText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  catOptionTextActive: { color: '#FFF' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  saveBtn: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    ...Shadows.md,
  },
  saveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: 8,
  },
  saveBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: '#FFF',
  },
});
