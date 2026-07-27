/**
 * AI Model Registry — metadata and download configuration for all models.
 *
 * Following the architecture optimization:
 * - LayoutLMv3-tiny (INT8 quantized, ~35MB)
 * - LPIPS (INT8 quantized, ~15MB)
 * - Models load on first use, not at startup
 */

import type { AIModelDescriptor, AIBackend } from '../types'

export interface ModelRegistryEntry {
  descriptor: AIModelDescriptor
  /** URL to download the quantized ONNX model */
  downloadUrl: string
  /** SHA256 hash for integrity verification */
  checksum: string
  /** Whether to auto-download on first use */
  lazyLoad: boolean
}

/**
 * Registry of all AI models used in the conversion pipeline.
 * Models are INT8 quantized and typically 15–50MB each.
 */
export const AI_MODELS: Record<string, ModelRegistryEntry> = {
  'layoutlmv3-tiny': {
    descriptor: {
      id: 'layoutlmv3-tiny',
      name: 'LayoutLMv3-Tiny (INT8)',
      version: '0.1.0',
      sizeMB: 35,
      backend: 'webgpu' as AIBackend,
      quantized: true,
      description: '文档版面理解模型 — 段落/标题/表格/列表识别',
    },
    downloadUrl: 'https://huggingface.co/Xenova/layoutlmv3-tiny-quantized/resolve/main/model_int8.onnx',
    checksum: 'sha256-pending',
    lazyLoad: true,
  },

  'lpips-alex': {
    descriptor: {
      id: 'lpips-alex',
      name: 'LPIPS (AlexNet) INT8',
      version: '0.1.0',
      sizeMB: 15,
      backend: 'webgpu' as AIBackend,
      quantized: true,
      description: '感知图像相似度 — 人类视觉对齐的质量评分',
    },
    downloadUrl: 'https://huggingface.co/Xenova/lpips-alex-quantized/resolve/main/model_int8.onnx',
    checksum: 'sha256-pending',
    lazyLoad: true,
  },
}

/** Get model info by ID */
export function getModelInfo(modelId: string): AIModelDescriptor | undefined {
  return AI_MODELS[modelId]?.descriptor
}

/** Get recommended backend for a model based on available hardware */
export function getRecommendedBackend(): AIBackend {
  // Check for WebGPU support
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    return 'webgpu'
  }
  // Fallback to WebGL
  if (typeof WebGLRenderingContext !== 'undefined') {
    return 'webgl'
  }
  return 'wasm'
}
