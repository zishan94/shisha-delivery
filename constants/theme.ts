export const Colors = {
  // Backgrounds
  background: '#F5F5F0',    // warm off-white
  surface: '#FFFFFF',        // pure white cards
  surfaceLight: '#FAFAF7',  // slightly warm white
  
  // Cards
  card: '#FFFFFF',
  cardLight: '#FAFAF7',
  cardBorder: 'rgba(0,0,0,0.06)',
  
  // Brand
  primary: '#1A1A2E',       // deep navy/dark - main brand color
  primaryLight: '#2D2D44',
  primaryDark: '#0F0F1A',
  secondary: '#C8A97E',     // warm gold accent
  secondaryLight: '#D4BA94',
  accent: '#8B9E8B',        // sage green
  accentLight: '#A3B5A3',
  
  // Text
  text: '#1A1A1A',          // near black
  textSecondary: '#6B6B6B', // medium gray
  textMuted: '#9B9B9B',     // light gray
  
  // Status
  success: '#4CAF50',
  warning: '#FF9800',
  info: '#2196F3',
  delivering: '#2196F3',
  error: '#F44336',
  pending: '#FF9800',
  approved: '#4CAF50',
  assigned: '#9C27B0',
  completed: '#607D8B',
  rejected: '#F44336',
  
  // UI
  border: 'rgba(0,0,0,0.08)',
  inputBg: '#F5F5F0',
  gradientStart: '#1A1A2E',
  gradientEnd: '#2D2D44',
  overlay: 'rgba(0,0,0,0.5)',
  glass: 'rgba(255,255,255,0.8)',
  glassStrong: 'rgba(255,255,255,0.95)',
  
  // Tab bar
  tabBg: '#FFFFFF',
  tabActive: '#1A1A2E',
  tabInactive: '#9B9B9B',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
  title: 34,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const StatusColors: Record<string, string> = {
  pending: '#FF9800',
  approved: '#4CAF50',
  assigned: '#9C27B0',
  delivering: '#2196F3',
  delivered: '#607D8B',
  rejected: '#F44336',
};

export const StatusLabels: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  assigned: 'Assigned',
  delivering: 'On the way',
  delivered: 'Delivered',
  rejected: 'Rejected',
};

export const ProductEmojis: Record<string, string> = {
  'Al Fakher Double Apple': '🍎',
  'Adalya Love 66': '💕',
  'Tangiers Cane Mint': '🌿',
  'Fumari White Gummy Bear': '🐻',
  'Holster Grp Mnt': '🍇',
};