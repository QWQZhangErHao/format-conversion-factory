/**
 * ONNX Runtime Web — model inference engine wrapper.
 *
 * Architecture:
 * - Production: Uses ONNX Runtime Web with WebGPU/WebGL backend
 * - Development: Mock inference for testing
 *
 * Key design decisions per architecture review:
 * - Models are quantized to INT8 (20MB–50MB per model)
 * - WebGPU is preferred backend, falls back to WebGL → WASM
 * - Inference runs async, non-blocking to the main thread
 */

import type { AIBackend, AIModelDescriptor, ModelStatus } from '../types'

/** Configuration for ONNX Runtime session */
export interface ONNXConfig {
  backend: AIBackend
  executionProviders: AIBackend[]
  intraOpThreads: number
  enableProfiling: boolean
}

/** Generic inference result */
export interface InferenceResult {
  outputs: Float32Array[]
  durationMs: number
}

let onnxAvailable: boolean | null = null

async function checkONNX(): Promise<boolean> {
  if (onnxAvailable !== null) return onnxAvailable
  try {
    // Dynamic import to avoid bundle bloat when not used
    // @ts-ignore - onnxruntime-web is optional
    const ort = await import('onnxruntime-web')
    onnxAvailable = !!ort
  } catch {
    onnxAvailable = false
  }
  return onnxAvailable
}

/**
 * ONNX Runtime engine — manages model sessions and inference.
 *
 * ```ts
 * const engine = new ONNXEngine({ backend: 'webgpu' })
 * await engine.loadModel('layoutlmv3-tiny', modelData)
 * const result = await engine.run('layoutlmv3-tiny', inputTensor)
 * ```
 */
export class ONNXEngine {
  private sessions = new Map<string, {
    session: unknown  // InferenceSession
    descriptor: AIModelDescriptor
    status: ModelStatus
  }>()
  private config: ONNXConfig

  constructor(config?: Partial<ONNXConfig>) {
    this.config = {
      backend: 'webgpu',
      executionProviders: ['webgpu', 'webgl', 'wasm'],
      intraOpThreads: 1,
      enableProfiling: false,
      ...config,
    }
  }

  /** Check if ONNX Runtime is available in this environment */
  async isAvailable(): Promise<boolean> {
    return checkONNX()
  }

  /**
   * Load a quantized ONNX model into a session.
   * Models should be INT8 quantized (20MB–50MB) per our architecture.
   */
  async loadModel(
    modelId: string,
    descriptor: AIModelDescriptor,
    modelData: ArrayBuffer,
  ): Promise<void> {
    const useONNX = await checkONNX()

    if (!useONNX) {
      // Mock mode — store metadata only
      this.sessions.set(modelId, {
        session: null,
        descriptor,
        status: 'ready',
      })
      return
    }

    // @ts-ignore - onnxruntime-web is optional
    const ort = await import('onnxruntime-web')

    try {
      const session = await ort.InferenceSession.create(modelData, {
        executionProviders: this.config.executionProviders,
        intraOpNumThreads: this.config.intraOpThreads,
        enableProfiling: this.config.enableProfiling,
        // INT8 optimization
        graphOptimizationLevel: 'all',
      })

      this.sessions.set(modelId, {
        session,
        descriptor,
        status: 'ready',
      })
    } catch (error) {
      this.sessions.set(modelId, {
        session: null,
        descriptor,
        status: 'error',
      })
      console.error(`[ONNX] Failed to load model "${modelId}":`, error)
      throw error
    }
  }

  /** Get model loading status */
  getStatus(modelId: string): ModelStatus {
    return this.sessions.get(modelId)?.status ?? 'unloaded'
  }

  /** Run inference on a loaded model */
  async run(
    modelId: string,
    inputTensors: Record<string, Float32Array>,
    inputDims: Record<string, number[]>,
  ): Promise<InferenceResult> {
    const entry = this.sessions.get(modelId)
    if (!entry || entry.status !== 'ready') {
      throw new Error(`Model "${modelId}" is not loaded. Status: ${entry?.status ?? 'unloaded'}`)
    }

    const useONNX = await checkONNX()

    if (!useONNX || !entry.session) {
      return this.mockInference(inputTensors)
    }

    // @ts-ignore - onnxruntime-web is optional
    const ort = await import('onnxruntime-web')
    const startTime = performance.now()

    // Create tensor objects
    const feeds: Record<string, unknown> = {}
    for (const [name, data] of Object.entries(inputTensors)) {
      const dims = inputDims[name] ?? [1, data.length]
      feeds[name] = new ort.Tensor('float32', data, dims)
    }

    // Run inference
    const results = await (entry.session as { run: (feeds: Record<string, unknown>) => Promise<Record<string, unknown>> }).run(feeds)

    const durationMs = performance.now() - startTime

    // Extract output tensors
    const outputs: Float32Array[] = []
    for (const [, value] of Object.entries(results)) {
      if (value instanceof Float32Array) {
        outputs.push(value)
      } else if (value && typeof (value as { data: Float32Array }).data === 'object') {
        outputs.push((value as { data: Float32Array }).data)
      }
    }

    return { outputs, durationMs }
  }

  /** Unload a model to free memory */
  unloadModel(modelId: string): void {
    this.sessions.delete(modelId)
  }

  /** Unload all models */
  unloadAll(): void {
    this.sessions.clear()
  }

  /** Mock inference for development/testing */
  private mockInference(_inputTensors: Record<string, Float32Array>): InferenceResult {
    const mockDuration = 50 + Math.random() * 100
    return {
      outputs: [new Float32Array([0.95, 0.03, 0.02])],
      durationMs: mockDuration,
    }
  }
}
