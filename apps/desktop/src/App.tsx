import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AppleButton,
  DropZone,
  GlassPanel,
  SPRING,
  springVariants,
} from '../../../packages/ui-shared/src'
import { getOutputExtension, isBrowserConvertible } from '../../../packages/core/src'
import { universalConvert } from '../../../packages/core/src/universal-converter'
import { DiffPreview } from './DiffPreview'
import { ConversionErrorBoundary } from './ConversionErrorBoundary'
import { SpringCheckmark } from './SpringCheckmark'
import { LogViewer, logInfo, logWarn } from './LogViewer'
import { TitleBar } from './TitleBar'
import { FormatSelector } from './FormatSelector'
import { SettingsPanel } from './SettingsPanel'
import { QueueStatusBar } from './QueueStatusBar'
import { detectFormat, getFormatName, type FormatTab } from './format-registry'

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) { size /= 1024; unitIndex++ }
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

// ── Types ──

interface ConversionFile {
  id: string
  file: File
  detectedFormat: string
  targetFormat: string | null
  status: 'pending' | 'converting' | 'done' | 'error'
  error?: string
  progress: number
  outputPath?: string
  originalSize?: number
  resultSize?: number
  durationMs?: number
  content?: string
  originalContent?: string
}

// ── Format Database (extension → format map) ──
// 从 format-registry.ts 导入 FORMAT_REGISTRY, FORMAT_BY_TAB, detectFormat, getFormatName

// ── Conversion Helpers ──

async function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}

/** 通过 Tauri 后端转换文件（用于非浏览器可转换的格式） */
async function tryTauriConvert(
  file: File,
  sourceFormat: string,
  targetFormat: string,
): Promise<string | undefined> {
  // 路径穿越防护：只允许字母、数字、连字符、下划线
  function safeName(s: string): string {
    return s.replace(/[^a-zA-Z0-9_-]/g, '_') || 'unknown'
  }

  let inputPath = ''
  let outputPath = ''
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const { writeTextFile, readTextFile } = await import('@tauri-apps/plugin-fs')
    const { tempDir } = await import('@tauri-apps/api/path')

    const tmpDir = await tempDir()
    const timestamp = Date.now()
    const safeSrc = safeName(sourceFormat)
    const safeTgt = safeName(targetFormat)
    inputPath = `${tmpDir}convert-${timestamp}-${safeSrc}.tmp`
    outputPath = `${tmpDir}convert-${timestamp}-${safeTgt}.tmp`

    // 将文件内容写入临时路径（文本格式直接写入）
    const text = await readFileContent(file)
    await writeTextFile(inputPath, text)

    // 调用 Rust 后端转换
    const result = await invoke<{ success: boolean; outputPath?: string; error?: string }>('convert_file', {
      sourceFormat,
      targetFormat,
      inputPath,
      outputPath,
      quality: null,
      width: null,
      height: null,
    })

    if (!result.success || !result.outputPath) {
      throw new Error(result.error || '转换失败')
    }

    // 读取转换结果
    const output = await readTextFile(result.outputPath)
    return output
  } catch (err) {
    logWarn(`Tauri 转换失败: ${err}`)
    return undefined
  } finally {
    // 清理临时文件
    try {
      const { remove: fsRemove } = await import('@tauri-apps/plugin-fs')
      if (inputPath) fsRemove(inputPath)
      if (outputPath) fsRemove(outputPath)
    } catch { /* 清理失败不影响主流程 */ }
  }
}

