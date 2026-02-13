export const Colors = {
  background: '#0A0A0F',
  surface: '#111118',
  surfaceLight: '#1A1A25',
  card: 'rgba(255,255,255,0.05)',
  cardLight: 'rgba(255,255,255,0.08)',
  cardBorder: 'rgba(255,255,255,0.08)',
  primary: '#10B981',
  primaryLight: '#34D399',
  primaryDark: '#059669',
  secondary: '#F59E0B',
  secondaryLight: '#FBBF24',
  accent: '#06B6D4',
  accentLight: '#22D3EE',
  text: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#475569',
  success: '#10B981',
  warning: '#F59E0B',
  info: '#3B82F6',
  delivering: '#3B82F6',
  error: '#EF4444',
  pending: '#F59E0B',
  approved: '#10B981',
  assigned: '#8B5CF6',
  completed: '#64748B',
  rejected: '#EF4444',
  border: 'rgba(255,255,255,0.06)',
  inputBg: 'rgba(255,255,255,0.05)',
  gradientStart: '#10B981',
  gradientEnd: '#06B6D4',
  overlay: 'rgba(0,0,0,0.7)',
  glass: 'rgba(255,255,255,0.03)',
  glassStrong: 'rgba(255,255,255,0.07)',
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
  xxl: 30,
  title: 36,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const StatusColors: Record<string, string> = {
  pending: Colors.pending,
  approved: Colors.approved,
  assigned: Colors.assigned,
  delivering: Colors.delivering,
  delivered: Colors.completed,
  rejected: Colors.rejected,
};

export const StatusLabels: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  assigned: 'Assigned',
  delivering: 'Delivering',
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
