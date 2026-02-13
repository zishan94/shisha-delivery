import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticSuccess } from '@/utils/haptics';

export default function StaffLoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { staffLogin } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!username.trim()) { setError('Bitte Benutzername eingeben'); return; }
    if (!password.trim()) { setError('Bitte Passwort eingeben'); return; }
    setLoading(true);
    setError('');
    try {
      const user = await staffLogin(username.trim(), password);
      hapticSuccess();
      router.replace(`/${user.role}` as any);
    } catch (e: any) {
      setError(e.message || 'Anmeldung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <TouchableOpacity style={styles.backArrow} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color={Colors.text} />
        </TouchableOpacity>

        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.iconContainer}>
          <Ionicons name="shield-checkmark" size={48} color={Colors.primary} />
        </Animated.View>
        <Animated.Text entering={FadeInDown.delay(200).springify()} style={styles.title}>Mitarbeiter-Login</Animated.Text>
        <Animated.Text entering={FadeInDown.delay(300).springify()} style={styles.subtitle}>Für Genehmiger und Fahrer</Animated.Text>

        <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.form}>
          <Text style={styles.label}>Benutzername</Text>
          <View style={styles.inputRow}>
            <Ionicons name="person-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="z.B. approver1"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Text style={styles.label}>Passwort</Text>
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Passwort eingeben"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {error ? <Animated.Text entering={FadeIn} style={styles.error}>{error}</Animated.Text> : null}

          <AnimatedPressable onPress={handleLogin} disabled={loading}>
            <View style={styles.button}>
              <Text style={styles.buttonText}>{loading ? 'Wird angemeldet...' : 'Anmelden'}</Text>
            </View>
          </AnimatedPressable>

          <View style={styles.hintBox}>
            <Text style={styles.hintTitle}>Demo-Konten</Text>
            <Text style={styles.hintText}>Genehmiger: approver1 / admin123</Text>
            <Text style={styles.hintText}>Fahrer: driver1 / driver123</Text>
            <Text style={styles.hintText}>Fahrer: driver2 / driver123</Text>
          </View>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, justifyContent: 'center', padding: Spacing.xl },
  backArrow: { 
    position: 'absolute', top: 60, left: Spacing.xl, zIndex: 10,
    padding: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.surface, ...Shadows.sm,
  },
  iconContainer: {
    alignSelf: 'center', width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.md, ...Shadows.md,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl },
  form: { gap: Spacing.md },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, ...Shadows.sm,
  },
  inputIcon: { marginLeft: Spacing.md },
  input: { flex: 1, padding: Spacing.md, fontSize: FontSize.md, color: Colors.text },
  eyeBtn: { padding: Spacing.md },
  button: {
    borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center',
    marginTop: Spacing.sm, backgroundColor: Colors.primary, ...Shadows.md,
  },
  buttonText: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
  error: { color: Colors.error, fontSize: FontSize.sm, textAlign: 'center' },
  hintBox: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginTop: Spacing.sm, ...Shadows.sm,
  },
  hintTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary, marginBottom: Spacing.xs },
  hintText: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
});
