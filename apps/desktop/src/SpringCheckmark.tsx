/**
 * SpringCheckmark — Apple 风格 Spring 勾选动画
 *
 * 转换完成时，进度环变为绿色勾选，带有弹性入场效果。
 * 使用 Framer Motion pathLength 动画 + Apple Spring 曲线。
 */

import { motion } from 'framer-motion'

interface SpringCheckmarkProps {
  /** 尺寸 (默认 28) */
  size?: number
}

export function SpringCheckmark({ size = 28 }: SpringCheckmarkProps) {
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="relative flex items-center justify-center rounded-full bg-[#34C759] text-white shadow-sm"
      style={{ width: size, height: size }}
    >
      <svg className="w-1/2 h-1/2" viewBox="0 0 12 10" fill="none">
        <motion.path
          d="M1.5 5L4.5 8L10.5 1.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.35, ease: [0.175, 0.885, 0.32, 1.275] }}
        />
      </svg>
    </motion.div>
  )
}
