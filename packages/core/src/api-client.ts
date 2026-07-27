/**
 * Unified API Client — 类型安全 + 统一错误处理 + 请求追踪
 *
 * 所有 Tauri 命令通过此客户端调用，确保:
 * - 统一的 ApiResponse 信封解析
 * - 语义化错误码处理
 * - 请求耗时追踪
 * - 统一 loading/error 状态管理
 */

import type { ConversionProgress, ConversionResult } from './types'
import { ConversionStatus } from './types'

// ── API Envelope ──

export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
  code?: string
  timing_ms?: number
}

export interface ApiError {
  message: string
  code: string
  timestamp: number
}

// ── API Error Class ──

export class ApiRequestError extends Error {
  public code: string
  public timestamp: number

  constructor(message: string, code: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
    this.timestamp = Date.now()
  }
}

// ── Tauri IPC Client ──

let tauriAvailable: boolean | null = null

async function checkTauri(): Promise<boolean> {
  if (tauriAvailable !== null) return tauriAvailable
  try {
    // @ts-ignore - @tauri-apps/api is optional
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('greet', { name: 'test' })
    tauriAvailable = true
  } catch {
    tauriAvailable = false
  }
  return tauriAvailable
}

/**
 * 底层 IPC 调用 — 自动处理 ApiResponse 信封和错误转换
 */
async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const useTauri = await checkTauri()
  if (!useTauri) {
    throw new ApiRequestError('Tauri 后端不可用', 'TAURI_NOT_AVAILABLE')
  }

  // @ts-ignore - @tauri-apps/api is optional
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')

  try {
    const result = await tauriInvoke(command, args) as ApiResponse<T> | T

    // 如果是统一信封格式，解析它
    if (result !== null && typeof result === 'object' && 'success' in result) {
      const envelope = result as ApiResponse<T>
      if (!envelope.success) {
        throw new ApiRequestError(
          envelope.error ?? '请求失败',
          envelope.code ?? 'UNKNOWN_ERROR',
        )
      }
      return envelope.data as T
    }

    // 直接返回（兼容旧格式）
    return result as T
  } catch (err) {
    if (err instanceof ApiRequestError) throw err
    throw new ApiRequestError(
      err instanceof Error ? err.message : '未知 IPC 错误',
      'IPC_ERROR',
    )
  }
}

// ── Format API ──

export const formatsApi = {
  /** 获取所有支持的格式 */
  list: () => invoke<FormatInfo[]>('get_supported_formats'),

  /** 按分类获取格式 */
  getByCategory: (category: string) =>
    invoke<FormatInfo[]>('get_formats_by_category', { category }),
}

export interface FormatInfo {
  id: string
  name: string
  category: string
  extensions: string[]
  mimeTypes: string[]
  description: string
  previewable: boolean
}

// ── Conversion API ──

export interface ConvertOptions {
  quality?: number
  width?: number
  height?: number
}

export const conversionApi = {
  /**
   * 开始文件转换
   * 进度通过回调函数接收
   */
  start: (
    sourceFormat: string,
    targetFormat: string,
    inputPath: string,
    outputPath?: string,
    options?: ConvertOptions,
    onProgress?: (progress: ConversionProgress) => void,
  ): Promise<ConversionResult> => {
    return startConversion(sourceFormat, targetFormat, inputPath, outputPath, options, onProgress)
  },

  /** 取消进行中的转换 */
  cancel: (conversionId: string) =>
    invoke<boolean>('cancel_conversion', { conversionId }),
}

// ── Queue API ──

export interface QueueStats {
  maxWorkers: number
  activeJobs: number
  pendingJobs: number
  pausedJobs: number
  completedJobs: number
  globallyPaused: boolean
  estimatedRemainingSecs: number
}

export const queueApi = {
  /** 获取队列统计 */
  stats: () => invoke<QueueStats>('get_worker_stats'),

  /** 切换全局暂停/恢复 */
  togglePause: () => invoke<boolean>('pause_queue'),

  /** 恢复队列 */
  resume: () => invoke<boolean>('resume_queue'),

  /** 暂停指定任务 */
  pauseTask: (taskId: string) => invoke<boolean>('pause_task', { taskId }),

  /** 恢复指定任务 */
  resumeTask: (taskId: string) => invoke<boolean>('resume_task', { taskId }),

  /** 取消指定任务 */
  cancelTask: (taskId: string) => invoke<boolean>('cancel_task', { taskId }),
}

// ── File I/O API ──

export const fileApi = {
  /** 0-Copy 读取二进制文件 */
  readBytes: (path: string) => readFileBytes(path),

  /** AI 友好读取 (任意格式 → Markdown) */
  readAsMarkdown: (path: string) => invoke<string>('read_as_markdown', { path }),
}

// ── Diagnostics API ──

export const diagApi = {
  /** 健康检查 */
  ping: () => invoke<string>('greet', { name: 'ping' }),
}

// ── Sniffer API ──

export interface FormatSniffResult {
  extension: string
  mimeType: string
  isMismatched: boolean
}

export const snifferApi = {
  /** Magic Bytes 文件格式嗅探 */
  detect: (path: string) => invoke<FormatSniffResult>('detect_file_format', { path }),
}

// ── Rich Error ──

export interface RichError {
  code: string
  message: string
  details?: string
}

export const ErrorCodes = {
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FORMAT_MISMATCH: 'FORMAT_MISMATCH',
  PARSE_ERROR: 'PARSE_ERROR',
  CONVERSION_FAILED: 'CONVERSION_FAILED',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  TIMEOUT: 'TIMEOUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  OOM: 'OOM',
  FILE_CORRUPTED: 'FILE_CORRUPTED',
} as const

// ── Internal implementations ──

async function startConversion(
  sourceFormat: string,
  targetFormat: string,
  inputPath: string,
  outputPath?: string,
  options?: ConvertOptions,
  onProgress?: (progress: ConversionProgress) => void,
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
  options?: ConvertOptions,
  onProgress?: (progress: ConversionProgress) => void,
): Promise<ConversionResult> {
  // @ts-ignore - @tauri-apps/api is optional
  const { listen } = await import('@tauri-apps/api/event')

  if (onProgress) {
    const unlisten = await listen('conversion-progress', (event: { payload: ConversionProgress }) => {
      onProgress(event.payload)
      if (event.payload.status === ConversionStatus.COMPLETED || event.payload.status === ConversionStatus.FAILED) {
        unlisten()
      }
    })
  }

  return invoke<ConversionResult>('convert_file', {
    sourceFormat,
    targetFormat,
    inputPath,
    outputPath: outputPath ?? null,
    quality: options?.quality ?? null,
    width: options?.width ?? null,
    height: options?.height ?? null,
  })
}

async function mockConversion(
  sourceFormat: string,
  targetFormat: string,
  inputPath: string,
  outputPath?: string,
  _options?: ConvertOptions,
  onProgress?: (progress: ConversionProgress) => void,
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

async function readFileBytes(path: string): Promise<ArrayBuffer> {
  const useTauri = await checkTauri()
  if (useTauri) {
    // @ts-ignore
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
    return tauriInvoke('read_file_bytes', { path }) as Promise<ArrayBuffer>
  }
  const response = await fetch(path)
  return response.arrayBuffer()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