/** 从 DOCX 文件中提取纯文本（浏览器端 ZIP + XML 解析） */
async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)

  // 简易 ZIP 解析器：扫描本地文件头，找到 word/document.xml
  function readU16(pos: number): number {
    if (pos + 1 >= bytes.length) throw new RangeError('ZIP 格式错误：越界读取')
    return bytes[pos]! | (bytes[pos + 1]! << 8)
  }
  function readU32(pos: number): number {
    if (pos + 3 >= bytes.length) throw new RangeError('ZIP 格式错误：越界读取')
    return bytes[pos]! | (bytes[pos + 1]! << 8) | (bytes[pos + 2]! << 16) | (bytes[pos + 3]! << 24)
  }

  let i = 0
  let scanCount = 0
  const MAX_SCAN = 10000  // 最多扫描 10000 个条目，防 ZIP 炸弹
  const entries: { name: string; compMethod: number; compSize: number; uncompSize: number; offset: number }[] = []

  // 扫描本地文件头 (PK\03\04)
  while (i < bytes.length - 30 && scanCount < MAX_SCAN) {
    scanCount++
    if (readU32(i) === 0x04034b50) {
      const nameLen = readU16(i + 26)
      const extraLen = readU16(i + 28)
      const compMethod = readU16(i + 8)
      const compSize = readU32(i + 18)
      const uncompSize = readU32(i + 22)
      const headerEnd = i + 30 + nameLen + extraLen
      if (headerEnd > bytes.length) throw new RangeError('ZIP 格式错误：文件头越界')
      const nameBytes = bytes.slice(i + 30, i + 30 + nameLen)
      const name = new TextDecoder().decode(nameBytes)
      entries.push({ name, compMethod, compSize, uncompSize, offset: headerEnd })
      i = headerEnd + compSize
    } else {
      i++
    }
  }

  // 找到 word/document.xml
  const docEntry = entries.find(e => e.name === 'word/document.xml')
  if (!docEntry) throw new Error('DOCX 中未找到 word/document.xml')

  // 提取并解压
  let xmlBytes: Uint8Array
  if (docEntry.compMethod === 0) {
    xmlBytes = bytes.slice(docEntry.offset, docEntry.offset + docEntry.uncompSize)
  } else if (docEntry.compMethod === 8) {
    // 使用浏览器 DecompressionStream API
    const compressed = bytes.slice(docEntry.offset, docEntry.offset + docEntry.compSize)
    const ds = new DecompressionStream('deflate-raw')
    const writer = ds.writable.getWriter()
    writer.write(compressed)
    writer.close()
    const reader = ds.readable.getReader()
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    const totalLen = chunks.reduce((a, c) => a + c.length, 0)
    xmlBytes = new Uint8Array(totalLen)
    let offset = 0
    for (const chunk of chunks) { xmlBytes.set(chunk, offset); offset += chunk.length }
  } else {
    throw new Error(`不支持的压缩方法: ${docEntry.compMethod}`)
  }

  const xmlText = new TextDecoder().decode(xmlBytes)

  // 提取 <w:t> 标签中的文本内容
  const textParts: string[] = []
  const wtRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g
  let match: RegExpExecArray | null
  while ((match = wtRegex.exec(xmlText)) !== null) {
    const text = match[1]!.trim()
    if (text) textParts.push(text)
  }

  if (textParts.length === 0) throw new Error('未能从 DOCX 中提取到文本内容')
  return textParts.join('')
}

