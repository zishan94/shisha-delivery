import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight, hapticSuccess } from '@/utils/haptics';

export default function PhoneScreen() {
  const [phone, setPhone] = useState('+41');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPhoneAuth, setShowPhoneAuth] = useState(false);
  const { requestCode, verifyCode } = useAuth();
  const router = useRouter();

  const handleRequestCode = async () => {
    if (phone.length < 5) {
      setError('Bitte gib eine gültige Telefonnummer ein');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await requestCode(phone);
      hapticSuccess();
      setCodeSent(true);
    } catch (e: any) {
      setError(e.message || 'Code konnte nicht gesendet werden');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError('Bitte gib einen 6-stelligen Code ein');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await verifyCode(phone, code);
      hapticSuccess();
      if (result.isNew || !result.user.name || !result.user.role) {
        router.replace('/(auth)/setup');
      } else {
        router.replace(`/${result.user.role}` as any);
      }
    } catch (e: any) {
      setError(e.message || 'Verifizierung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  // Phone auth sub-screen
  if (showPhoneAuth) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <TouchableOpacity style={styles.backArrow} onPress={() => { setShowPhoneAuth(false); setCodeSent(false); setCode(''); setError(''); }}>
            <Ionicons name="arrow-back" size={28} color={Colors.text} />
          </TouchableOpacity>

          <Animated.Text entering={FadeInDown.delay(100).springify()} style={styles.emoji}>💊</Animated.Text>
          <Animated.Text entering={FadeInDown.delay(200).springify()} style={styles.title}>Telefon-Login</Animated.Text>
          <Animated.Text entering={FadeInDown.delay(300).springify()} style={styles.subtitle}>Gib deine Nummer ein, um zu bestellen</Animated.Text>

          <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.form}>
            {!codeSent ? (
              <>
                <Text style={styles.label}>Deine Telefonnummer</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+41 79 123 4567"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                  autoFocus
                />
                <AnimatedPressable onPress={handleRequestCode} disabled={loading}>
                  <View style={styles.button}>
                    <Text style={styles.buttonText}>{loading ? 'Wird gesendet...' : 'Code anfordern'}</Text>
                  </View>
                </AnimatedPressable>
              </>
            ) : (
              <Animated.View entering={FadeIn.duration(300)}>
                <Text style={styles.label}>Bestätigungscode</Text>
                <Text style={styles.hint}>Demo: beliebigen 6-stelligen Code eingeben</Text>
                <TextInput
                  style={styles.input}
                  value={code}
                  onChangeText={setCode}
                  placeholder="123456"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
                <AnimatedPressable onPress={handleVerify} disabled={loading}>
                  <View style={styles.button}>
                    <Text style={styles.buttonText}>{loading ? 'Wird überprüft...' : 'Bestätigen & Weiter'}</Text>
                  </View>
                </AnimatedPressable>
                <TouchableOpacity onPress={() => { setCodeSent(false); setCode(''); }} style={styles.linkBtn}>
                  <Text style={styles.linkText}>← Nummer ändern</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
            {error ? <Animated.Text entering={FadeIn} style={styles.error}>{error}</Animated.Text> : null}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Landing screen
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Animated.Text entering={FadeInDown.delay(100).springify()} style={styles.brandTitle}>SHISHA</Animated.Text>
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.brandIcon}>
          <Text style={styles.pillEmoji}>💊</Text>
        </Animated.View>
        <Animated.Text entering={FadeInDown.delay(300).springify()} style={styles.tagline}>Premium Lieferung</Animated.Text>

        <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.landingButtons}>
          <AnimatedPressable onPress={() => { setShowPhoneAuth(true); hapticLight(); }}>
            <View style={styles.orderBtn}>
              <Text style={styles.orderBtnText}>Jetzt bestellen</Text>
            </View>
          </AnimatedPressable>

          <AnimatedPressable onPress={() => { router.push('/(auth)/staff-login'); hapticLight(); }}>
            <View style={styles.staffBtn}>
              <Text style={styles.staffBtnText}>Mitarbeiter-Login</Text>
            </View>
          </AnimatedPressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  backArrow: { 
    alignSelf: 'flex-start',
    marginBottom: Spacing.lg,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    ...Shadows.sm,
  },
  brandTitle: {
    fontSize: 48, fontWeight: '300', color: Colors.primary,
    letterSpacing: 8, textAlign: 'center', marginBottom: Spacing.lg,
  },
  brandIcon: { marginBottom: Spacing.md },
  pillEmoji: { fontSize: 60, textAlign: 'center' },
  tagline: {
    fontSize: FontSize.lg, color: Colors.textSecondary, textAlign: 'center',
    marginBottom: Spacing.xxl * 1.5, fontWeight: '400',
  },
  landingButtons: { gap: Spacing.lg, width: '100%', maxWidth: 280 },
  orderBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.xl,
    padding: Spacing.lg + 4, alignItems: 'center', ...Shadows.md,
  },
  orderBtnText: { fontSize: FontSize.lg, fontWeight: '600', color: '#FFFFFF', letterSpacing: 1 },
  staffBtn: {
    backgroundColor: 'transparent', borderRadius: BorderRadius.xl,
    padding: Spacing.lg + 4, alignItems: 'center', borderWidth: 1.5, borderColor: Colors.primary,
  },
  staffBtnText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.primary, letterSpacing: 1 },
  emoji: { fontSize: 60, textAlign: 'center', marginBottom: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xxl },
  form: { gap: Spacing.md, width: '100%', maxWidth: 320 },
  label: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  hint: { fontSize: FontSize.sm, color: Colors.textMuted },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.md, padding: Spacing.md + 2, fontSize: FontSize.lg,
    color: Colors.text, letterSpacing: 1, ...Shadows.sm,
  },
  button: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    padding: Spacing.md + 2, alignItems: 'center', marginTop: Spacing.sm, ...Shadows.md,
  },
  buttonText: { fontSize: FontSize.md, fontWeight: '600', color: '#FFFFFF', letterSpacing: 1 },
  error: { color: Colors.error, fontSize: FontSize.sm, textAlign: 'center' },
  linkBtn: { alignItems: 'center', marginTop: Spacing.sm },
  linkText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '500' },
});
