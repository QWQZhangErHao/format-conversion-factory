/**
 * Frontend Conversion Service — wraps Tauri IPC commands.
 *
 * Architecture:
 * - Production: Calls Tauri Rust backend via @tauri-apps/api invoke()
 * - Development: Uses MockService when Tauri is unavailable
 * - Web mode: Falls back to pure JS conversion in Web Workers
 */

import type { ConversionProgress, ConversionResult } from './types'
import { ConversionStatus } from './types'

// ── Tauri IPC Layer ──

let tauriAvailable: boolean | null = null
let tauriPromise: Promise<boolean> | null = null

async function checkTauri(): Promise<boolean> {
  if (tauriAvailable !== null) return tauriAvailable
  if (tauriPromise) return tauriPromise
  tauriPromise = (async () => {
    try {
      // @ts-ignore - @tauri-apps/api is optional, may not be installed in all environments
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('greet', { name: 'test' })
      tauriAvailable = true
    } catch {
      tauriAvailable = false
    }
    return tauriAvailable
  })()
  return tauriPromise
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tauriInvoke(cmd: string, args?: Record<string, unknown>): Promise<any> {
  // @ts-ignore - @tauri-apps/api is optional
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke(cmd, args)
}

// ── Events ──

type ProgressCallback = (progress: ConversionProgress) => void

/**
 * Start a file conversion through the Tauri backend.
 * Falls back to MockService in dev/web mode.
 */
export async function startConversion(
  sourceFormat: string,
  targetFormat: string,
  inputPath: string,
  outputPath?: string,
  options?: { quality?: number; width?: number; height?: number },
  onProgress?: ProgressCallback,
): Promise<ConversionResult> {
  const useTauri = await checkTauri()

  if (useTauri) {
    return tauriConversion(sourceFormat, targetFormat, inputPath, outputPath, options, onProgress)
  }

  return mockConversion(sourceFormat, targetFormat, inputPath, outputPath, options, onProgress)
}

async function tauriConversion(
  sourceFormat: string,
  targetFormat: string,
  inputPath: string,
  outputPath?: string,
  options?: { quality?: number; width?: number; height?: number },
  onProgress?: ProgressCallback,
): Promise<ConversionResult> {
  // @ts-ignore - @tauri-apps/api is optional
  const { listen } = await import('@tauri-apps/api/event')

  // Listen for progress events
  if (onProgress) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unlisten = await listen('conversion-progress', (event: any) => {
      onProgress(event.payload)
      if (event.payload.status === ConversionStatus.COMPLETED || event.payload.status === ConversionStatus.FAILED) {
        unlisten()
      }
    })
  }

  return tauriInvoke('convert_file', {
    sourceFormat,
    targetFormat,
    inputPath,
    outputPath: outputPath ?? null,
    quality: options?.quality ?? null,
    width: options?.width ?? null,
    height: options?.height ?? null,
  })
}

// ── Mock Service (Dev Fallback) ──

