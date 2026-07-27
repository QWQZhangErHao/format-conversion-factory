/**
 * ═══════════════════════════════════════════════════════════════
 * Auto-generated type definitions
 * Source: Rust backend types (engine/types.rs)
 * Generator: types_export.rs (cargo test)
 *
 * Last generated: 2026-07-27
 * ═══════════════════════════════════════════════════════════════
 */

export interface FormatDescriptor {
  id: string
  name: string
  category: 'document' | 'image' | 'data' | 'audio' | 'video' | 'code' | 'color'
  extensions: string[]
  mime_types: string[]
  description: string
  previewable: boolean
}

export interface ConversionResult {
  success: boolean
  conversion_id: string
  output_path: string | null
  error: string | null
  duration_ms: number
  original_size_bytes: number | null
  result_size_bytes: number | null
}

export interface ConversionProgress {
  conversion_id: string
  status: 'queued' | 'preprocessing' | 'converting' | 'postprocessing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  message: string
  stage: 'preprocess' | 'parse' | 'transform' | 'serialize' | 'postprocess' | null
}

export interface QueueStats {
  max_workers: number
  active_jobs: number
  pending_jobs: number
  paused_jobs: number
  completed_jobs: number
  globally_paused: boolean
  estimated_remaining_secs: number
}

export interface ConversionOptions {
  quality: number | null
  width: number | null
  height: number | null
  preserve_metadata: boolean | null
  page_range: string | null
}
