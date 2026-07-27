/**
 * LogViewer — 应用内日志查看器
 *
 * 可从设置面板打开，显示后端 tracing 日志 + 前端 console 日志。
 * 支持日志级别过滤、搜索、导出。
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SPRING } from '../../../packages/ui-shared/src'

// ── Frontend Log Capture ──

interface LogEntry {
  id: number
  timestamp: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  message: string
  source: 'backend' | 'frontend'
}

const MAX_LOGS = 500
const MAX_LOG_DEPTH = 3
let logId = 0
let logDepth = 0
const frontendLogs: LogEntry[] = []
let logListeners: Array<() => void> = []

function addLog(level: LogEntry['level'], message: string, source: LogEntry['source'] = 'frontend') {
  // 递归深度保护 — 防止 console.log 拦截引发无限递归
  if (logDepth > MAX_LOG_DEPTH) return
  logDepth++
  try {
    const entry: LogEntry = {
      id: ++logId,
      timestamp: new Date().toISOString().slice(11, 23),
      level,
      message,
      source,
    }
    frontendLogs.push(entry)
    if (frontendLogs.length > MAX_LOGS) frontendLogs.shift()
    // 安全遍历 — 使用快照避免迭代中 listener 变更
    const snapshot = logListeners.slice()
    snapshot.forEach((fn) => fn())
  } finally {
    logDepth--
  }
}

// Safe console bridge — 不覆盖全局 console，提供显式接桥
const originalConsoleLog = console.log.bind(console)
export function setupConsoleBridge(onLog: (level: string, msg: string) => void) {
  let isIntercepting = false
  console.log = (...args: unknown[]) => {
    originalConsoleLog(...args)
    if (isIntercepting) return
    isIntercepting = true
    try {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
      onLog('INFO', msg)
    } catch { /* ignore serialization errors */ }
    finally { isIntercepting = false }
  }
}

// ── Component ──

interface LogViewerProps {
  visible: boolean
  onClose: () => void
}

export function LogViewer({ visible, onClose }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<LogEntry['level'] | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [backendLogs, setBackendLogs] = useState<string[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)

  // Subscribe to new logs
  useEffect(() => {
    const update = () => {
      setLogs([...frontendLogs])
    }
    logListeners.push(update)
    update()
    return () => {
      logListeners = logListeners.filter((fn) => fn !== update)
    }
  }, [])

  // Fetch backend logs (链式 setTimeout 防重叠)
  useEffect(() => {
    if (!visible) return
    let timerId: ReturnType<typeof setTimeout>
    let cancelled = false

    const fetchLogs = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const result = await invoke('get_recent_logs', { n: 100 }) as string[]
        if (!cancelled) setBackendLogs(result)
      } catch {
        if (!cancelled) setBackendLogs(['(后端日志仅在 Tauri 桌面模式下可用)'])
      }
      if (!cancelled) timerId = setTimeout(fetchLogs, 5000)
    }
    fetchLogs()
    return () => { cancelled = true; clearTimeout(timerId) }
  }, [visible])

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const filteredLogs = logs.filter((l) => {
    if (filter !== 'ALL' && l.level !== filter) return false
    if (search && !l.message.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const levelColors: Record<string, string> = {
    ERROR: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
    WARN: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20',
    INFO: 'text-gray-700 dark:text-gray-300',
    DEBUG: 'text-gray-400 dark:text-gray-500',
  }

  const levelBadge: Record<string, string> = {
    ERROR: 'bg-red-500',
    WARN: 'bg-orange-500',
    INFO: 'bg-blue-500',
    DEBUG: 'bg-gray-400',
  }

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
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-2">
              <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">应用日志</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400">{logs.length} 条</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(logs.map(l => `[${l.timestamp}][${l.level}] ${l.message}`).join('\n')) }}
                  className="text-[11px] text-[#007AFF] hover:underline"
                >
                  导出
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-gray-800">
              {(['ALL', 'ERROR', 'WARN', 'INFO'] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setFilter(lvl)}
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                    filter === lvl
                      ? 'bg-[#007AFF] text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {lvl === 'ALL' ? '全部' : lvl}
                </button>
              ))}
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索日志..."
                className="ml-auto text-[11px] px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-transparent w-28 outline-none focus:border-[#007AFF]"
              />
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`text-[11px] px-2 py-1 rounded-md transition-colors ${autoScroll ? 'text-[#007AFF]' : 'text-gray-400'}`}
              >
                自动滚动
              </button>
            </div>

            {/* Log list (frontend) */}
            <div ref={listRef} className="overflow-y-auto max-h-[240px] font-mono text-[11px] leading-relaxed">
              {filteredLogs.length === 0 ? (
                <div className="p-4 text-center text-gray-400">暂无日志</div>
              ) : (
                filteredLogs.map((l) => (
                  <div key={l.id} className={`px-4 py-1 border-b border-gray-50 dark:border-gray-800/50 ${levelColors[l.level]}`}>
                    <span className="text-gray-400 mr-2">{l.timestamp}</span>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${levelBadge[l.level]}`} />
                    <span className="font-semibold mr-1.5">{l.level}</span>
                    <span>{l.message}</span>
                    {l.source === 'backend' && <span className="text-gray-400 ml-1">(后端)</span>}
                  </div>
                ))
              )}
            </div>

            {/* Backend logs toggle */}
            {backendLogs.length > 0 && (
              <details className="border-t border-gray-100 dark:border-gray-800">
                <summary className="px-4 py-1.5 text-[11px] text-gray-500 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                  后端日志 ({backendLogs.length} 行)
                </summary>
                <pre className="px-4 py-2 text-[10px] leading-relaxed max-h-[200px] overflow-y-auto text-gray-500 dark:text-gray-400">
                  {backendLogs.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </pre>
              </details>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Public logging API ──

export function logDebug(message: string) { addLog('DEBUG', message) }
export function logInfo(message: string) { addLog('INFO', message) }
export function logWarn(message: string) { addLog('WARN', message) }
export function logError(message: string) { addLog('ERROR', message) }
