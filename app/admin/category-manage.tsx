import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '@/constants/theme';
import { API_URL } from '@/constants/config';

interface Category {
  id: number;
  name: string;
  display_order: number;
  product_count: number;
}

export default function CategoryManage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/categories`);
      if (res.ok) setCategories(await res.json());
    } catch (e) {
      console.error('Failed to fetch categories:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, []);

  const addCategory = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), display_order: categories.length + 1 }),
      });
      if (res.ok) {
        setNewName('');
        fetchCategories();
      } else {
        const err = await res.json();
        Alert.alert('Fehler', err.error || 'Konnte Kategorie nicht erstellen');
      }
    } catch (e) {
      Alert.alert('Fehler', 'Erstellen fehlgeschlagen');
    } finally {
      setAdding(false);
    }
  };

  const saveEdit = async (catId: number) => {
    if (!editingName.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/categories/${catId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() }),
      });
      if (res.ok) {
        setEditingId(null);
        setEditingName('');
        fetchCategories();
      } else {
        Alert.alert('Fehler', 'Speichern fehlgeschlagen');
      }
    } catch (e) {
      Alert.alert('Fehler', 'Speichern fehlgeschlagen');
    }
  };

  const deleteCategory = (cat: Category) => {
    if (cat.product_count > 0) {
      Alert.alert(
        'Kategorie wird verwendet',
        `${cat.product_count} Produkte verwenden diese Kategorie. Bitte weise die Produkte zuerst einer anderen Kategorie zu.`,
      );
      return;
    }
    Alert.alert(
      'Kategorie löschen',
      `"${cat.name}" wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/api/admin/categories/${cat.id}`, { method: 'DELETE' });
              if (res.ok) {
                fetchCategories();
              } else {
                const err = await res.json();
                Alert.alert('Fehler', err.error || 'Löschen fehlgeschlagen');
              }
            } catch (e) {
              Alert.alert('Fehler', 'Löschen fehlgeschlagen');
            }
          },
        },
      ],
    );
  };

  const renderCategory = ({ item }: { item: Category }) => {
    const isEditing = editingId === item.id;

    return (
      <View style={styles.catCard}>
        {isEditing ? (
          <View style={styles.editRow}>
            <TextInput
              style={styles.editInput}
              value={editingName}
              onChangeText={setEditingName}
              autoFocus
              onSubmitEditing={() => saveEdit(item.id)}
            />
            <TouchableOpacity onPress={() => saveEdit(item.id)} style={styles.editAction}>
              <Ionicons name="checkmark" size={20} color={Colors.success} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setEditingId(null); setEditingName(''); }} style={styles.editAction}>
              <Ionicons name="close" size={20} color={Colors.error} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.catRow}>
            <View style={styles.catInfo}>
              <Text style={styles.catName}>{item.name}</Text>
              <Text style={styles.catCount}>{item.product_count} Produkte</Text>
            </View>
            <View style={styles.catActions}>
              <TouchableOpacity
                onPress={() => { setEditingId(item.id); setEditingName(item.name); }}
                style={styles.actionBtn}
              >
                <Ionicons name="pencil" size={18} color={Colors.secondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteCategory(item)} style={styles.actionBtn}>
                <Ionicons name="trash-outline" size={18} color={Colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.gradientStart, Colors.gradientEnd]} style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Kategorien</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Add new category */}
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            value={newName}
            onChangeText={setNewName}
            placeholder="Neue Kategorie..."
            placeholderTextColor={Colors.textMuted}
            onSubmitEditing={addCategory}
          />
          <TouchableOpacity style={styles.addBtn} onPress={addCategory} disabled={adding} activeOpacity={0.7}>
            {adding ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="add" size={22} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Colors.secondary} style={{ marginTop: 60 }} />
        ) : (
          <FlatList
            data={categories}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderCategory}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Keine Kategorien vorhanden. Füge eine hinzu!</Text>
            }
          />
        )}
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
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.md,
    gap: Spacing.sm,
  },
  addInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: { paddingHorizontal: Spacing.md, paddingBottom: 40 },
  catCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catInfo: { flex: 1 },
  catName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  catCount: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  catActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  editInput: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  editAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceLight,
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
