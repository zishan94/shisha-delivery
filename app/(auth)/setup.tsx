import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticSuccess } from '@/utils/haptics';

export default function SetupScreen() {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setProfile } = useAuth();
  const router = useRouter();

  const handleContinue = async () => {
    if (!name.trim()) { setError('Bitte gib einen Namen ein'); return; }
    setLoading(true);
    setError('');
    try {
      const user = await setProfile(name.trim(), 'consumer');
      hapticSuccess();
      router.replace(`/${user.role}` as any);
    } catch (e: any) {
      setError(e.message || 'Profil konnte nicht gespeichert werden');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Animated.Text entering={FadeInDown.delay(100).springify()} style={styles.emoji}>👋</Animated.Text>
      <Animated.Text entering={FadeInDown.delay(200).springify()} style={styles.title}>Willkommen!</Animated.Text>
      <Animated.Text entering={FadeInDown.delay(300).springify()} style={styles.subtitle}>Wie sollen wir dich nennen?</Animated.Text>

      <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.form}>
        <Text style={styles.hint}>Name zur Identifikation — kann auch ein Pseudonym sein</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Dein Name oder Pseudonym"
          placeholderTextColor={Colors.textMuted}
          autoFocus
        />

        {error ? <Animated.Text entering={FadeIn} style={styles.error}>{error}</Animated.Text> : null}

        <AnimatedPressable onPress={handleContinue} disabled={loading}>
          <LinearGradient
            colors={[Colors.gradientStart, Colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.button}
          >
            <Text style={styles.buttonText}>{loading ? 'Wird eingerichtet...' : 'Jetzt bestellen →'}</Text>
          </LinearGradient>
        </AnimatedPressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: Colors.background,
    padding: Spacing.xl, justifyContent: 'center',
  },
  emoji: { fontSize: 60, textAlign: 'center', marginBottom: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.lg },
  form: { gap: Spacing.md },
  hint: {
    fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 18,
  },
  input: {
    backgroundColor: Colors.inputBg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.md, padding: Spacing.lg, fontSize: FontSize.lg,
    color: Colors.text, textAlign: 'center',
  },
  error: { color: Colors.error, fontSize: FontSize.sm, textAlign: 'center' },
  button: { borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center' },
  buttonText: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
});
