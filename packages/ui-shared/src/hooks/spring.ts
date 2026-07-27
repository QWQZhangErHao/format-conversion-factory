import { SPRING } from '../styles/tokens'
import type { Spring } from 'framer-motion'

export type SpringPreset = keyof typeof SPRING

/**
 * Apple spring physics hook — returns Framer Motion `transition` config
 * matching iOS UIView spring behavior.
 *
 * ```tsx
 * <motion.div transition={useSpring('SNAPPY')} />
 * ```
 */
export function useSpring(preset: SpringPreset = 'DEFAULT'): Spring {
  return SPRING[preset] as Spring
}

/**
 * Pre-defined animation variants with Apple spring physics.
 * Use with Framer Motion's `variants` prop.
 */
export const springVariants = {
  /** Fade in + slide up (sheet, panel entry) */
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 },
    transition: SPRING.GENTLE,
  },
  /** Scale in (badge, icon pop) */
  scaleIn: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
    transition: SPRING.SNAPPY,
  },
  /** Fade in only (overlay, backdrop) */
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  },
  /** Stagger children (list, grid) */
  staggerContainer: {
    animate: { transition: { staggerChildren: 0.05 } },
  },
  staggerItem: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: SPRING.GENTLE,
  },
} as const
