import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
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
      setError('Enter a valid phone number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await requestCode(phone);
      hapticSuccess();
      setCodeSent(true);
    } catch (e: any) {
      setError(e.message || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError('Enter a 6-digit code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await verifyCode(phone, code);
      hapticSuccess();
      if (result.isNew || !result.user.name) {
        router.replace('/(auth)/setup');
      } else {
        router.replace(`/${result.user.role}` as any);
      }
    } catch (e: any) {
      setError(e.message || 'Verification failed');
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

          <Animated.Text entering={FadeInDown.delay(100).springify()} style={styles.emoji}>📱</Animated.Text>
          <Animated.Text entering={FadeInDown.delay(200).springify()} style={styles.title}>Phone Login</Animated.Text>
          <Animated.Text entering={FadeInDown.delay(300).springify()} style={styles.subtitle}>Enter your phone to start ordering</Animated.Text>

          <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.form}>
            {!codeSent ? (
              <>
                <Text style={styles.label}>Your Phone Number</Text>
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
                  <LinearGradient
                    colors={[Colors.gradientStart, Colors.gradientEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.button}
                  >
                    <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Get Verification Code'}</Text>
                  </LinearGradient>
                </AnimatedPressable>
              </>
            ) : (
              <Animated.View entering={FadeIn.duration(300)}>
                <Text style={styles.label}>Verification Code</Text>
                <Text style={styles.hint}>Demo mode: enter any 6-digit code</Text>
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
                  <LinearGradient
                    colors={[Colors.gradientStart, Colors.gradientEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.button}
                  >
                    <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Verify & Continue'}</Text>
                  </LinearGradient>
                </AnimatedPressable>
                <TouchableOpacity onPress={() => { setCodeSent(false); setCode(''); }} style={styles.linkBtn}>
                  <Text style={styles.linkText}>← Change number</Text>
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
        <Animated.Text entering={FadeInDown.delay(100).springify()} style={styles.heroEmoji}>💨</Animated.Text>
        <Animated.Text entering={FadeInDown.delay(200).springify()} style={styles.heroTitle}>Shisha Delivery</Animated.Text>
        <Animated.Text entering={FadeInDown.delay(300).springify()} style={styles.heroSubtitle}>Premium tobacco, delivered fast</Animated.Text>

        <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.landingButtons}>
          <AnimatedPressable onPress={() => { setShowPhoneAuth(true); hapticLight(); }}>
            <LinearGradient
              colors={[Colors.gradientStart, Colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.landingBtn}
            >
              <Ionicons name="cart-outline" size={24} color="#fff" style={{ marginRight: Spacing.sm }} />
              <Text style={styles.landingBtnText}>Order Now</Text>
            </LinearGradient>
          </AnimatedPressable>

          <AnimatedPressable onPress={() => { router.push('/(auth)/staff-login'); hapticLight(); }}>
            <View style={styles.staffBtn}>
              <Ionicons name="briefcase-outline" size={24} color={Colors.textSecondary} style={{ marginRight: Spacing.sm }} />
              <Text style={styles.staffBtnText}>Staff Login</Text>
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
    padding: Spacing.xl,
  },
  backArrow: { marginBottom: Spacing.lg },
  emoji: { fontSize: 60, textAlign: 'center', marginBottom: Spacing.md },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  // Hero / Landing
  heroEmoji: { fontSize: 80, textAlign: 'center', marginBottom: Spacing.md },
  heroTitle: {
    fontSize: FontSize.title,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  landingButtons: { gap: Spacing.md },
  landingBtn: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  landingBtnText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: '#fff',
  },
  staffBtn: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.glassStrong,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  staffBtnText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  // Phone auth form
  form: { gap: Spacing.md },
  label: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  hint: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.lg,
    color: Colors.text,
    letterSpacing: 2,
  },
  button: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  buttonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: '#fff',
  },
  error: {
    color: Colors.error,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  linkBtn: { alignItems: 'center', marginTop: Spacing.sm },
  linkText: { color: Colors.primaryLight, fontSize: FontSize.sm },
});
