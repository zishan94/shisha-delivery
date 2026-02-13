import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Derive the base URL of the Metro bundler.
 * The metro.config.js proxy forwards /api/* and /socket.io/* to the backend,
 * so the app only needs ONE host – the same one that served the JS bundle.
 */
const getBaseUrl = () => {
  if (Platform.OS === 'web') {
    // On web, use the same origin as the page (works with proxy)
    if (typeof window !== 'undefined' && window.location) {
      return `${window.location.protocol}//${window.location.host}`;
    }
    return 'http://localhost:8081';
  }

  // On mobile (Expo Go), the hostUri points at the Metro bundler
  const debuggerHost =
    Constants.expoConfig?.hostUri ?? // SDK 54+
    (Constants as any).manifest?.debuggerHost ?? // older SDKs
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;

  if (debuggerHost) {
    return `http://${debuggerHost}`;
  }

  // Fallback — update this if auto-detect fails
  return 'http://192.168.0.123:8081';
};

export const API_URL = getBaseUrl();
export const WS_URL = getBaseUrl();

export const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

export const MAP_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const DELIVERY_BUFFER_MINUTES = 5;
export const DRIVER_LOCATION_INTERVAL_MS = 5000;
export const MIN_GRAMS = 25;
export const MAX_GRAMS = 500;
export const GRAM_STEP = 25;

// Default map region (Zurich area)
export const DEFAULT_REGION = {
  latitude: 47.3769,
  longitude: 8.5417,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};
