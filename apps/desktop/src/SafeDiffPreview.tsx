/**
 * SafeDiffPreview — 纯 React 文本对比视图（零 XSS 风险）
 *
 * 替代旧版 DiffPreview 的 dangerouslySetInnerHTML 方案。
 * 逐行渲染为 React DOM 节点，完全避免 HTML 注入。
 */

import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SPRING } from '../../../packages/ui-shared/src'

interface SafeDiffPreviewProps {
  original: string
  converted: string
  sourceFormat: string
  targetFormat: string
  visible: boolean
  onClose: () => void
}

function FormatBadge({ format }: { format: string }) {
  const colorMap: Record<string, string> = {
    json: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    csv: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    yaml: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
    html: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    markdown: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    toml: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    xml: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    txt: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  }

  return (
    <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${colorMap[format] ?? 'bg-gray-100 text-gray-500'}`}>
      {format}
    </span>
  )
}

function CodeLine({ line, lineNum, highlight }: { line: string; lineNum: number; highlight?: boolean }) {
  return (
    <div className={`flex leading-relaxed ${highlight ? 'bg-green-50 dark:bg-green-900/10' : ''}`}>
      <span className="inline-block w-8 flex-shrink-0 text-right pr-2 text-[11px] text-gray-400 dark:text-gray-600 select-none font-mono">
        {lineNum}
      </span>
      <span className="flex-1 whitespace-pre-wrap break-all text-[12px] text-gray-700 dark:text-gray-300 font-mono">
        {line || ' '}
      </span>
    </div>
  )
}

export function SafeDiffPreview({ original, converted, sourceFormat, targetFormat, visible, onClose }: SafeDiffPreviewProps) {
  const origLines = useMemo(() => original.split('\n'), [original])
  const convLines = useMemo(() => converted.split('\n'), [converted])

  // 简单行数差异比较
  const maxLines = Math.max(origLines.length, convLines.length)
  const lineDiff = origLines.length - convLines.length

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={SPRING.GENTLE}
          className="overflow-hidden"
        >
          <div className="mt-3 rounded-[14px] border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 backdrop-blur-[8px] overflow-hidden">
            {/* 工具栏 */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-2">
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">对比视图</span>
                <span className="text-[11px] text-gray-400">
                  源 {origLines.length} 行 · 结果 {convLines.length} 行
                </span>
                {lineDiff !== 0 && (
                  <span className={`text-[11px] font-medium ${lineDiff > 0 ? 'text-yellow-500' : 'text-green-500'}`}>
                    {lineDiff > 0 ? '−' : '+'}{Math.abs(lineDiff)} 行
                  </span>
                )}
              </div>
              <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* 双栏对比 */}
            <div className="flex divide-x divide-gray-200 dark:divide-gray-700">
              {/* 源文件 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50/50 dark:bg-gray-800/30">
                  <div className="flex items-center gap-2">
                    <FormatBadge format={sourceFormat} />
                    <span className="text-[11px] text-gray-400">原始内容</span>
                  </div>
                </div>
                <div className="overflow-auto p-2 max-h-[300px] scrollbar-thin">
                  {origLines.map((line, i) => (
                    <CodeLine key={`o-${i}`} line={line} lineNum={i + 1} />
                  ))}
                </div>
              </div>

              {/* 转换后 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50/50 dark:bg-gray-800/30">
                  <div className="flex items-center gap-2">
                    <FormatBadge format={targetFormat} />
                    <span className="text-[11px] text-gray-400">转换结果</span>
                  </div>
                </div>
                <div className="overflow-auto p-2 max-h-[300px] scrollbar-thin">
                  {convLines.map((line, i) => (
                    <CodeLine key={`c-${i}`} line={line} lineNum={i + 1} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
