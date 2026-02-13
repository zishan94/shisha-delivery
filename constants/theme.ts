export const Colors = {
  // Backgrounds
  background: '#FAFAFA',        // clean near-white
  surface: '#FFFFFF',            // pure white cards
  surfaceLight: '#F5F5F5',      // subtle light gray
  surfaceElevated: '#FFFFFF',   // elevated cards with shadow

  // Cards
  card: '#FFFFFF',
  cardLight: '#F8F8F8',
  cardBorder: 'rgba(0,0,0,0.05)',

  // Brand
  primary: '#0D0D0D',           // rich black
  primaryLight: '#2C2C2E',      // charcoal
  primaryDark: '#000000',
  secondary: '#C8A97E',         // warm gold accent
  secondaryLight: '#D4BA94',
  accent: '#FF6B35',            // warm coral/orange - vibrant CTA
  accentLight: '#FF8F66',
  accentDark: '#E55A25',
  accentSoft: 'rgba(255,107,53,0.1)',

  // Text
  text: '#0D0D0D',              // rich black
  textSecondary: '#636366',     // medium gray
  textMuted: '#AEAEB2',         // light gray
  textOnDark: '#FFFFFF',
  textOnAccent: '#FFFFFF',

  // Status
  success: '#34C759',           // iOS green
  warning: '#FF9F0A',           // iOS orange
  info: '#5AC8FA',              // iOS light blue
  delivering: '#007AFF',        // iOS blue
  error: '#FF3B30',             // iOS red
  pending: '#FF9F0A',
  approved: '#34C759',
  assigned: '#AF52DE',          // iOS purple
  completed: '#8E8E93',
  rejected: '#FF3B30',

  // UI
  border: 'rgba(0,0,0,0.06)',
  borderLight: 'rgba(0,0,0,0.03)',
  inputBg: '#F2F2F7',           // iOS system gray 6
  inputBorder: 'rgba(0,0,0,0.08)',
  gradientStart: '#1C1C1E',     // sleek dark charcoal
  gradientEnd: '#2C2C2E',       // warm charcoal
  gradientAccent: '#FF6B35',    // accent for gradient highlights
  overlay: 'rgba(0,0,0,0.4)',
  overlayLight: 'rgba(0,0,0,0.2)',
  glass: 'rgba(255,255,255,0.85)',
  glassStrong: 'rgba(255,255,255,0.95)',
  glassDark: 'rgba(0,0,0,0.6)',

  // Tab bar
  tabBg: '#FFFFFF',
  tabActive: '#FF6B35',         // accent color for active tab
  tabInactive: '#AEAEB2',

  // Misc
  skeleton: '#E5E5EA',
  shimmer: '#F2F2F7',
  divider: 'rgba(0,0,0,0.04)',
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
  lg: 17,
  xl: 22,
  xxl: 28,
  title: 34,
  hero: 40,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
  black: '900' as const,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 28,
  full: 999,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 12,
  },
  accent: {
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  colored: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  }),
};

export const StatusColors: Record<string, string> = {
  pending: '#FF9F0A',
  approved: '#34C759',
  assigned: '#AF52DE',
  delivering: '#007AFF',
  delivered: '#8E8E93',
  rejected: '#FF3B30',
};

export const StatusLabels: Record<string, string> = {
  pending: 'Ausstehend',
  approved: 'Genehmigt',
  assigned: 'Zugewiesen',
  delivering: 'Unterwegs',
  delivered: 'Geliefert',
  rejected: 'Abgelehnt',
};

export const ProductEmojis: Record<string, string> = {
  'Al Fakher Double Apple': '🍎',
  'Adalya Love 66': '💕',
  'Tangiers Cane Mint': '🌿',
  'Fumari White Gummy Bear': '🐻',
  'Holster Grp Mnt': '🍇',
};
