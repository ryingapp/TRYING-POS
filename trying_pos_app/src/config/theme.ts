import type { ViewStyle } from 'react-native';

/**
 * Nakhes-inspired dark design system.
 * Deep navy · Bold green accent · High contrast
 */

export const COLORS = {
  // Brand — bold green
  primary: '#22C55E',
  primaryLight: '#0D2818',   // dark green tint
  primaryDark: '#15803D',
  accent: '#F59E0B',
  accentLight: '#2B1D07',   // dark amber tint

  // Semantic
  success: '#22C55E',
  successLight: '#0D2818',  // dark green tint
  warning: '#F59E0B',
  warningLight: '#2B1D07',  // dark amber tint
  error: '#EF4444',
  errorLight: '#2B0C0C',    // dark red tint
  info: '#38BDF8',
  infoLight: '#07192B',     // dark blue tint

  // Surfaces — dark navy layers
  background: '#0D1117',   // page bg
  surface:    '#161B22',   // header / tab bar
  card:       '#1C2333',   // default card
  cardElevated: '#212B3E', // elevated card
  groupedBg:  '#0D1117',
  groupedCard:'#1C2333',

  // Text
  text:          '#F0F6FC',
  textPrimary:   '#F0F6FC',
  textSecondary: '#8B949E',
  textMuted:     '#484F58',
  textLight:     '#484F58',

  // Borders
  border:      '#21262D',
  borderLight: '#1C2333',
  divider:     '#21262D',

  white: '#FFFFFF',
  black: '#000000',

  // Status
  statusPending:   '#F59E0B',
  statusPreparing: '#38BDF8',
  statusReady:     '#22C55E',
  statusCompleted: '#8B949E',
  statusCancelled: '#EF4444',

  // Order types
  typeDineIn:  '#A78BFA',
  typePickup:  '#F59E0B',
  typeDelivery:'#38BDF8',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const RADIUS = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
  full: 9999,
};

export const FONTS = {
  regular:    { fontSize: 15, color: COLORS.textPrimary, fontWeight: '400' as const },
  medium:     { fontSize: 15, color: COLORS.textPrimary, fontWeight: '500' as const },
  bold:       { fontSize: 15, color: COLORS.textPrimary, fontWeight: '600' as const },
  title:      { fontSize: 22, color: COLORS.textPrimary, fontWeight: '700' as const },
  titleLarge: { fontSize: 28, color: COLORS.textPrimary, fontWeight: '800' as const },
  subtitle:   { fontSize: 17, color: COLORS.textPrimary, fontWeight: '600' as const },
  caption:    { fontSize: 13, color: COLORS.textSecondary, fontWeight: '400' as const },
  overline:   { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' as const, letterSpacing: 0.8 },
  price:      { fontSize: 17, color: COLORS.primary, fontWeight: '700' as const },
  priceLarge: { fontSize: 24, color: COLORS.primary, fontWeight: '800' as const },
};

export const SHADOWS = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 8,
    elevation: 4,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;

/** Reusable dark card */
export const CARD_STYLE: ViewStyle = {
  backgroundColor: COLORS.card,
  borderRadius: RADIUS.md,
  borderWidth: 1,
  borderColor: COLORS.border,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 10,
  elevation: 4,
};

