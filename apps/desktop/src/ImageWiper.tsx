/**
 * ImageWiper — 图像转换前后滑动擦除对比
 *
 * Apple Photos 风格：中间分割线左右滑动对比画质差异。
 * - 底层：转换后图像 (Converted)
 * - 顶层：原始图像 (Source)，clipPath 裁剪
 * - 滑块：蓝环白柄，支持鼠标拖拽 + 触摸滑动
 */

import { useState, useRef, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { SPRING } from '../../../packages/ui-shared/src'

interface ImageWiperProps {
  sourceUrl: string
  targetUrl: string
  sourceLabel?: string
  targetLabel?: string
  className?: string
  children?: ReactNode
}

export function ImageWiper({
  sourceUrl,
  targetUrl,
  sourceLabel = 'Original',
  targetLabel = 'Converted',
  className = '',
}: ImageWiperProps) {
  const [sliderPos, setSliderPos] = useState(50)
  const [sourceError, setSourceError] = useState(false)
  const [targetError, setTargetError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    setSliderPos((x / rect.width) * 100)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.GENTLE}
      className={`mt-3 overflow-hidden rounded-[14px] border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 backdrop-blur-[8px] ${className}`}
    >
      <div
        ref={containerRef}
        className="relative w-full h-72 rounded-[14px] overflow-hidden select-none cursor-ew-resize bg-black/5 dark:bg-white/5"
        onMouseMove={(e) => e.buttons === 1 && handleMove(e.clientX)}
        onTouchMove={(e) => handleMove(e.touches[0]!.clientX)}
        style={{ touchAction: 'none' }}
      >
        {/* 底层：目标图像 (Converted) */}
        {targetError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-[11px] text-red-500 font-mono">⚠️ 无法加载图片</div>
        ) : (
          <img src={targetUrl} alt={targetLabel} onError={() => setTargetError(true)} className="absolute inset-0 w-full h-full object-contain" draggable={false} />
        )}
        <span className="absolute bottom-3 right-3 text-[11px] font-mono px-2.5 py-1 rounded-md bg-black/60 text-white/90 backdrop-blur-[4px]">
          {targetLabel}
        </span>

        {/* 顶层：原始图像 (Source)，clipPath 裁剪 */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        >
          {sourceError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-[11px] text-red-500 font-mono">⚠️ 无法加载原始图片</div>
          ) : (
            <img src={sourceUrl} alt={sourceLabel} onError={() => setSourceError(true)} className="absolute inset-0 w-full h-full object-contain" draggable={false} />
          )}
          <span className="absolute bottom-3 left-3 text-[11px] font-mono px-2.5 py-1 rounded-md bg-black/60 text-white/90 backdrop-blur-[4px]">
            {sourceLabel}
          </span>
        </div>

        {/* 中间擦除分割线 */}
        <div
          className="absolute top-0 bottom-0 w-[3px] bg-white shadow-[0_0_12px_rgba(0,0,0,0.4)] z-10 pointer-events-none"
          style={{ left: `${sliderPos}%` }}
        >
          {/* 滑块手柄 */}
          <motion.div
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.95 }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white dark:bg-gray-900 border-[2.5px] border-[#007AFF] shadow-lg flex items-center justify-center"
          >
            <div className="flex gap-[3px] items-center">
              <div className="w-[3px] h-3 bg-gray-400 rounded-full" />
              <div className="w-[3px] h-3 bg-gray-400 rounded-full" />
            </div>
          </motion.div>
        </div>

        {/* 底部格式指示条 */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3.5 py-1.5 text-[11px] text-white/70 backdrop-blur-[4px] flex items-center gap-3">
          <span className="font-medium text-white/90">{sourceLabel}</span>
          <span className="text-white/40">│</span>
          <span>{targetLabel}</span>
        </div>
      </div>
    </motion.div>
  )
}
