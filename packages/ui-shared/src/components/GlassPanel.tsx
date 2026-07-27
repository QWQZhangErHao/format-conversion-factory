import React, { type ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'

export interface GlassPanelProps extends HTMLMotionProps<'div'> {
  children: ReactNode
  /** Blur intensity: light | medium | heavy */
  intensity?: 'light' | 'medium' | 'heavy'
  /** Inner glow border */
  bordered?: boolean
  /** Padding size */
  padding?: 'sm' | 'md' | 'lg'
  /** Rounded size */
  rounded?: 'md' | 'lg' | 'xl' | '2xl'
  /** Hover lift effect */
  hoverable?: boolean
}

const blurMap = {
  light: 'backdrop-blur-[8px]',
  medium: 'backdrop-blur-[20px]',
  heavy: 'backdrop-blur-[40px] saturate-[1.8]',
} as const

const paddingMap = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
} as const

const radiusMap = {
  md: 'rounded-[10px]',
  lg: 'rounded-[14px]',
  xl: 'rounded-[20px]',
  '2xl': 'rounded-[28px]',
} as const

/**
 * GlassPanel — Apple Liquid Glass container.
 * Uses frosted-glass backdrop blur with adaptive lighting.
 *
 * ```tsx
 * <GlassPanel intensity="medium" hoverable>
 *   <p>Content</p>
 * </GlassPanel>
 * ```
 */
export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  (
    {
      children,
      intensity = 'medium',
      bordered = true,
      padding = 'md',
      rounded = 'xl',
      hoverable = false,
      className = '',
      ...props
    },
    ref,
  ) => {
    return (
      <motion.div
        ref={ref}
        className={[
          'relative overflow-hidden transform-gpu',
          blurMap[intensity],
          paddingMap[padding],
          radiusMap[rounded],
          'bg-white/70 dark:bg-gray-900/70',
          'glass-specular',
          bordered &&
            'shadow-[0_0_0_1px_rgba(255,255,255,0.5)_inset,0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.04)]',
          !bordered &&
            'shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.04)]',
          hoverable &&
            'cursor-pointer transition-shadow duration-300 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.5)_inset,0_4px_12px_rgba(0,0,0,0.06),0_12px_32px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_4px_12px_rgba(0,0,0,0.3),0_12px_32px_rgba(0,0,0,0.2)]',
          'dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.2)]',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {children}
      </motion.div>
    )
  },
)

GlassPanel.displayName = 'GlassPanel'
