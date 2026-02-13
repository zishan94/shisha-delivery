import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ScrollView,
  RefreshControl, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '@/constants/theme';
import { API_URL } from '@/constants/config';

const SEGMENTS = [
  { key: 'all', label: 'Alle' },
  { key: 'consumer', label: 'Kunden' },
  { key: 'driver', label: 'Fahrer' },
  { key: 'approver', label: 'Genehmiger' },
  { key: 'admin', label: 'Admins' },
];

const ROLE_ICONS: Record<string, string> = {
  consumer: 'person',
  driver: 'car',
  approver: 'checkmark-circle',
  admin: 'shield',
};

const ROLE_COLORS: Record<string, string> = {
  consumer: Colors.info,
  driver: Colors.success,
  approver: Colors.warning,
  admin: Colors.secondary,
};

interface User {
  id: number;
  phone: string;
  name: string;
  role: string;
  region: string | null;
  created_at: string;
  order_count: number;
  delivery_count: number;
}

export default function AdminUsers() {
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [segment, setSegment] = useState('all');
  const [search, setSearch] = useState('');

  // Edit modal state
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editRegion, setEditRegion] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      let url = `${API_URL}/api/admin/users`;
      if (segment !== 'all') url += `?role=${segment}`;
      const res = await fetch(url);
      if (res.ok) setUsers(await res.json());
    } catch (e) {
      console.error('Failed to fetch users:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [segment]);

  useEffect(() => {
    setLoading(true);
    fetchUsers();
  }, [fetchUsers]);

  const onRefresh = () => { setRefreshing(true); fetchUsers(); };

  const filtered = users.filter(u => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (u.name || '').toLowerCase().includes(term) || (u.phone || '').includes(term);
  });

  const openEdit = (user: User) => {
    setEditUser(user);
    setEditName(user.name || '');
    setEditRole(user.role || '');
    setEditRegion(user.region || '');
  };

  const saveUser = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim() || null,
          role: editRole,
          region: editRegion.trim() || null,
        }),
      });
      if (res.ok) {
        setEditUser(null);
        fetchUsers();
      } else {
        Alert.alert('Fehler', 'Speichern fehlgeschlagen');
      }
    } catch (e) {
      Alert.alert('Fehler', 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = (user: User) => {
    Alert.alert(
      'Benutzer löschen',
      `"${user.name || user.phone}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/api/admin/users/${user.id}`, { method: 'DELETE' });
              if (res.ok) {
                setEditUser(null);
                fetchUsers();
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

  const renderUser = ({ item }: { item: User }) => {
    const roleColor = ROLE_COLORS[item.role] || Colors.textMuted;
    const roleIcon = ROLE_ICONS[item.role] || 'person';

    return (
      <TouchableOpacity style={styles.userCard} activeOpacity={0.7} onPress={() => openEdit(item)}>
        <View style={[styles.avatarWrap, { backgroundColor: roleColor + '18' }]}>
          <Ionicons name={roleIcon as any} size={22} color={roleColor} />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>{item.name || 'Unbenannt'}</Text>
          {item.role === 'driver' && (
            <View style={styles.regionSubtitle}>
              <Ionicons name="location" size={13} color={Colors.secondary} />
              <Text style={styles.regionSubtitleText}>{item.region || 'Keine Region'}</Text>
            </View>
          )}
          <View style={styles.userMeta}>
            <View style={[styles.roleBadge, { backgroundColor: roleColor + '15' }]}>
              <Text style={[styles.roleText, { color: roleColor }]}>
                {item.role === 'consumer' ? 'Kunde' : item.role === 'driver' ? 'Fahrer' : item.role === 'admin' ? 'Admin' : 'Genehmiger'}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.userStats}>
          {item.role === 'driver' ? (
            <Text style={styles.statText}>{item.delivery_count} Lieferungen</Text>
          ) : (
            <Text style={styles.statText}>{item.order_count} Bestellungen</Text>
          )}
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[Colors.gradientStart, Colors.gradientEnd]} style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={styles.headerTitle}>Konten</Text>
        <Text style={styles.headerSubtitle}>{users.length} Benutzer</Text>
      </LinearGradient>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Name suchen..."
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

      {/* Segment Control */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.segmentList}
      >
        {SEGMENTS.map((seg) => {
          const isActive = segment === seg.key;
          return (
            <TouchableOpacity
              key={seg.key}
              style={[styles.segmentBtn, isActive && styles.segmentBtnActive]}
              onPress={() => setSegment(seg.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                {seg.label}
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
          renderItem={renderUser}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.secondary} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Keine Benutzer gefunden</Text>
            </View>
          }
        />
      )}

      {/* Edit Modal */}
      <Modal visible={!!editUser} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Benutzer bearbeiten</Text>
              <TouchableOpacity onPress={() => setEditUser(null)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Name</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Name"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Rolle</Text>
              <View style={styles.roleOptions}>
                {['consumer', 'driver', 'approver', 'admin'].map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleOption, editRole === r && styles.roleOptionActive]}
                    onPress={() => setEditRole(r)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={(ROLE_ICONS[r] || 'person') as any} size={16} color={editRole === r ? '#FFF' : Colors.textSecondary} />
                    <Text style={[styles.roleOptionText, editRole === r && styles.roleOptionTextActive]}>
                      {r === 'consumer' ? 'Kunde' : r === 'driver' ? 'Fahrer' : r === 'admin' ? 'Admin' : 'Genehmiger'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {(editRole === 'driver') && (
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Region</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editRegion}
                  onChangeText={setEditRegion}
                  placeholder="z.B. Basel, Zürich..."
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => editUser && deleteUser(editUser)}
                activeOpacity={0.7}
              >
                <Ionicons name="trash" size={18} color={Colors.error} />
                <Text style={styles.deleteBtnText}>Löschen</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveBtn} onPress={saveUser} activeOpacity={0.8} disabled={saving}>
                <LinearGradient colors={[Colors.secondary, Colors.secondaryLight]} style={styles.saveBtnGradient}>
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>Speichern</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: '700', color: '#FFF', letterSpacing: 0.5 },
  headerSubtitle: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    margin: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 8,
    ...Shadows.sm,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  segmentList: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: 8,
  },
  segmentBtn: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    height: 36,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  segmentBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  segmentText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  segmentTextActive: { color: '#FFF' },
  list: { paddingHorizontal: Spacing.md, paddingBottom: 40 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: { flex: 1 },
  userName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  regionSubtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  regionSubtitleText: { fontSize: FontSize.xs, color: Colors.secondary, fontWeight: '600' },
  userMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  roleBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleText: { fontSize: FontSize.xs, fontWeight: '600' },
  userStats: { alignItems: 'flex-end', gap: 4 },
  statText: { fontSize: FontSize.xs, color: Colors.textMuted },
  emptyWrap: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  modalField: { marginBottom: Spacing.md },
  modalLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  modalInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalValue: { fontSize: FontSize.md, color: Colors.textSecondary },
  roleOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleOptionActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  roleOptionText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  roleOptionTextActive: { color: '#FFF' },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  deleteBtnText: { fontSize: FontSize.sm, color: Colors.error, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  saveBtnGradient: {
    paddingVertical: Spacing.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { fontSize: FontSize.md, fontWeight: '700', color: '#FFF' },
});
