import React, { useState, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SPRING } from '../styles/tokens'

export interface DropZoneProps {
  /** Called when files are dropped */
  onFilesDrop: (files: File[]) => void
  /** Accepted MIME types */
  accept?: string
  /** Label shown in the zone */
  label?: string
  /** Hint text below label */
  hint?: string
  /** Whether multiple files are allowed */
  multiple?: boolean
  /** Currently dragging over */
  disabled?: boolean
  /** Icon to display (default: upload icon) */
  icon?: ReactNode
  /** Extra className */
  className?: string
}

/**
 * DropZone — Apple-style drag-and-drop target with magnetic snap animation.
 * Uses spring physics for the entry/exit and active state transitions.
 *
 * ```tsx
 * <DropZone
 *   onFilesDrop={(files) => console.log(files)}
 *   accept=".md,.html,.pdf"
 *   label="拖放文件到此处"
 *   hint="支持 Markdown, HTML, PDF"
 * />
 * ```
 */
export const DropZone: React.FC<DropZoneProps> = ({
  onFilesDrop,
  accept,
  label = '拖放文件到此处',
  hint = '或点击选择文件',
  multiple = true,
  disabled = false,
  icon,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDragging(true)
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      if (disabled) return

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        onFilesDrop(files)
      }
    },
    [disabled, onFilesDrop],
  )

  const handleClick = useCallback(() => {
    if (disabled) return
    const input = document.createElement('input')
    input.type = 'file'
    if (accept) input.accept = accept
    input.multiple = multiple
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files ?? [])
      if (files.length > 0) onFilesDrop(files)
    }
    input.click()
  }, [accept, multiple, onFilesDrop, disabled])

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={disabled}
      className={[
        'relative flex w-full cursor-pointer flex-col items-center justify-center',
        'select-none outline-none transition-colors duration-200',
        'rounded-[28px]',
        isDragging
          ? 'border-[#007AFF] bg-[#007AFF]/5 dark:border-[#0A84FF] dark:bg-[#0A84FF]/10'
          : 'border-2 border-dashed border-gray-300 dark:border-gray-700',
        isHovered && !isDragging && 'border-gray-400 bg-gray-50/50 dark:border-gray-600 dark:bg-gray-900/30',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      ].join(' ')}
      whileHover={!disabled ? { scale: 1.01 } : undefined}
      whileTap={!disabled ? { scale: 0.99 } : undefined}
      transition={SPRING.MAGNETIC}
      style={{ minHeight: 200 }}
    >
      <AnimatePresence>
        {isDragging && (
          <motion.div
            className="absolute inset-0 rounded-[28px] border-2 border-[#007AFF]/30 dark:border-[#0A84FF]/30"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={SPRING.MAGNETIC}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="flex flex-col items-center gap-3"
        animate={isDragging ? { y: -6, scale: 1.02 } : { y: 0, scale: 1 }}
        transition={SPRING.MAGNETIC}
      >
        {/* Upload icon with magnetic spring */}
        <motion.div
          className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
          animate={
            isDragging
              ? { scale: 1.15, backgroundColor: 'rgba(0,122,255,0.15)', rotate: [0, -3, 3, 0] }
              : { scale: 1, backgroundColor: 'rgba(0,0,0,0.05)', rotate: 0 }
          }
          transition={isDragging ? { type: 'spring', stiffness: 300, damping: 8 } : SPRING.SNAPPY}
        >
          {icon ?? (
            <motion.svg
              width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
              className="text-gray-500 dark:text-gray-400"
              animate={isDragging ? { y: [0, -2, 0], transition: { repeat: Infinity, duration: 1 } } : { y: 0 }}
            >
              <path d="M12 16V4" strokeLinecap="round" />
              <path d="M8 8L12 4L16 8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V16" strokeLinecap="round" />
            </motion.svg>
          )}
        </motion.div>

        {/* Label */}
        <span
          className={`text-[15px] font-medium transition-colors ${
            isDragging ? 'text-[#007AFF] dark:text-[#0A84FF]' : 'text-gray-700 dark:text-gray-300'
          }`}
        >
          {label}
        </span>

        {/* Hint */}
        {hint && (
          <span className="text-[13px] text-gray-400 dark:text-gray-500">{hint}</span>
        )}
      </motion.div>

      {/* Magnetic ring pulse when dragging */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            className="absolute inset-[-8px] rounded-[32px] border-2 border-[#007AFF]/10 dark:border-[#0A84FF]/10"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1.02 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ ...SPRING.MAGNETIC, repeat: Infinity, repeatType: 'reverse', duration: 1.5 }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  )
}

DropZone.displayName = 'DropZone'
