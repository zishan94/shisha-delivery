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
  const [customerName, setCustomerName] = useState(user?.name || '');
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
      setAddressError('Address must be at least 5 characters');
      return false;
    }
    setAddressError('');
    return true;
  };

  const validateCustomerName = (name: string): boolean => {
    if (name.trim().length < 2) {
      setCustomerNameError('Name must be at least 2 characters');
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
        setDeliveryLat(loc.latitude);
        setDeliveryLng(loc.longitude);
        // Reverse geocode using Nominatim
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${loc.latitude}&lon=${loc.longitude}&format=json`,
            { headers: { 'User-Agent': 'ShishaDelivery/1.0' } }
          );
          const data = await res.json();
          if (data.display_name) {
            setAddress(data.display_name);
            setAddressError('');
          } else {
            setAddress(`${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`);
          }
        } catch {
          setAddress(`${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`);
        }
      }
    } finally {
      setGpsLoading(false);
    }
  };

  const handleMapPress = (e: any) => {
    if (e?.nativeEvent?.coordinate) {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      setDeliveryLat(latitude);
      setDeliveryLng(longitude);
      setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    }
  };

  const goToCustomer = () => {
    if (!validateAddress(address)) return;
    setStep('customer');
    hapticLight();
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
        showAlert('Error', err.error || 'Failed to place order');
        return;
      }
      const order = await res.json();
      socket?.emit('order:created', order);
      hapticSuccess();
      setPlacedOrder(order);
      setOrderPlaced(true);
    } catch (e) {
      showAlert('Error', 'Failed to place order');
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
            <Animated.Text entering={FadeInDown.delay(300).springify()} style={styles.confirmTitle}>Order Placed!</Animated.Text>
            <Animated.Text entering={FadeInDown.delay(400).springify()} style={styles.confirmSubtitle}>
              Order #{placedOrder.id} has been submitted
            </Animated.Text>
            <Animated.View entering={FadeInUp.delay(500).springify()} style={styles.confirmDetails}>
              <Text style={styles.confirmDetailText}>{product.image_url} {product.name}</Text>
              <Text style={styles.confirmDetailPrice}>{grams}g — CHF {totalPrice.toFixed(2)}</Text>
              <Text style={styles.confirmDetailMuted}>Waiting for approval...</Text>
            </Animated.View>
            <Animated.View entering={FadeInUp.delay(600).springify()} style={{ width: '100%', gap: Spacing.sm }}>
              <AnimatedPressable onPress={() => router.push({ pathname: '/consumer/tracking', params: { orderId: placedOrder.id.toString() } } as any)}>
                <View style={styles.confirmBtn}>
                  <Ionicons name="navigate-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.confirmBtnText}>Track Order</Text>
                </View>
              </AnimatedPressable>
              <AnimatedPressable onPress={() => router.replace('/consumer/orders')}>
                <View style={styles.confirmSecBtn}>
                  <Text style={styles.confirmSecBtnText}>View All Orders</Text>
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
      <Stack.Screen options={{ headerShown: true, title: 'New Order', headerStyle: { backgroundColor: Colors.surface }, headerTintColor: Colors.text }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Product Info */}
        <Animated.View entering={FadeInDown.springify()} style={styles.productCard}>
          <Text style={styles.productEmoji}>{product.image_url}</Text>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productDesc}>{product.description}</Text>
          <Text style={styles.priceLabel}>CHF {product.price_per_gram.toFixed(2)} / gram</Text>
        </Animated.View>

        {step === 'amount' && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Select Amount</Text>
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
                <Text style={styles.nextBtnText}>Next: Delivery Address</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </View>
            </AnimatedPressable>
          </Animated.View>
        )}

        {step === 'address' && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            <TextInput
              style={[styles.input, addressError ? styles.inputError : null]}
              value={address}
              onChangeText={(t) => { setAddress(t); if (addressError) validateAddress(t); }}
              placeholder="Enter delivery address..."
              placeholderTextColor={Colors.textMuted}
              multiline
            />
            {addressError ? <Text style={styles.fieldError}>{addressError}</Text> : null}
            <View style={styles.addressBtns}>
              <AnimatedPressable style={styles.gpsBtn} onPress={handleUseGPS} disabled={gpsLoading}>
                {gpsLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <Ionicons name="locate" size={18} color={Colors.primary} />
                    <Text style={styles.gpsBtnText}>Use My Location</Text>
                  </>
                )}
              </AnimatedPressable>
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
              </View>
            )}

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep('amount')}>
                <Ionicons name="arrow-back" size={18} color={Colors.textSecondary} />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <AnimatedPressable onPress={goToCustomer} style={{ flex: 1 }}>
                <View style={[styles.nextBtn, !address.trim() && { opacity: 0.4 }]}>
                  <Text style={styles.nextBtnText}>Next: Your Name</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </View>
              </AnimatedPressable>
            </View>
          </Animated.View>
        )}

        {step === 'customer' && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>👤 Your Name</Text>
            <View style={styles.nameInfo}>
              <Text style={styles.nameInfoText}>We need your name for the delivery person to identify you</Text>
            </View>
            <TextInput
              style={[styles.input, customerNameError ? styles.inputError : null]}
              value={customerName}
              onChangeText={(t) => { setCustomerName(t); if (customerNameError) validateCustomerName(t); }}
              placeholder="Enter your full name..."
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
            />
            {customerNameError ? <Text style={styles.fieldError}>{customerNameError}</Text> : null}
            
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep('address')}>
                <Ionicons name="arrow-back" size={18} color={Colors.textSecondary} />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <AnimatedPressable onPress={goToConfirm} style={{ flex: 1 }}>
                <View style={[styles.nextBtn, !customerName.trim() && { opacity: 0.4 }]}>
                  <Text style={styles.nextBtnText}>Review Order</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </View>
              </AnimatedPressable>
            </View>
          </Animated.View>
        )}

        {step === 'confirm' && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Order Summary</Text>
            <View style={styles.summaryCard}>
              <View style={styles.receiptHeader}>
                <Text style={styles.receiptTitle}>Receipt</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Product</Text>
                <Text style={styles.summaryValue}>{product.image_url} {product.name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount</Text>
                <Text style={styles.summaryValue}>{grams}g</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Price/gram</Text>
                <Text style={styles.summaryValue}>CHF {product.price_per_gram.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Customer</Text>
                <Text style={styles.summaryValue}>{customerName}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery</Text>
                <Text style={styles.summaryValue} numberOfLines={2}>{address}</Text>
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
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <AnimatedPressable onPress={handleSubmit} disabled={submitting} style={{ flex: 1 }}>
                <View style={styles.nextBtn}>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.nextBtnText}>{submitting ? 'Placing...' : 'Confirm Order'}</Text>
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
  addressBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  gpsBtn: {
    flex: 1, backgroundColor: Colors.surface, padding: Spacing.md,
    borderRadius: BorderRadius.md, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    ...Shadows.sm,
  },
  gpsBtnText: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '600' },
  mapContainer: { height: 200, borderRadius: BorderRadius.md, overflow: 'hidden', marginTop: Spacing.sm },
  map: { flex: 1 },
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
