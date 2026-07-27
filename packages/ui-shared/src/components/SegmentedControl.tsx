import React from 'react'
import { motion, LayoutGroup } from 'framer-motion'
import { SPRING, RADIUS } from '../styles/tokens'

export interface SegmentedOption {
  value: string
  label: string
  icon?: React.ReactNode
}

export interface SegmentedControlProps {
  /** Available options */
  options: SegmentedOption[]
  /** Currently selected value */
  value: string
  /** Change handler */
  onChange: (value: string) => void
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Full width */
  fullWidth?: boolean
}

const sizeMap = {
  sm: { padding: 'p-0.5', text: 'text-[12px]', item: 'px-2.5 py-1', gap: 'gap-0.5', icon: 'w-3.5 h-3.5' },
  md: { padding: 'p-0.5', text: 'text-[13px]', item: 'px-3.5 py-1.5', gap: 'gap-1', icon: 'w-4 h-4' },
  lg: { padding: 'p-0.5', text: 'text-[15px]', item: 'px-5 py-2', gap: 'gap-1.5', icon: 'w-4.5 h-4.5' },
} as const

/**
 * SegmentedControl — Apple's iconic segmented toggle.
 * Features spring-animated highlight pill.
 *
 * ```tsx
 * <SegmentedControl
 *   options={[
 *     { value: 'docs', label: '文档' },
 *     { value: 'images', label: '图片' },
 *   ]}
 *   value={selected}
 *   onChange={setSelected}
 * />
 * ```
 */
export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = false,
}) => {
  const s = sizeMap[size]

  return (
    <div
      className={[
        'relative flex bg-gray-100 dark:bg-gray-800',
        'rounded-[10px]',
        s.padding,
        s.gap,
        fullWidth ? 'w-full' : 'inline-flex',
      ].join(' ')}
    >
      <LayoutGroup id="segmented-control">
        {options.map((option) => {
          const isActive = value === option.value
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={[
                'relative z-10 flex items-center justify-center font-medium transition-colors',
                s.text,
                s.item,
                s.gap,
                fullWidth && 'flex-1',
                'rounded-[8px]',
                isActive ? 'text-white dark:text-gray-900' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white',
              ].join(' ')}
            >
              {isActive && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 bg-[#007AFF] dark:bg-white rounded-[8px]"
                  transition={SPRING.SNAPPY}
                  style={{ zIndex: -1 }}
                />
              )}
              {option.icon && <span className={s.icon}>{option.icon}</span>}
              <span>{option.label}</span>
            </button>
          )
        })}
      </LayoutGroup>
    </div>
  )
}

SegmentedControl.displayName = 'SegmentedControl'