async function mockConversion(
  sourceFormat: string,
  targetFormat: string,
  inputPath: string,
  outputPath?: string,
  _options?: { quality?: number; width?: number; height?: number },
  onProgress?: ProgressCallback,
): Promise<ConversionResult> {
  const totalSteps = 5
  const startTime = performance.now()

  const emit = (status: ConversionStatus, progress: number, message: string) => {
    onProgress?.({
      conversionId: 'mock-' + Date.now(),
      status,
      progress,
      message,
    })
  }

  emit(ConversionStatus.PREPROCESSING, 0, '准备输入文件...')
  await sleep(300)

  emit(ConversionStatus.CONVERTING, 0.2, `解析 ${sourceFormat}...`)
  await sleep(400)

  emit(ConversionStatus.CONVERTING, 0.5, `转换为 ${targetFormat}...`)
  await sleep(500)

  emit(ConversionStatus.POSTPROCESSING, 0.9, '完成处理...')
  await sleep(200)

  const output = outputPath ?? inputPath.replace(/\.\w+$/, `.${targetFormat}`)
  emit(ConversionStatus.COMPLETED, 1.0, '转换完成')

  return {
    success: true,
    outputPath: output,
    durationMs: performance.now() - startTime,
    originalSizeBytes: 1024 * 50,
    resultSizeBytes: 1024 * 30,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Format Discovery ──

export interface FormatInfo {
  id: string
  name: string
  category: string
  extensions: string[]
  mimeTypes: string[]
  description: string
  previewable: boolean
}

/**
 * Fetch all supported formats from the backend
 */
export async function getSupportedFormats(): Promise<FormatInfo[]> {
  const useTauri = await checkTauri()
  if (useTauri) {
    return tauriInvoke('get_supported_formats')
  }
  // Mock response
  return [
    { id: 'markdown', name: 'Markdown', category: 'document', extensions: ['.md'], mimeTypes: ['text/markdown'], description: 'Markdown 文档格式', previewable: true },
    { id: 'html', name: 'HTML', category: 'document', extensions: ['.html'], mimeTypes: ['text/html'], description: '超文本标记语言', previewable: true },
    { id: 'json', name: 'JSON', category: 'data', extensions: ['.json'], mimeTypes: ['application/json'], description: 'JSON 数据格式', previewable: true },
    { id: 'csv', name: 'CSV', category: 'data', extensions: ['.csv'], mimeTypes: ['text/csv'], description: 'CSV 数据格式', previewable: true },
    { id: 'yaml', name: 'YAML', category: 'data', extensions: ['.yaml'], mimeTypes: ['text/yaml'], description: 'YAML 数据格式', previewable: true },
    { id: 'png', name: 'PNG', category: 'image', extensions: ['.png'], mimeTypes: ['image/png'], description: 'PNG 图像', previewable: true },
    { id: 'jpeg', name: 'JPEG', category: 'image', extensions: ['.jpg', '.jpeg'], mimeTypes: ['image/jpeg'], description: 'JPEG 图像', previewable: true },
    { id: 'webp', name: 'WebP', category: 'image', extensions: ['.webp'], mimeTypes: ['image/webp'], description: 'WebP 图像', previewable: true },
  ]
}

/**
 * Get worker pool statistics from the backend
 */
export async function getWorkerStats(): Promise<{
  maxWorkers: number
  activeJobs: number
  pendingJobs: number
  pausedJobs: number
  completedJobs: number
  globallyPaused: boolean
  estimatedRemainingSecs: number
}> {
  const useTauri = await checkTauri()
  if (useTauri) {
    return tauriInvoke('get_worker_stats')
  }
  return { maxWorkers: 4, activeJobs: 0, pendingJobs: 0, pausedJobs: 0, completedJobs: 0, globallyPaused: false, estimatedRemainingSecs: 0 }
}

// ── Queue Control ──

export interface QueueStats {
  maxWorkers: number
  activeJobs: number
  pendingJobs: number
  pausedJobs: number
  completedJobs: number
  globallyPaused: boolean
  estimatedRemainingSecs: number
}

/** Toggle global pause/resume */
export async function toggleQueuePause(): Promise<boolean> {
  const useTauri = await checkTauri()
  if (useTauri) {
    const paused = await tauriInvoke('pause_queue')
    return paused as boolean
  }
  return false
}

/** Resume the global queue */
export async function resumeQueue(): Promise<boolean> {
  const useTauri = await checkTauri()
  if (useTauri) {
    return tauriInvoke('resume_queue')
  }
  return true
}

/** Pause a specific task */
export async function pauseTask(taskId: string): Promise<boolean> {
  const useTauri = await checkTauri()
  if (useTauri) {
    return tauriInvoke('pause_task', { taskId })
  }
  return false
}

/** Resume a specific task */
export async function resumeTask(taskId: string): Promise<boolean> {
  const useTauri = await checkTauri()
  if (useTauri) {
    return tauriInvoke('resume_task', { taskId })
  }
  return false
}

/** Cancel a specific task */
export async function cancelTask(taskId: string): Promise<boolean> {
  const useTauri = await checkTauri()
  if (useTauri) {
    return tauriInvoke('cancel_task', { taskId })
  }
  return false
}

// ── 0-Copy Binary Transfer ──

/**
 * Read a file as raw bytes via Tauri IPC (0-copy binary transfer).
 * Uses tauri::ipc::Response on the Rust side to avoid JSON serialization.
 * Returns an ArrayBuffer that can be used directly without parsing.
 */
export async function readFileBytes(path: string): Promise<ArrayBuffer> {
  const useTauri = await checkTauri()
  if (useTauri) {
    // @ts-ignore - @tauri-apps/api is optional, may not be installed
    const { invoke } = await import('@tauri-apps/api/core')
    // Tauri v2 ipc::Response returns raw bytes that become ArrayBuffer
    return invoke('read_file_bytes', { path }) as Promise<ArrayBuffer>
  }
  // Fallback: fetch via HTTP for web mode
  const response = await fetch(path)
  return response.arrayBuffer()
}

// ── AI-Friendly Read (Any Format → Markdown) ──

export interface AIReadResult {
  content: string
  format: string
  fileSize: number
  fileName: string
}

/**
 * AI 友好接口：读取任意支持的文件并自动转换为 Markdown 格式。
 *
 * 适用场景：
 * - AI 助手需要读取用户文件进行分析
 * - 自动将 JSON/CSV/YAML/HTML/图片 转为 AI 可读的文本
 * - 减少 AI 解析二进制格式的成本
 *
 * @param path 文件路径
 * @returns Markdown 格式的文件内容
 *
 * @example
 * ```ts
 * const { content } = await aiReadAsMarkdown('/path/to/data.json')
 * // content = "```json\n{\"name\": \"Alice\"}\n```"
 * ```
 */
export async function aiReadAsMarkdown(path: string): Promise<AIReadResult> {
  const useTauri = await checkTauri()
  if (useTauri) {
    const content = await tauriInvoke('read_as_markdown', { path }) as string
    return {
      content,
      format: 'markdown',
      fileSize: content.length,
      fileName: path.split('/').pop() ?? path.split('\\').pop() ?? path,
    }
  }

  // Web fallback: use browser converter for supported types
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const textExts = ['json', 'csv', 'yaml', 'yml', 'toml', 'xml', 'md', 'html', 'txt']
  if (textExts.includes(ext)) {
    try {
      const response = await fetch(path)
      const text = await response.text()
      return { content: text, format: ext, fileSize: text.length, fileName: path }
    } catch {
      // fall through
    }
  }

  return {
    content: `无法自动读取文件: ${path}\n格式 .${ext} 在 Web 模式下不受支持。`,
    format: 'text',
    fileSize: 0,
    fileName: path,
  }
}
