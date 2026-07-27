// ── Format Conversion Core Types ──

/** Supported format categories */
export enum FormatCategory {
  DOCUMENT = 'document',
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
  DATA = 'data',
  CODE = 'code',
  COLOR = 'color',
}

/** Format identifier e.g. "markdown", "png", "json" */
export type FormatId = string

/** Metadata describing a single format */
export interface FormatDescriptor {
  id: FormatId
  name: string
  category: FormatCategory
  extensions: string[]
  mimeTypes: string[]
  /** Human-readable description */
  description: string
  /** Preview capabilities */
  previewable: boolean
  /** Max file size in bytes (0 = unlimited) */
  maxSizeBytes: number
}

/** Direction of conversion */
export enum ConversionDirection {
  IMPORT = 'import',
  EXPORT = 'export',
}

/** Conversion engine type */
export enum EngineType {
  NATIVE = 'native',       // Rust native
  WASM = 'wasm',           // WebAssembly
  WORKER = 'worker',       // Web Worker
  EXTERNAL = 'external',   // External binary (FFmpeg, Pandoc)
  AI = 'ai',               // AI/ML model
}

/** Conversion pipeline stage */
export enum StageType {
  PREPROCESS = 'preprocess',
  PARSE = 'parse',
  TRANSFORM = 'transform',
  SERIALIZE = 'serialize',
  POSTPROCESS = 'postprocess',
}

/** A single conversion operation */
export interface ConversionRequest {
  id?: string
  sourceFormat: FormatId
  targetFormat: FormatId
  inputPath: string
  outputPath?: string
  options?: Record<string, unknown>
}

/** Overall status of a conversion */
export enum ConversionStatus {
  QUEUED = 'queued',
  PREPROCESSING = 'preprocessing',
  CONVERTING = 'converting',
  POSTPROCESSING = 'postprocessing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/** Progress update emitted during conversion */
export interface ConversionProgress {
  conversionId: string
  status: ConversionStatus
  progress: number // 0.0 – 1.0
  message?: string
  stage?: StageType
  error?: string
}

/** Result of a completed conversion */
export interface ConversionResult {
  success: boolean
  outputPath?: string
  error?: string
  durationMs: number
  originalSizeBytes?: number
  resultSizeBytes?: number
  qualityScore?: number // LPIPS-based perceptual quality (0-100)
}

/** Conversion plugin interface */
export interface ConversionPlugin {
  id: string
  name: string
  version: string
  sourceFormats: FormatId[]
  targetFormats: FormatId[]
  engine: EngineType

  /** Validate a conversion request before execution */
  validate?(request: ConversionRequest): string | null

  /** Execute the conversion */
  execute(
    request: ConversionRequest,
    onProgress: (progress: ConversionProgress) => void,
  ): Promise<ConversionResult>
}

/** Worker pool configuration */
export interface WorkerPoolConfig {
  maxWorkers: number
  workerTimeoutMs: number
}