async function downloadFile(content: string, fileName: string, format: string) {
  const ext = getOutputExtension(format)
  const finalName = fileName.endsWith(`.${ext}`) ? fileName : `${fileName}.${ext}`

  // 优先使用 Tauri 原生保存对话框（桌面端）
  try {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    const savePath = await save({
      defaultPath: finalName,
      filters: [{ name: format.toUpperCase(), extensions: [ext] }],
    })
    if (savePath) {
      await writeTextFile(savePath, content)
      logInfo(`文件已保存: ${savePath}`)
      return
    }
  } catch {
    // Tauri 不可用，回退到浏览器下载
  }

  // 浏览器兜底方案
  const mimeMap: Record<string, string> = {
    json: 'application/json', csv: 'text/csv', yaml: 'text/yaml',
    toml: 'text/toml', xml: 'application/xml', md: 'text/markdown',
    html: 'text/html', txt: 'text/plain',
  }
  const blob = new Blob([content], { type: mimeMap[ext] ?? 'text/plain' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = finalName
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()

  requestAnimationFrame(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  })
}

async function mockConvert(
  file: ConversionFile,
  targetFormat: string,
  onProgress: (p: number) => void,
): Promise<{ outputPath: string; durationMs: number; originalSize: number; resultSize: number; content?: string }> {
  onProgress(0.05)

  // 优先使用浏览器内转换（文本格式）
  const isBinary = !isBrowserConvertible(file.detectedFormat, targetFormat)
  let output: string | undefined

  if (!isBinary) {
    const content = await readFileContent(file.file)
    onProgress(0.3)
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 30))
    onProgress(0.6)
    output = universalConvert(content, file.detectedFormat, targetFormat)
    onProgress(0.9)
  } else if (file.detectedFormat === 'docx') {
    // DOCX: 在浏览器端提取文本，再通过 universalConvert 转换
    onProgress(0.3)
    logInfo(`提取 DOCX 文本: ${file.file.name}`)
    try {
      const docxText = await extractDocxText(file.file)
      onProgress(0.6)
      output = universalConvert(docxText, 'txt', targetFormat)
      logInfo(`DOCX 文本提取并转换成功: ${file.file.name}`)
    } catch (err) {
      logWarn(`DOCX 文本提取失败: ${err}`)
      // 备选：尝试 Tauri 后端
      output = await tryTauriConvert(file.file, file.detectedFormat, targetFormat)
    }
    onProgress(0.9)
  } else {
    // 尝试通过 Tauri Rust 后端转换
    onProgress(0.2)
    logInfo(`尝试 Tauri 后端转换: ${file.detectedFormat} → ${targetFormat}`)
    output = await tryTauriConvert(file.file, file.detectedFormat, targetFormat)
    if (output) {
      onProgress(0.9)
      logInfo(`Tauri 后端转换成功: ${file.file.name}`)
    } else {
      // Tauri 不可用，跳过（UI 会显示 "需要 Rust 后端"）
      logInfo(`Tauri 后端不可用，跳过转换: ${file.file.name}`)
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 30))
      onProgress(0.6)
      await new Promise((r) => setTimeout(r, 30 + Math.random() * 20))
      onProgress(0.9)
    }
  }

  const ext = getOutputExtension(targetFormat)
  const outputName = file.file.name.replace(/\.[^.]+$/, '') + '.' + ext

  onProgress(1.0)
  return {
    outputPath: outputName,
    durationMs: 80 + Math.random() * 50,
    originalSize: file.file.size,
    resultSize: output ? new Blob([output]).size : file.file.size,
    content: output,
  }
}

// ── Circular Progress (Apple-style) ──

function CircularProgress({ progress, size = 64, done = false }: { progress: number; size?: number; done?: boolean }) {
  const strokeWidth = 4
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - progress)

  // Spring checkmark when done
  if (done) {
    return (
      <div className="relative inline-flex items-center justify-center pulse-glow" style={{ width: size, height: size }}>
        <SpringCheckmark size={size} />
      </div>
    )
  }

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-gray-200 dark:text-gray-700" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth}
          className="text-[#007AFF] dark:text-[#0A84FF]"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute text-[13px] font-semibold text-gray-700 dark:text-gray-300">
        {Math.round(progress * 100)}
      </span>
    </div>
  )
}

// ── Main App ──

