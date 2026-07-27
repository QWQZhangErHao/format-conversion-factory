/**
 * Global vitest setup for @convert/core package.
 *
 * Provides:
 * - ONNX Runtime Web global mocks (InferenceSession, Tensor)
 * - WebLLM global mocks (MLCEngine)
 *
 * Service tests manage their own Tauri mocks via vi.hoisted() + vi.mock().
 */

// ── ONNX Runtime Web Mock ──

vi.mock('onnxruntime-web', () => {
  class FakeTensor {
    data: Float32Array
    constructor(_type: string, data: Float32Array, _dims?: number[]) {
      this.data = data
    }
  }

  const InferenceSession = {
    create: vi.fn().mockResolvedValue({
      run: vi.fn().mockResolvedValue({
        output: new FakeTensor('float32', new Float32Array([0.95, 0.03, 0.02])),
      }),
    }),
  }

  return { InferenceSession, Tensor: FakeTensor }
})

// ── WebLLM Mock ──

vi.mock('@mlc-ai/web-llm', () => {
  class MLCEngine {
    private _config: Record<string, unknown>
    constructor(config: Record<string, unknown>) {
      this._config = config
    }
    async reload() { /* no-op */ }
    chat = {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: '[Mock WebLLM] This is a test response.' } }],
        }),
      },
    }
  }
  return { MLCEngine }
})

// ── Suppress expected console noise ──

const originalWarn = console.warn
console.warn = (...args: unknown[]) => {
  const msg = typeof args[0] === 'string' ? args[0] : ''
  if (msg.includes('[Registry]') || msg.includes('[WebLLM]') || msg.includes('[ONNX]') || msg.includes('[Layout]')) {
    return
  }
  originalWarn.call(console, ...args)
}
