import React from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { SPRING } from '../styles/tokens'

export interface AppleButtonProps extends HTMLMotionProps<'button'> {
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost'
  /** Size */
  size?: 'sm' | 'md' | 'lg'
  /** Full width */
  fullWidth?: boolean
  /** Loading state */
  loading?: boolean
  /** Leading icon */
  iconLeading?: React.ReactNode
  /** Trailing icon */
  iconTrailing?: React.ReactNode
  children?: React.ReactNode
}

const variantStyles = {
  primary: {
    base: 'bg-[#007AFF] text-white shadow-sm',
    hover: 'brightness-[1.15]',
    active: 'brightness-[0.85]',
    dark: 'dark:bg-[#0A84FF] dark:text-white',
  },
  secondary: {
    base: 'bg-gray-100 text-gray-900',
    hover: 'bg-gray-200',
    active: 'bg-gray-300',
    dark: 'dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 dark:active:bg-gray-600',
  },
  tertiary: {
    base: 'bg-white/80 text-gray-900 shadow-[0_0_0_1px_rgba(0,0,0,0.06)_inset]',
    hover: 'bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.1)_inset]',
    active: 'bg-gray-100 shadow-[0_0_0_1px_rgba(0,0,0,0.1)_inset]',
    dark: 'dark:bg-gray-800/80 dark:text-white dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset]',
  },
  ghost: {
    base: 'bg-transparent text-[#007AFF]',
    hover: 'bg-[#007AFF]/10',
    active: 'bg-[#007AFF]/20',
    dark: 'dark:text-[#0A84FF] dark:hover:bg-[#0A84FF]/10 dark:active:bg-[#0A84FF]/20',
  },
} as const

const sizeStyles = {
  sm: { padding: 'px-3.5 py-1.5', text: 'text-[13px]', gap: 'gap-1.5', icon: 'w-4 h-4' },
  md: { padding: 'px-5 py-2.5', text: 'text-[15px]', gap: 'gap-2', icon: 'w-5 h-5' },
  lg: { padding: 'px-6 py-3', text: 'text-[17px]', gap: 'gap-2.5', icon: 'w-5 h-5' },
} as const

/**
 * AppleButton — iOS-style button with spring press feedback.
 *
 * ```tsx
 * <AppleButton variant="primary" size="md">转换</AppleButton>
 * <AppleButton variant="ghost" iconLeading={<Icon />}>取消</AppleButton>
 * ```
 */
export const AppleButton = React.forwardRef<HTMLButtonElement, AppleButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      iconLeading,
      iconTrailing,
      children,
      className = '',
      ...props
    },
    ref,
  ) => {
    const s = sizeStyles[size]
    const v = variantStyles[variant]

    return (
      <motion.button
        ref={ref}
        type="button"
        disabled={loading}
        className={[
          'relative inline-flex items-center justify-center font-medium select-none',
          'transition-colors duration-150',
          s.padding,
          s.text,
          s.gap,
          'rounded-[10px]',
          fullWidth && 'w-full',
          v.base,
          v.dark,
          loading && 'opacity-60 pointer-events-none',
          className,
        ].join(' ')}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        transition={SPRING.SNAPPY}
        {...props}
      >
        {loading ? (
          <svg className={[s.icon, 'animate-spin'].join(' ')} viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          <>
            {iconLeading && <span className={s.icon}>{iconLeading}</span>}
            {children && <span>{children}</span>}
            {iconTrailing && <span className={s.icon}>{iconTrailing}</span>}
          </>
        )}
      </motion.button>
    )
  },
)

AppleButton.displayName = 'AppleButton'