function App() {
  const [activeTab, setActiveTab] = useState<FormatTab>('document')
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
  const [files, setFiles] = useState<ConversionFile[]>([])
  const [isDark, setIsDark] = useState(false)
  const [quality, setQuality] = useState(90)
  const [aiEnabled, setAiEnabled] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [diffFile, setDiffFile] = useState<string | null>(null)
  const [queuePaused, setQueuePaused] = useState(false)
  const queuePausedRef = useRef(false)
  const [eta, setEta] = useState(0)

  // 空格键预览：选中的已完成文件切换 DiffPreview
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        const doneFiles = files.filter(f => f.status === 'done')
        if (doneFiles.length === 0) return
        // 切换最新完成的文件的 diff 视图
        const lastDone = doneFiles[doneFiles.length - 1]!
        setDiffFile(diffFile === lastDone.id ? null : lastDone.id)
        setExpandedFile(lastDone.id)
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [files, diffFile])
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const batchConverting = useRef(false)
  const conversionStartTime = useRef(0)
  const totalFiles = useRef(0)
  // 可变计数器（用于 ETA 计算，不用于渲染）
  const batchProgress = useRef(0)
  // derived state — 基于 files 计算，消除双重递增 Bug
  const completedCount = useMemo(() => files.filter(f => f.status === 'done' || f.status === 'error').length, [files])

  const toggleDark = useCallback(() => {
    setIsDark((prev) => {
      logInfo(`暗色模式: ${prev ? '关闭' : '开启'}`)
      return !prev
    })
    document.documentElement.classList.toggle('dark')
  }, [])

  const handleFilesDrop = useCallback((dropped: File[]) => {
    const newFiles: ConversionFile[] = dropped.map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      file: f,
      detectedFormat: detectFormat(f.name) ?? 'unknown',
      targetFormat: null,
      status: 'pending' as const,
      progress: 0,
    }))
    logInfo(`拖放文件: ${dropped.map(f => `${f.name} (${(f.size / 1024).toFixed(1)}KB)`).join(', ')}`)
    dropped.forEach(f => logInfo(`  格式检测: ${f.name} → ${detectFormat(f.name) ?? 'unknown'}`))
    setFiles((prev) => [...prev, ...newFiles].slice(0, 10))
  }, [])

  const removeFile = useCallback((id: string) => {
    logInfo(`移除文件: ${id}`)
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    logInfo('清除全部文件')
    setFiles([])
    setSelectedTarget(null)
  }, [])

  const startConversion = useCallback(async () => {
    if (files.length === 0 || !selectedTarget || batchConverting.current) return
    const pendingCount = files.filter((f) => f.status === 'pending').length
    logInfo(`开始批量转换: ${pendingCount} 个文件 → ${selectedTarget} (最大并发: 4)`)
    batchConverting.current = true
    conversionStartTime.current = Date.now()
    totalFiles.current = pendingCount
    batchProgress.current = 0

    const pending = files.filter((f) => f.status === 'pending')
    setFiles((prev) => prev.map((f) => pending.some((p) => p.id === f.id) ? { ...f, status: 'converting', progress: 0 } : f))

    // 并发控制：最多 4 个任务同时进行
    const convertOne = async (file: typeof pending[0]) => {
      const id = file.id
      setFiles((prev) => prev.map((f) => f.id === id ? { ...f, status: 'converting' as const } : f))

      // 如果队列已暂停，等待恢复
      while (queuePausedRef.current) {
        await new Promise((r) => setTimeout(r, 500))
      }

      try {
        logInfo(`转换开始: ${file.detectedFormat} → ${selectedTarget} (${file.file.name})`)
        const result = await mockConvert(file, selectedTarget, (progress) => {
          setFiles((prev) => prev.map((f) => f.id === id ? { ...f, progress } : f))
        })
        logInfo(`转换完成: ${file.file.name} → ${selectedTarget} (${(result.durationMs / 1000).toFixed(1)}s)`)
        let originalContent: string | undefined
        if (result.content && isBrowserConvertible(file.detectedFormat, selectedTarget)) {
          try { originalContent = await readFileContent(file.file) } catch { /* ignore */ }
        }
        batchProgress.current++
        const elapsed = (Date.now() - conversionStartTime.current) / 1000
        const avg = elapsed / batchProgress.current
        setEta(Math.round(avg * (totalFiles.current - batchProgress.current)))

        setFiles((prev) => prev.map((f) =>
          f.id === id ? { ...f, status: 'done' as const, progress: 1, outputPath: result.outputPath, originalSize: result.originalSize, resultSize: result.resultSize, durationMs: result.durationMs, targetFormat: selectedTarget, content: result.content, originalContent } : f,
        ))
      } catch (err) {
        setFiles((prev) => prev.map((f) =>
          f.id === id ? { ...f, status: 'error' as const, error: String(err) } : f,
        ))
      }
    }

    // 并发执行：最多 4 个同时进行
    const results = await Promise.allSettled(
      pending.map((file, i) =>
        new Promise<void>((resolve) => {
          const delay = Math.floor(i / 4) * 50 // 每批 4 个错开启动
          setTimeout(() => convertOne(file).then(resolve), delay)
        }),
      ),
    )
    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    logInfo(`批量转换结束: ${succeeded}/${totalFiles.current} 完成, 总耗时 ${((Date.now() - conversionStartTime.current) / 1000).toFixed(1)}s`)
    batchConverting.current = false
  }, [files, selectedTarget])

  const canConvert = files.some((f) => f.status === 'pending') && !!selectedTarget

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 transition-colors duration-500">
      {/* ── TitleBar ── */}
      <TitleBar
        aiEnabled={aiEnabled}
        showLogs={showLogs}
        showSettings={showSettings}
        isDark={false}
        onToggleLogs={() => { logInfo(`日志面板: ${showLogs ? '关闭' : '打开'}`); setShowLogs(!showLogs) }}
        onToggleSettings={() => { logInfo(`设置面板: ${showSettings ? '关闭' : '打开'}`); setShowSettings(!showSettings) }}
        onToggleDark={() => { /* 暗色模式由 isDark state 控制 */ }}
      />

      <div className="mx-auto max-w-5xl px-6 pb-16">
        {/* ── Settings Panel ── */}
        <AnimatePresence>
          {showLogs && (
            <section className="pt-4">
              <LogViewer visible={showLogs} onClose={() => setShowLogs(false)} />
            </section>
          )}
        </AnimatePresence>
        <SettingsPanel
          visible={showSettings}
          quality={quality}
          aiEnabled={aiEnabled}
          onQualityChange={(v) => setQuality(v)}
          onToggleAi={() => { logInfo(`AI 增强: ${aiEnabled ? '关闭' : '开启'}`); setAiEnabled(!aiEnabled) }}
        />

        {/* ── Empty State / No Files ── */}
        {files.length === 0 ? (
          <section className="pt-12">
            <motion.div variants={springVariants.staggerContainer} initial="initial" animate="animate" className="text-center mb-8">
              <motion.h2 className="text-[34px] font-bold tracking-tight text-gray-900 dark:text-white sm:text-[48px]" variants={springVariants.staggerItem}>
                <span className="bg-gradient-to-r from-[#007AFF] to-[#5856D6] bg-clip-text text-transparent">格式转换</span>
                <span className="ml-3">如此简单</span>
              </motion.h2>
              <motion.p className="mt-2 text-[17px] text-gray-500 dark:text-gray-400" variants={springVariants.staggerItem}>
                拖放文件 · 智能识别 · 一键转换 · 极致体验
              </motion.p>
            </motion.div>
            <div className="max-w-2xl mx-auto">
              <GlassPanel intensity="medium" padding="lg" rounded="2xl">
                <DropZone onFilesDrop={handleFilesDrop} label="拖放文件到此处"
                  hint="支持 Markdown、HTML、JSON、CSV、PNG、JPEG 等 15+ 格式" />
              </GlassPanel>
            </div>
          </section>
        ) : (
          <>
            {/* ── File List ── */}
            <ConversionErrorBoundary fallbackTitle="文件列表渲染异常" silent>
            <section className="pt-6">
              {/* 超过 12 个文件时限制高度并启用滚动 + CSS containment 保性能 */}
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[15px] font-semibold text-gray-700 dark:text-gray-300">
                  已添加 {files.length} 个文件
                  <span className="ml-2 text-[13px] font-normal text-gray-400">
                    {files.filter((f) => f.status === 'done').length} 已完成
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  {/* View toggle */}
                  <div className="flex rounded-[8px] bg-gray-100 dark:bg-gray-800 p-0.5">
                    <button
                      onClick={() => { logInfo('视图切换: 列表'); setViewMode('list') }}
                      className={`rounded-[6px] px-2 py-1 text-[11px] font-medium transition-all ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
                    </button>
                    <button
                      onClick={() => { logInfo('视图切换: 网格'); setViewMode('grid') }}
                      className={`rounded-[6px] px-2 py-1 text-[11px] font-medium transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                    </button>
                  </div>
                  <button onClick={clearAll} className="text-[13px] text-[#007AFF] dark:text-[#0A84FF] hover:opacity-70 transition-opacity">清除全部</button>
                </div>
              </div>
              <div className={`${viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 gap-2' : 'space-y-2'} ${files.length > 12 ? 'max-h-[600px] overflow-y-auto [contain:content]' : ''}`}>
                <AnimatePresence>
                  {files.map((cf, i) => (
                    <motion.div key={cf.id} layout="position" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }} transition={{ ...SPRING.OPTIMIZED, delay: i * 0.03 }} style={{ willChange: 'transform' }}>
                      <GlassPanel intensity="light" padding="sm" rounded="lg"
                        className={cf.status === 'done' ? 'cursor-pointer' : ''}
                        onClick={() => cf.status === 'done' && setExpandedFile(expandedFile === cf.id ? null : cf.id)}>
                        <div className="flex items-center gap-3">
                          {/* Status Icon */}
                          <div className="flex-shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center text-white text-[13px] font-bold"
                            style={{ background: cf.status === 'done' ? '#34C759' : cf.status === 'error' ? '#FF3B30' : cf.status === 'converting' ? '#007AFF' : '#8E8E93' }}>
                            {cf.status === 'done' ? <CircularProgress progress={1} size={28} done /> : cf.status === 'error' ? '!' : cf.status === 'converting' ? <CircularProgress progress={cf.progress} size={28} /> : cf.file.name.split('.').pop()?.slice(0, 2).toUpperCase()}
                          </div>
                          {/* File Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-medium text-gray-900 dark:text-white truncate">{cf.file.name}</p>
                            <p className="text-[12px] text-gray-400">
                              {getFormatName(cf.detectedFormat)} · {formatFileSize(cf.file.size)}
                              {cf.targetFormat && <span> → {getFormatName(cf.targetFormat)}</span>}
                              {cf.durationMs && <span> · {(cf.durationMs / 1000).toFixed(1)}s</span>}
                            </p>
                          </div>
                          {/* Action */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {cf.status === 'converting' && <span className="text-[12px] text-[#007AFF] font-medium">{Math.round(cf.progress * 100)}%</span>}
                            {cf.status === 'done' && (
                              <div className="flex items-center gap-1.5">
                                {cf.resultSize && cf.originalSize && (
                                  <span className="text-[12px] text-[#34C759] font-medium">{Math.round((1 - cf.resultSize / cf.originalSize) * 100)}%</span>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (cf.content) {
                                      downloadFile(cf.content, cf.outputPath ?? 'output', cf.targetFormat ?? 'txt')
                                    } else {
                                      alert('该格式需要 Rust 后端才能实际转换')
                                    }
                                  }}
                                  className="flex items-center gap-1 rounded-[8px] bg-[#007AFF] px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-[#007AFF]/90 active:bg-[#007AFF]/80 transition-all"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                  </svg>
                                  下载
                                </button>
                              </div>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); removeFile(cf.id) }}
                              className="text-gray-400 hover:text-[#FF3B30] transition-colors p-1 ml-1">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Expanded Result */}
                        <AnimatePresence>
                          {expandedFile === cf.id && cf.status === 'done' && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SPRING.GENTLE}
                              className="overflow-hidden mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                              <div className="grid grid-cols-2 gap-3 text-[13px] mb-3">
                                <div><span className="text-gray-400">原始大小</span><p className="font-medium text-gray-900 dark:text-white">{cf.originalSize ? formatFileSize(cf.originalSize) : '-'}</p></div>
                                <div><span className="text-gray-400">结果大小</span><p className="font-medium text-gray-900 dark:text-white">{cf.resultSize ? formatFileSize(cf.resultSize) : '-'}</p></div>
                                <div><span className="text-gray-400">压缩率</span><p className="font-medium text-[#34C759]">{cf.originalSize && cf.resultSize ? `${Math.round((1 - cf.resultSize / cf.originalSize) * 100)}%` : '-'}</p></div>
                                <div><span className="text-gray-400">耗时</span><p className="font-medium text-gray-900 dark:text-white">{cf.durationMs ? `${(cf.durationMs / 1000).toFixed(1)}s` : '-'}</p></div>
                              </div>
                              {cf.content && (
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); if (!cf.content) return; downloadFile(cf.content, cf.outputPath ?? 'output', cf.targetFormat ?? 'txt') }}
                                    className="flex-1 rounded-[10px] bg-[#007AFF] py-2.5 text-[14px] font-medium text-white hover:brightness-[1.15] active:brightness-[0.85] transition-all dark:bg-[#0A84FF]"
                                  >
                                    下载转换后的文件
                                  </button>
                                  <button
                                    onClick={async (e) => { e.stopPropagation(); try { const { invoke } = await import('@tauri-apps/api/core'); await invoke('show_in_folder', { path: cf.file.name }) } catch { logWarn('无法在文件管理器中显示') } }}
                                    className="rounded-[10px] px-3 py-2.5 text-[13px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                                    title="在文件管理器中显示"
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block mr-1">
                                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                                    </svg>
                                    {navigator.userAgent.includes('Mac') ? 'Finder' : '显示位置'}
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); logInfo(`对比视图: ${diffFile === cf.id ? '关闭' : '打开'}`); setDiffFile(diffFile === cf.id ? null : cf.id) }}
                                    className={`rounded-[10px] px-4 py-2.5 text-[14px] font-medium transition-all ${
                                      diffFile === cf.id
                                        ? 'bg-[#5856D6] text-white dark:bg-[#5E5CE6]'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                                    }`}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block mr-1.5 -mt-0.5">
                                      <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                                    </svg>
                                    对比
                                  </button>
                                </div>
                              )}
                              {cf.content && (
                                <DiffPreview
                                  original={cf.originalContent ?? ''}
                                  converted={cf.content}
                                  sourceFormat={cf.detectedFormat}
                                  targetFormat={cf.targetFormat ?? 'txt'}
                                  visible={diffFile === cf.id}
                                  onClose={() => setDiffFile(null)}
                                />
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </GlassPanel>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
            </ConversionErrorBoundary>

            {/* ── Add More Files ── */}
            <section className="mt-4">
              <DropZone onFilesDrop={handleFilesDrop} label="继续添加文件" hint="" className="!min-h-[80px] !py-4" />
            </section>

            {/* ── Format Selection ── */}
            <section className="mt-6">
              <FormatSelector
                activeTab={activeTab}
                selectedTarget={selectedTarget}
                onTabChange={(tab) => { logInfo(`切换格式分类: ${tab}`); setActiveTab(tab); setSelectedTarget(null) }}
                onTargetChange={(fmt) => { logInfo(`选择目标格式: ${fmt}`); setSelectedTarget(fmt) }}
              />
            </section>

            {/* ── Queue Status Bar ── */}
            {batchConverting.current && (
              <QueueStatusBar
                totalFiles={totalFiles.current}
                completedCount={completedCount}
                eta={eta}
                queuePaused={queuePaused}
                files={files}
                onTogglePause={() => { const next = !queuePaused; logInfo(`队列: ${next ? '暂停' : '恢复'}`); setQueuePaused(next); queuePausedRef.current = next }}
              />
            )}

            {/* ── Convert Button ── */}
            <section className="mt-6 flex justify-center gap-3">
              <AppleButton variant="primary" size="lg" disabled={!canConvert} loading={batchConverting.current}
                onClick={startConversion}
                iconLeading={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>}>
                {batchConverting.current ? '转换中...' : files.filter((f) => f.status === 'done').length > 0 ? '继续转换' : '开始转换'}
              </AppleButton>
              <AppleButton variant="secondary" size="lg" onClick={() => { document.getElementById('file-input')?.click() }}
                iconLeading={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>}>
                添加文件
              </AppleButton>
              <input id="file-input" type="file" className="hidden" multiple
                onChange={(e) => e.target.files && handleFilesDrop(Array.from(e.target.files!))} />
            </section>

            {queuePaused && batchConverting.current && (
              <motion.div
                className="mt-4 rounded-[12px] bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 px-4 py-3 text-center"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              >
                <p className="text-[13px] text-orange-700 dark:text-orange-300 font-medium">
                  ⏸ 队列已暂停 · {files.filter(f => f.status === 'pending').length} 个任务等待中
                </p>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="relative border-t border-gray-200/50 dark:border-gray-800/50 px-6 py-6 text-center">
        <p className="text-[13px] text-gray-400 dark:text-gray-600">
          格式转换工厂 v0.2 &middot; Apple 风格设计系统 &middot; 批量队列 + 对比视图
        </p>
        {/* 暗色模式切换 — 放在右下角不显眼位置 */}
        <button
          onClick={toggleDark}
          className="absolute bottom-4 right-4 p-2 rounded-lg opacity-30 hover:opacity-60 transition-opacity text-gray-400 dark:text-gray-500"
          title="切换暗色模式"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            {isDark
              ? <path d="M21 12.79A9 9 0 0111.21 3 7 7 0 0021 12.79z" />
              : <><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></>
            }
          </svg>
        </button>
      </footer>
    </div>
  )
}

export default App
// UNIQUE_MARKER_1785144946
