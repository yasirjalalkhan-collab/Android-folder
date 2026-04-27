// Timber 360 — Theme Constants
export const COLORS = {
  primary:    '#1B6B3A',
  primaryDark:'#155229',
  primaryLight:'#22c55e',
  white:      '#FFFFFF',
  black:      '#000000',
  // Background
  bgLight:    '#F8FAFC',
  bgDark:     '#0F172A',
  // Surface
  surfaceLight:'#FFFFFF',
  surfaceDark: '#1E293B',
  // Text
  textLight:  '#1E293B',
  textDark:   '#F1F5F9',
  textMuted:  '#64748B',
  textMutedDark:'#94A3B8',
  // Border
  borderLight:'#E2E8F0',
  borderDark: '#334155',
  // Status
  success:    '#16a34a',
  warning:    '#d97706',
  danger:     '#dc2626',
  info:       '#2563eb',
  // Cards
  cardBgLight:'#FFFFFF',
  cardBgDark: '#1E293B',
  // Slate shades
  slate50:    '#F8FAFC',
  slate100:   '#F1F5F9',
  slate200:   '#E2E8F0',
  slate300:   '#CBD5E1',
  slate400:   '#94A3B8',
  slate500:   '#64748B',
  slate600:   '#475569',
  slate700:   '#334155',
  slate800:   '#1E293B',
  slate900:   '#0F172A',
  // Green shades
  green50:    '#F0FDF4',
  green100:   '#DCFCE7',
  green600:   '#16A34A',
  green700:   '#15803D',
  green800:   '#166534',
  // Orange
  orange50:   '#FFF7ED',
  orange600:  '#EA580C',
  // Red
  red50:      '#FEF2F2',
  red600:     '#DC2626',
  // Blue
  blue50:     '#EFF6FF',
  blue600:    '#2563EB',
  // Indigo
  indigo600:  '#4F46E5',
  // Teal
  teal500:    '#14B8A6',
};

export const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
};

export const RADIUS = {
  sm: 6, md: 10, lg: 14, xl: 18, xxl: 24, full: 9999,
};

export const FONT = {
  xs: 11, sm: 12, base: 14, md: 16, lg: 18, xl: 20, xxl: 24, xxxl: 28,
};

export const SHADOW = {
  sm: {
    shadowColor: '#000', shadowOffset:{width:0,height:1},
    shadowOpacity:0.05, shadowRadius:2, elevation:1,
  },
  md: {
    shadowColor: '#000', shadowOffset:{width:0,height:2},
    shadowOpacity:0.08, shadowRadius:4, elevation:3,
  },
  lg: {
    shadowColor: '#000', shadowOffset:{width:0,height:4},
    shadowOpacity:0.12, shadowRadius:8, elevation:6,
  },
};
