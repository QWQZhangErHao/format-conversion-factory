import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ONNXEngine } from './runtime'
import { getRecommendedBackend, AI_MODELS } from './models'

// Override the global mock from vitest-setup to avoid alias conflicts
vi.mock('onnxruntime-web', () => {
  class FakeTensor {
    data: Float32Array
    constructor(_type: string, data: Float32Array, _dims?: number[]) {
      this.data = data
    }
  }

  const mockCreate = vi.fn().mockResolvedValue({
    run: vi.fn().mockResolvedValue({
      output: new FakeTensor('float32', new Float32Array([0.95, 0.03, 0.02])),
    }),
  })

  return {
    InferenceSession: { create: mockCreate },
    Tensor: FakeTensor,
  }
})

describe('ONNXEngine', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('creates engine with default config', () => {
    const engine = new ONNXEngine()
    expect(engine).toBeInstanceOf(ONNXEngine)
  })

  it('detects ONNX availability via mock', async () => {
    const engine = new ONNXEngine()
    // onnxruntime-web is mocked, so checkONNX returns true
    const available = await engine.isAvailable()
    expect(available).toBe(true)
  })

  it('returns unloaded status for missing model', () => {
    const engine = new ONNXEngine()
    expect(engine.getStatus('nonexistent')).toBe('unloaded')
  })

  it('returns unloaded for model that was never loaded', () => {
    const engine = new ONNXEngine()
    expect(engine.getStatus('never-loaded')).toBe('unloaded')
  })

  it('loads model in mock mode', async () => {
    const engine = new ONNXEngine()
    const desc = AI_MODELS['layoutlmv3-tiny']!.descriptor
    await engine.loadModel('test-model', desc, new ArrayBuffer(8))
    expect(engine.getStatus('test-model')).toBe('ready')
  })

  it('runs mock inference and returns correct output shape', async () => {
    const engine = new ONNXEngine()
    const desc = AI_MODELS['layoutlmv3-tiny']!.descriptor
    await engine.loadModel('test-model', desc, new ArrayBuffer(8))
    const result = await engine.run(
      'test-model',
      { input: new Float32Array(4) },
      { input: [1, 4] },
    )
    expect(result.outputs.length).toBeGreaterThan(0)
    expect(result.outputs[0]).toBeInstanceOf(Float32Array)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('loadModel fails and sets status to error', async () => {
    const engine = new ONNXEngine()
    const { InferenceSession } = await import('onnxruntime-web')
    InferenceSession.create.mockRejectedValueOnce(new Error('Load failed'))
    const desc = AI_MODELS['layoutlmv3-tiny']!.descriptor
    await expect(engine.loadModel('fail-model', desc, new ArrayBuffer(8))).rejects.toThrow('Load failed')
    expect(engine.getStatus('fail-model')).toBe('error')
  })

  it('run on unloaded model throws error', async () => {
    const engine = new ONNXEngine()
    await expect(
      engine.run('nonexistent', { input: new Float32Array(4) }, { input: [1, 4] }),
    ).rejects.toThrow('not loaded')
  })

  it('unloadModel removes session', async () => {
    const engine = new ONNXEngine()
    const desc = AI_MODELS['layoutlmv3-tiny']!.descriptor
    await engine.loadModel('test-model', desc, new ArrayBuffer(8))
    expect(engine.getStatus('test-model')).toBe('ready')
    engine.unloadModel('test-model')
    expect(engine.getStatus('test-model')).toBe('unloaded')
  })

  it('unloadAll clears all sessions', async () => {
    const engine = new ONNXEngine()
    const desc = AI_MODELS['layoutlmv3-tiny']!.descriptor
    await engine.loadModel('model-a', desc, new ArrayBuffer(8))
    await engine.loadModel('model-b', desc, new ArrayBuffer(8))
    engine.unloadAll()
    expect(engine.getStatus('model-a')).toBe('unloaded')
    expect(engine.getStatus('model-b')).toBe('unloaded')
  })

  it('config override works', () => {
    const engine = new ONNXEngine({
      backend: 'wasm',
      intraOpThreads: 4,
      enableProfiling: true,
    })
    expect(engine).toBeInstanceOf(ONNXEngine)
  })
})

describe('Model Registry', () => {
  it('contains layoutlmv3 and lpips models', () => {
    expect(AI_MODELS['layoutlmv3-tiny']).toBeDefined()
    expect(AI_MODELS['lpips-alex']).toBeDefined()
  })

  it('models are INT8 quantized', () => {
    expect(AI_MODELS['layoutlmv3-tiny']!.descriptor.quantized).toBe(true)
    expect(AI_MODELS['lpips-alex']!.descriptor.quantized).toBe(true)
  })

  it('recommends a backend', () => {
    const backend = getRecommendedBackend()
    expect(['webgpu', 'webgl', 'wasm']).toContain(backend)
  })
})
