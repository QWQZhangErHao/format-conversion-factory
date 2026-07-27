// ── Apple Design Tokens ──
// Semantic design values mirroring Apple HIG

/** Apple SF Pro font stack */
export const FONT_FAMILY = {
  sans: [
    'Inter',
    '-apple-system',
    'BlinkMacSystemFont',
    '"SF Pro Display"',
    '"SF Pro Text"',
    '"Helvetica Neue"',
    'Arial',
    'sans-serif',
  ].join(', '),
  mono: [
    '"SF Mono"',
    '"Fira Code"',
    '"JetBrains Mono"',
    'Menlo',
    'monospace',
  ].join(', '),
  rounded: [
    '"SF Pro Rounded"',
    'Inter',
    'sans-serif',
  ].join(', '),
} as const

/** Apple color palette — semantic system colors */
export const COLORS = {
  /* System colors */
  blue: '#007AFF',
  brown: '#A2845E',
  cyan: '#32ADE6',
  green: '#34C759',
  indigo: '#5856D6',
  mint: '#00C7BE',
  orange: '#FF9500',
  pink: '#FF2D55',
  purple: '#AF52DE',
  red: '#FF3B30',
  teal: '#59ADC4',
  yellow: '#FFCC00',
  gray: {
    1: '#1C1C1E',
    2: '#2C2C2E',
    3: '#3A3A3C',
    4: '#48484A',
    5: '#636366',
    6: '#8E8E93',
    light: '#AEAEB2',
    ultraLight: '#C7C7CC',
  },
  /* Background */
  background: {
    primary: '#FFFFFF',
    secondary: '#F2F2F7',
    tertiary: '#FFFFFF',
  },
  backgroundDark: {
    primary: '#000000',
    secondary: '#1C1C1E',
    tertiary: '#2C2C2E',
  },
  /* Separator */
  separator: '#C6C6C8',
  separatorDark: '#38383A',
  opaqueSeparator: '#C6C6C8',
  opaqueSeparatorDark: '#38383A',
} as const

/** Apple adaptive corner radius scale */
export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  '2xl': 28,
  full: 9999,
} as const

/** Apple-style shadow elevation system */
export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  md: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  lg: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 8 },
  },
  xl: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 48,
    shadowOffset: { width: 0, height: 12 },
  },
} as const

/** Apple spacing scale (8pt grid) */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
  '4xl': 80,
} as const

/** Apple typography scale */
export const FONT_SIZE = {
  caption: 12,
  footnote: 13,
  subhead: 15,
  callout: 16,
  body: 17,
  title3: 20,
  title2: 22,
  title1: 28,
  largeTitle: 34,
} as const

/** Spring physics presets — matching iOS UIView spring behavior */
export const SPRING = {
  /** Default iOS spring (UIScrollView, button press) */
  DEFAULT: { stiffness: 400, damping: 30, mass: 1 },
  /** Snappy — for small UI elements (tab switch, icon bounce) */
  SNAPPY: { stiffness: 500, damping: 35, mass: 0.8 },
  /** Gentle — for cards, panels appearing */
  GENTLE: { stiffness: 200, damping: 25, mass: 1 },
  /** Bouncy — for celebratory animations */
  BOUNCY: { stiffness: 350, damping: 15, mass: 1 },
  /** Wobble — for attention-grabbing effects */
  WOBBLE: { stiffness: 300, damping: 10, mass: 0.9 },
  /** Slow — for large panels, sheets */
  SLOW: { stiffness: 150, damping: 20, mass: 1.2 },
  /** Magnetic snap — for drag & drop */
  MAGNETIC: { stiffness: 600, damping: 40, mass: 0.6 },
  /** Optimized — GPU-accelerated, minimal layout shift */
  OPTIMIZED: { stiffness: 300, damping: 28, mass: 0.5 },
} as const
