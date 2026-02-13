import { Platform } from 'react-native';

const getServerUrl = () => {
  // Use local network IP so physical devices (Expo Go) can connect
  return 'http://192.168.0.31:3001';
};

export const API_URL = getServerUrl();
export const WS_URL = getServerUrl();

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
