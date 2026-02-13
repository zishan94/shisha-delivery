import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { useLocation } from '@/contexts/LocationContext';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { API_URL, MIN_GRAMS, MAX_GRAMS, GRAM_STEP } from '@/constants/config';
import MapViewComponent from '@/components/MapView';
import AnimatedPressable from '@/components/AnimatedPressable';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import { showAlert } from '@/utils/alert';

export default function OrderScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { user } = useAuth();
  const { socket } = useSocket();
  const { getCurrentLocation } = useLocation();
  const router = useRouter();

  const [product, setProduct] = useState<any>(null);
  const [grams, setGrams] = useState(50);
  const [address, setAddress] = useState('');
  const [addressError, setAddressError] = useState('');
  const [addressVerified, setAddressVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [addressAlternatives, setAddressAlternatives] = useState<{ address: string; lat: number; lng: number }[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerNameError, setCustomerNameError] = useState('');
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [step, setStep] = useState<'amount' | 'address' | 'customer' | 'confirm'>('amount');
  const [submitting, setSubmitting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<any>(null);

  useEffect(() => {
    if (productId) {
      fetch(`${API_URL}/api/products/${productId}`)
        .then((r) => r.json())
        .then(setProduct)
        .catch(console.error);
    }
  }, [productId]);

  const totalPrice = product ? Math.round(product.price_per_gram * grams * 100) / 100 : 0;

  const validateAddress = (addr: string): boolean => {
    if (addr.trim().length < 5) {
      setAddressError('Adresse muss mindestens 5 Zeichen lang sein');
      return false;
    }
    setAddressError('');
    return true;
  };

  // Verify address via backend geocoding
  const verifyAddress = async (addr: string): Promise<boolean> => {
    if (addr.trim().length < 3) {
      setAddressError('Adresse muss mindestens 3 Zeichen lang sein');
      setAddressVerified(false);
      return false;
    }
    setVerifying(true);
    setAddressError('');
    setAddressAlternatives([]);
    try {
      const res = await fetch(`${API_URL}/api/address/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setAddress(data.address);
        setDeliveryLat(data.lat);
        setDeliveryLng(data.lng);
        setAddressVerified(true);
        setAddressError('');
        if (data.alternatives && data.alternatives.length > 0) {
          setAddressAlternatives(data.alternatives);
        }
        return true;
      } else {
        setAddressError(data.error || 'Adresse konnte nicht verifiziert werden');
        setAddressVerified(false);
        return false;
      }
    } catch (err) {
      console.error('Address verify fetch error:', err);
      setAddressError('Adressüberprüfung fehlgeschlagen. Bitte versuche es erneut.');
      setAddressVerified(false);
      return false;
    } finally {
      setVerifying(false);
    }
  };

  // Reverse geocode via backend
  const reverseGeocode = async (lat: number, lng: number): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/api/address/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      });
      const data = await res.json();
      if (data.valid) {
        setAddress(data.address);
        setDeliveryLat(data.lat);
        setDeliveryLng(data.lng);
        setAddressVerified(true);
        setAddressError('');
      } else {
        setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        setDeliveryLat(lat);
        setDeliveryLng(lng);
        setAddressVerified(false);
        setAddressError(data.error || 'Adresse konnte nicht aufgelöst werden');
      }
    } catch (err) {
      console.error('Reverse geocode fetch error:', err);
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      setDeliveryLat(lat);
      setDeliveryLng(lng);
      setAddressVerified(false);
    }
  };

  const validateCustomerName = (name: string): boolean => {
    if (name.trim().length < 2) {
      setCustomerNameError('Name muss mindestens 2 Zeichen lang sein');
      return false;
    }
    setCustomerNameError('');
    return true;
  };

  const handleUseGPS = async () => {
    setGpsLoading(true);
    try {
      const loc = await getCurrentLocation();
      if (loc) {
        await reverseGeocode(loc.latitude, loc.longitude);
      }
    } finally {
      setGpsLoading(false);
    }
  };

  const handleMapPress = async (e: any) => {
    if (e?.nativeEvent?.coordinate) {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      setDeliveryLat(latitude);
      setDeliveryLng(longitude);
      setAddress('Adresse wird geladen...');
      await reverseGeocode(latitude, longitude);
    }
  };

  const goToCustomer = async () => {
    if (!validateAddress(address)) return;
    // If already verified (e.g. via GPS or map tap), skip re-verification
    if (addressVerified) {
      setStep('customer');
      hapticLight();
      return;
    }
    // Verify the manually typed address via backend
    const verified = await verifyAddress(address);
    if (verified) {
      setStep('customer');
      hapticLight();
    }
  };

  const goToConfirm = () => {
    if (!validateCustomerName(customerName)) return;
    setStep('confirm');
    hapticLight();
  };

  const handleSubmit = async () => {
    if (!user || !product) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consumer_id: user.id,
          product_id: product.id,
          amount_grams: grams,
          delivery_address: address,
          delivery_lat: deliveryLat || 47.3769,
          delivery_lng: deliveryLng || 8.5417,
          customer_name: customerName.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        showAlert('Fehler', err.error || 'Bestellung konnte nicht aufgegeben werden');
        return;
      }
      const order = await res.json();
      socket?.emit('order:created', order);
      hapticSuccess();
      setPlacedOrder(order);
      setOrderPlaced(true);
    } catch (e) {
      showAlert('Fehler', 'Bestellung konnte nicht aufgegeben werden');
    } finally {
      setSubmitting(false);
    }
  };

  // Order confirmation screen
  if (orderPlaced && placedOrder) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.confirmationContainer}>
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.confirmationContent}>
            <Animated.Text entering={FadeInDown.delay(200).springify()} style={styles.confirmEmoji}>🎉</Animated.Text>
            <Animated.Text entering={FadeInDown.delay(300).springify()} style={styles.confirmTitle}>Bestellt!</Animated.Text>
            <Animated.Text entering={FadeInDown.delay(400).springify()} style={styles.confirmSubtitle}>
              Bestellung #{placedOrder.id} wurde aufgegeben
            </Animated.Text>
            <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.confirmDetails}>
              <Text style={styles.confirmDetailText}>{product.image_url} {product.name}</Text>
              <Text style={styles.confirmDetailPrice}>{grams}g — CHF {totalPrice.toFixed(2)}</Text>
              <Text style={styles.confirmDetailMuted}>Wartet auf Genehmigung...</Text>
            </Animated.View>
            <Animated.View entering={FadeInUp.delay(600).springify()} style={{ width: '100%', gap: Spacing.sm }}>
              <AnimatedPressable onPress={() => router.push({ pathname: '/consumer/tracking', params: { orderId: placedOrder.id.toString() } } as any)}>
                <View style={styles.confirmBtn}>
                  <Ionicons name="navigate-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.confirmBtnText}>Bestellung verfolgen</Text>
                </View>
              </AnimatedPressable>
              <AnimatedPressable onPress={() => router.replace('/consumer/orders')}>
                <View style={styles.confirmSecBtn}>
                  <Text style={styles.confirmSecBtnText}>Alle Bestellungen</Text>
                </View>
              </AnimatedPressable>
            </Animated.View>
          </Animated.View>
        </View>
      </>
    );
  }

  if (!product) return <View style={styles.container}><ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: Spacing.xxl }} /></View>;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Neue Bestellung', headerStyle: { backgroundColor: Colors.surface }, headerTintColor: Colors.text }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Product Info */}
        <Animated.View entering={FadeInDown.springify()} style={styles.productCard}>
          <Text style={styles.productEmoji}>{product.image_url}</Text>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productDesc}>{product.description}</Text>
          <Text style={styles.priceLabel}>CHF {product.price_per_gram.toFixed(2)} / Gramm</Text>
        </Animated.View>

        {step === 'amount' && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Menge wählen</Text>
            <View style={styles.sliderRow}>
              <AnimatedPressable
                style={styles.gramBtn}
                onPress={() => { setGrams(Math.max(MIN_GRAMS, grams - GRAM_STEP)); hapticLight(); }}
              >
                <Ionicons name="remove" size={24} color={Colors.text} />
              </AnimatedPressable>
              <View style={styles.gramDisplay}>
                <Text style={styles.gramValue}>{grams}g</Text>
                <Text style={styles.gramPrice}>CHF {totalPrice.toFixed(2)}</Text>
              </View>
              <AnimatedPressable
                style={styles.gramBtn}
                onPress={() => { setGrams(Math.min(MAX_GRAMS, grams + GRAM_STEP)); hapticLight(); }}
              >
                <Ionicons name="add" size={24} color={Colors.text} />
              </AnimatedPressable>
            </View>
            <View style={styles.quickRow}>
              {[50, 100, 200, 250, 500].map((g) => (
                <AnimatedPressable
                  key={g}
                  style={[styles.quickBtn, grams === g && styles.quickBtnActive]}
                  onPress={() => { setGrams(g); hapticLight(); }}
                >
                  <Text style={[styles.quickBtnText, grams === g && styles.quickBtnTextActive]}>{g}g</Text>
                </AnimatedPressable>
              ))}
            </View>
            <AnimatedPressable onPress={() => { setStep('address'); hapticLight(); }}>
              <View style={styles.nextBtn}>
                <Text style={styles.nextBtnText}>Weiter: Lieferadresse</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </View>
            </AnimatedPressable>
          </Animated.View>
        )}

        {step === 'address' && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Lieferadresse</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, styles.inputWithIcon, addressError ? styles.inputError : null, addressVerified ? styles.inputVerified : null]}
                value={address}
                onChangeText={(t) => {
                  setAddress(t);
                  setAddressVerified(false);
                  setAddressAlternatives([]);
                  if (addressError) validateAddress(t);
                }}
                placeholder="z.B. Bahnhofstrasse 1, 8001 Zürich"
                placeholderTextColor={Colors.textMuted}
                multiline
              />
              {addressVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                </View>
              )}
              {verifying && (
                <View style={styles.verifiedBadge}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              )}
            </View>
            {addressError ? <Text style={styles.fieldError}>{addressError}</Text> : null}
            {addressVerified && deliveryLat && deliveryLng && (
              <View style={styles.coordBadge}>
                <Ionicons name="location" size={14} color={Colors.primary} />
                <Text style={styles.coordText}>
                  {deliveryLat.toFixed(5)}, {deliveryLng.toFixed(5)}
                </Text>
                <View style={styles.verifiedTag}>
                  <Ionicons name="shield-checkmark" size={12} color="#22c55e" />
                  <Text style={styles.verifiedTagText}>Verifiziert</Text>
                </View>
              </View>
            )}

            {/* Address alternatives */}
            {addressAlternatives.length > 0 && (
              <View style={styles.alternativesContainer}>
                <Text style={styles.alternativesTitle}>Meintest du:</Text>
                {addressAlternatives.map((alt, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.alternativeBtn}
                    onPress={() => {
                      setAddress(alt.address);
                      setDeliveryLat(alt.lat);
                      setDeliveryLng(alt.lng);
                      setAddressVerified(true);
                      setAddressAlternatives([]);
                      hapticLight();
                    }}
                  >
                    <Ionicons name="location-outline" size={16} color={Colors.primary} />
                    <Text style={styles.alternativeText} numberOfLines={2}>{alt.address}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.addressBtns}>
              <AnimatedPressable style={styles.gpsBtn} onPress={handleUseGPS} disabled={gpsLoading}>
                {gpsLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <Ionicons name="locate" size={18} color={Colors.primary} />
                    <Text style={styles.gpsBtnText}>Mein Standort</Text>
                  </>
                )}
              </AnimatedPressable>
              {address.trim().length >= 3 && !addressVerified && !verifying && (
                <AnimatedPressable style={styles.verifyBtn} onPress={() => verifyAddress(address)}>
                  <Ionicons name="search" size={18} color={Colors.primary} />
                  <Text style={styles.gpsBtnText}>Adresse prüfen</Text>
                </AnimatedPressable>
              )}
            </View>

            {/* Map preview */}
            {(deliveryLat || address.length > 5) && (
              <View style={styles.mapContainer}>
                <MapViewComponent
                  region={deliveryLat ? { latitude: deliveryLat, longitude: deliveryLng! } : undefined}
                  markers={deliveryLat ? [{ id: 'delivery', latitude: deliveryLat, longitude: deliveryLng!, title: 'Delivery', pinColor: Colors.primary }] : []}
                  onPress={handleMapPress}
                  style={styles.map}
                />
                <Text style={styles.mapHint}>Tippe auf die Karte um den Standort zu ändern</Text>
              </View>
            )}

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep('amount')}>
                <Ionicons name="arrow-back" size={18} color={Colors.textSecondary} />
                <Text style={styles.backBtnText}>Zurück</Text>
              </TouchableOpacity>
              <AnimatedPressable onPress={goToCustomer} disabled={verifying} style={{ flex: 1 }}>
                <View style={[styles.nextBtn, (!address.trim() || verifying) && { opacity: 0.4 }]}>
                  {verifying ? (
                    <>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.nextBtnText}>Adresse wird geprüft...</Text>
                    </>
                  ) : addressVerified ? (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.nextBtnText}>Weiter: Dein Name</Text>
                      <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </>
                  ) : (
                    <>
                      <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
                      <Text style={styles.nextBtnText}>Adresse prüfen & Weiter</Text>
                    </>
                  )}
                </View>
              </AnimatedPressable>
            </View>
          </Animated.View>
        )}

        {step === 'customer' && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>👤 Dein Name</Text>
            <View style={styles.nameInfo}>
              <Text style={styles.nameInfoText}>Name zur Identifikation bei der Lieferung — kann auch ein Pseudonym sein</Text>
            </View>
            <TextInput
              style={[styles.input, customerNameError ? styles.inputError : null]}
              value={customerName}
              onChangeText={(t) => { setCustomerName(t); if (customerNameError) validateCustomerName(t); }}
              placeholder="Name oder Pseudonym eingeben..."
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
            />
            {customerNameError ? <Text style={styles.fieldError}>{customerNameError}</Text> : null}
            
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep('address')}>
                <Ionicons name="arrow-back" size={18} color={Colors.textSecondary} />
                <Text style={styles.backBtnText}>Zurück</Text>
              </TouchableOpacity>
              <AnimatedPressable onPress={goToConfirm} style={{ flex: 1 }}>
                <View style={[styles.nextBtn, !customerName.trim() && { opacity: 0.4 }]}>
                  <Text style={styles.nextBtnText}>Bestellung prüfen</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </View>
              </AnimatedPressable>
            </View>
          </Animated.View>
        )}

        {step === 'confirm' && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Zusammenfassung</Text>
            <View style={styles.summaryCard}>
              <View style={styles.receiptHeader}>
                <Text style={styles.receiptTitle}>Beleg</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Produkt</Text>
                <Text style={styles.summaryValue}>{product.image_url} {product.name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Menge</Text>
                <Text style={styles.summaryValue}>{grams}g</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Preis/Gramm</Text>
                <Text style={styles.summaryValue}>CHF {product.price_per_gram.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Name</Text>
                <Text style={styles.summaryValue}>{customerName}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Lieferung</Text>
                <View style={{ flex: 1, alignItems: 'flex-end' as const, marginLeft: Spacing.md }}>
                  <Text style={styles.summaryValue} numberOfLines={2}>{address}</Text>
                  {addressVerified && deliveryLat && deliveryLng && (
                    <View style={styles.summaryCoord}>
                      <Ionicons name="shield-checkmark" size={11} color="#22c55e" />
                      <Text style={styles.summaryCoordText}>
                        {deliveryLat.toFixed(5)}, {deliveryLng.toFixed(5)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>CHF {totalPrice.toFixed(2)}</Text>
              </View>
            </View>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep('customer')}>
                <Ionicons name="arrow-back" size={18} color={Colors.textSecondary} />
                <Text style={styles.backBtnText}>Zurück</Text>
              </TouchableOpacity>
              <AnimatedPressable onPress={handleSubmit} disabled={submitting} style={{ flex: 1 }}>
                <View style={styles.nextBtn}>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.nextBtnText}>{submitting ? 'Wird bestellt...' : 'Bestellung bestätigen'}</Text>
                </View>
              </AnimatedPressable>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  productCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  productEmoji: { fontSize: 56, marginBottom: Spacing.sm },
  productName: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  productDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 20 },
  priceLabel: { fontSize: FontSize.md, color: Colors.secondary, fontWeight: '700', marginTop: Spacing.sm },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  sliderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xl, marginBottom: Spacing.lg },
  gramBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center',
    ...Shadows.sm,
  },
  gramDisplay: { alignItems: 'center' },
  gramValue: { fontSize: FontSize.title, fontWeight: '900', color: Colors.text },
  gramPrice: { fontSize: FontSize.md, color: Colors.secondary, fontWeight: '600' },
  quickRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, marginBottom: Spacing.lg, flexWrap: 'wrap' },
  quickBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, backgroundColor: Colors.surface,
    ...Shadows.sm,
  },
  quickBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  quickBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  quickBtnTextActive: { color: '#fff' },
  nextBtn: { borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, ...Shadows.md },
  nextBtnText: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md,
    color: Colors.text, minHeight: 60, textAlignVertical: 'top',
    ...Shadows.sm,
  },
  inputError: { borderColor: Colors.error },
  fieldError: { color: Colors.error, fontSize: FontSize.xs, marginTop: 4 },
  nameInfo: {
    backgroundColor: Colors.glassStrong,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  nameInfoText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  inputWrapper: { position: 'relative' as const },
  inputWithIcon: { paddingRight: 44 },
  inputVerified: { borderColor: '#22c55e' },
  verifiedBadge: {
    position: 'absolute' as const, right: 12, top: 18,
  },
  coordBadge: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 6, marginTop: 6,
    ...Shadows.sm,
  },
  coordText: { fontSize: FontSize.xs, color: Colors.textMuted, fontFamily: 'monospace' },
  verifiedTag: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3,
    backgroundColor: '#dcfce7', borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 2, marginLeft: 'auto' as const,
  },
  verifiedTagText: { fontSize: 11, color: '#16a34a', fontWeight: '700' as const },
  alternativesContainer: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.sm, marginTop: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  alternativesTitle: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' as const, marginBottom: 6 },
  alternativeBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
    paddingVertical: 8, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  alternativeText: { fontSize: FontSize.sm, color: Colors.text, flex: 1 },
  addressBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  gpsBtn: {
    flex: 1, backgroundColor: Colors.surface, padding: Spacing.md,
    borderRadius: BorderRadius.md, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    ...Shadows.sm,
  },
  verifyBtn: {
    flex: 1, backgroundColor: Colors.surface, padding: Spacing.md,
    borderRadius: BorderRadius.md, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    ...Shadows.sm,
  },
  gpsBtnText: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '600' },
  mapContainer: { height: 200, borderRadius: BorderRadius.md, overflow: 'hidden', marginTop: Spacing.sm },
  map: { flex: 1 },
  mapHint: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: 4 },
  btnRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  backBtn: {
    padding: Spacing.md, borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    ...Shadows.sm,
  },
  backBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  summaryCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    padding: Spacing.lg, ...Shadows.md,
  },
  receiptHeader: { alignItems: 'center', marginBottom: Spacing.md, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  receiptTitle: { fontSize: FontSize.sm, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 2, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm, alignItems: 'flex-start' },
  summaryLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  summaryValue: { fontSize: FontSize.md, color: Colors.text, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: Spacing.md },
  summaryCoord: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4,
    marginTop: 4,
  },
  summaryCoordText: { fontSize: 10, color: Colors.textMuted, fontFamily: 'monospace' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  totalLabel: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  totalValue: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.secondary },
  // Confirmation screen
  confirmationContainer: {
    flex: 1, backgroundColor: Colors.background,
    justifyContent: 'center', alignItems: 'center', padding: Spacing.xl,
  },
  confirmationContent: { alignItems: 'center', width: '100%' },
  confirmEmoji: { fontSize: 72, marginBottom: Spacing.md },
  confirmTitle: { fontSize: FontSize.title, fontWeight: '900', color: Colors.text, marginBottom: Spacing.sm },
  confirmSubtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginBottom: Spacing.xl },
  confirmDetails: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg,
    alignItems: 'center', width: '100%', marginBottom: Spacing.xl,
    ...Shadows.md,
  },
  confirmDetailText: { fontSize: FontSize.md, color: Colors.text, fontWeight: '600', marginBottom: 4 },
  confirmDetailPrice: { fontSize: FontSize.lg, color: Colors.secondary, fontWeight: '700', marginBottom: 4 },
  confirmDetailMuted: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: Spacing.sm },
  confirmBtn: { borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', backgroundColor: Colors.primary, ...Shadows.md },
  confirmBtnText: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
  confirmSecBtn: {
    borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center',
    backgroundColor: Colors.surface, ...Shadows.sm,
  },
  confirmSecBtnText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
});
