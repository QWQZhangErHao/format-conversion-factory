/**
 * DiffPreview — 格式转换前后对比视图
 *
 * 支持:
 * - 文本格式 (JSON/CSV/YAML/MD/HTML): 侧边语法高亮对比
 * - 图像格式 (PNG/JPEG/WebP): 滑块滑动擦除对比 (ImageWiper)
 */

import { motion, AnimatePresence } from 'framer-motion'
import { SPRING } from '../../../packages/ui-shared/src'
import { ImageWiper } from './ImageWiper'

interface DiffPreviewProps {
  /** 原始内容 */
  original: string
  /** 转换后内容 */
  converted: string
  /** 原始格式 */
  sourceFormat: string
  /** 目标格式 */
  targetFormat: string
  /** 是否可见 */
  visible: boolean
  /** 关闭回调 */
  onClose: () => void
}

/** 简易语法高亮 */
function highlightSyntax(code: string, format: string): string {
  let escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  switch (format) {
    case 'json':
      // 高亮 JSON key, string, number, boolean
      escaped = escaped
        .replace(/"([^"]+)":/g, '<span class="text-purple-600 dark:text-purple-400">"$1"</span>:')
        .replace(/"([^"]*?)"/g, '<span class="text-green-600 dark:text-green-400">"$1"</span>')
        .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="text-blue-600 dark:text-blue-400">$1</span>')
        .replace(/\b(true|false|null)\b/g, '<span class="text-orange-500 dark:text-orange-400">$1</span>')
      break
    case 'yaml':
      escaped = escaped
        .replace(/^([^:]+):/gm, '<span class="text-purple-600 dark:text-purple-400">$1</span>:')
        .replace(/#.*$/gm, '<span class="text-gray-400 italic">$&</span>')
      break
    case 'html':
      escaped = escaped
        .replace(/(&lt;\/?[\w-]+)/g, '<span class="text-blue-600 dark:text-blue-400">$1</span>')
        .replace(/(&gt;)/g, '<span class="text-blue-600 dark:text-blue-400">$1</span>')
        .replace(/"(.*?)"/g, '<span class="text-green-600 dark:text-green-400">"$1"</span>')
      break
    case 'markdown':
      escaped = escaped
        .replace(/^(#{1,6})\s/gm, '<span class="text-blue-600 dark:text-blue-400 font-bold">$&</span>')
        .replace(/(\*\*.*?\*\*)/g, '<span class="font-bold text-pink-600 dark:text-pink-400">$1</span>')
        .replace(/(\*.*?\*)/g, '<span class="italic text-pink-500">$1</span>')
        .replace(/(`[^`]+`)/g, '<span class="bg-gray-100 dark:bg-gray-800 text-red-500 rounded px-1">$1</span>')
      break
    case 'csv':
      escaped = escaped
        .replace(/^(.+)$/gm, (_, line: string) => {
          const cells = line.split(',')
          return cells.map((c, i) =>
            `<span class="${i === 0 ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-gray-700 dark:text-gray-300'}">${c}</span>`
          ).join('<span class="text-gray-400">,</span>')
        })
      break
    case 'toml':
      escaped = escaped
        .replace(/^\[(.+)\]$/gm, '<span class="text-blue-600 dark:text-blue-400 font-bold">[$1]</span>')
        .replace(/^([^=]+)=/gm, (_, key: string) =>
          `<span class="text-purple-600 dark:text-purple-400">${key}</span>=`
        )
      break
    case 'xml':
      escaped = escaped
        .replace(/(&lt;\/?[\w-]+)/g, '<span class="text-blue-600 dark:text-blue-400">$1</span>')
        .replace(/(&gt;)/g, '<span class="text-blue-600 dark:text-blue-400">$1</span>')
      break
  }

  return escaped
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
  }

  return (
    <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${colorMap[format] ?? 'bg-gray-100 text-gray-500'}`}>
      {format}
    </span>
  )
}

function CountBadge({ label, count }: { label: string; count: number }) {
  return (
    <span className="text-[11px] text-gray-400 dark:text-gray-500">
      {label}: <span className="font-mono text-gray-600 dark:text-gray-400">{count}</span>
    </span>
  )
}

export function DiffPreview({ original, converted, sourceFormat, targetFormat, visible, onClose }: DiffPreviewProps) {
  // 检测是否为图像格式 — 使用滑块对比
  const isImageFormat = ['png', 'jpeg', 'jpg', 'webp', 'svg', 'gif', 'ico'].includes(sourceFormat) ||
    ['png', 'jpeg', 'jpg', 'webp', 'svg', 'gif', 'ico'].includes(targetFormat)

  // 对于文本格式，计算行数差异
  const origLines = original.split('\n')
  const convLines = converted.split('\n')

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
          {isImageFormat ? (
            /* 图像格式 → 滑块对比 */
            <ImageWiper
              sourceUrl={original}
              targetUrl={converted}
              sourceLabel={sourceFormat.toUpperCase()}
              targetLabel={targetFormat.toUpperCase()}
            />
          ) : (
          <div className="mt-3 rounded-[14px] border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 backdrop-blur-[8px]">
            {/* 工具栏 */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-2">
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">对比视图</span>
                <CountBadge label="源文件" count={origLines.length} />
                <CountBadge label="转换后" count={convLines.length} />
                {origLines.length !== convLines.length && (
                  <span className={`text-[11px] font-medium ${origLines.length > convLines.length ? 'text-yellow-500' : 'text-green-500'}`}>
                    {origLines.length > convLines.length ? '−' : '+'}{Math.abs(origLines.length - convLines.length)} 行
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
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
                <pre className="overflow-auto p-4 text-[12px] leading-relaxed font-mono text-gray-700 dark:text-gray-300 max-h-[300px] scrollbar-thin whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: highlightSyntax(original, sourceFormat) }}
                />
              </div>

              {/* 转换后 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50/50 dark:bg-gray-800/30">
                  <div className="flex items-center gap-2">
                    <FormatBadge format={targetFormat} />
                    <span className="text-[11px] text-gray-400">转换结果</span>
                  </div>
                </div>
                <pre className="overflow-auto p-4 text-[12px] leading-relaxed font-mono text-gray-700 dark:text-gray-300 max-h-[300px] scrollbar-thin"
                  dangerouslySetInnerHTML={{ __html: highlightSyntax(converted, targetFormat) }}
                />
              </div>
            </div>
          </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
