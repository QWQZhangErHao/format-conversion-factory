/**
 * WebLLM Session Manager — manages local LLM inference sessions.
 *
 * Integration with WebLLM enables running Phi-3-mini or Qwen2.5-1.5B-Instruct
 * entirely on-device via WebGPU, enabling 100% private semantic conversion.
 *
 * Per architecture review:
 * - Uses WebLLM for browser/WebView-based LLM inference
 * - Models: Phi-3-mini (3.8B) or Qwen2.5-1.5B-Instruct (1.5B)
 * - GGUF format for efficient CPU/GPU inference
 * - 100% local — zero data leaves the device
 */

import type { ModelStatus } from '../types'

export interface LLMConfig {
  modelId: string
  maxTokens: number
  temperature: number
  topP: number
}

export interface LLMSessionInfo {
  modelId: string
  status: ModelStatus
  backend: string
  memoryUsageMB: number
}

const AVAILABLE_MODELS = {
  'phi-3-mini': {
    id: 'phi-3-mini',
    name: 'Phi-3-mini (3.8B)',
    sizeMB: 2400,
    contextLength: 4096,
  },
  'qwen2.5-1.5b': {
    id: 'qwen2.5-1.5b',
    name: 'Qwen2.5-1.5B-Instruct',
    sizeMB: 900,
    contextLength: 32768,
  },
} as const

export type LLMModelId = keyof typeof AVAILABLE_MODELS

/**
 * Manages a WebLLM inference session for semantic conversion tasks.
 *
 * ```ts
 * const session = new LLMSession({ modelId: 'qwen2.5-1.5b', maxTokens: 1024 })
 * await session.initialize()
 * const result = await session.generate('Convert JSON to CSV: {...}')
 * ```
 */
export class LLMSession {
  private config: LLMConfig
  private model: unknown = null
  private status: ModelStatus = 'unloaded'
  private webllmAvailable: boolean | null = null

  constructor(config?: Partial<LLMConfig>) {
    this.config = {
      modelId: 'qwen2.5-1.5b',
      maxTokens: 1024,
      temperature: 0.1,
      topP: 0.9,
      ...config,
    }
  }

  /** Check if WebLLM is available */
  async isAvailable(): Promise<boolean> {
    if (this.webllmAvailable !== null) return this.webllmAvailable
    try {
      // WebLLM dynamically imports from `@mlc-ai/web-llm`
      // @ts-ignore - @mlc-ai/web-llm is optional
      const webllm = await import('@mlc-ai/web-llm')
      this.webllmAvailable = !!webllm
      return this.webllmAvailable
    } catch {
      console.info('[WebLLM] Package not available, using mock fallback')
      this.webllmAvailable = false
      return false
    }
  }

  /** Initialize the LLM session — downloads model on first use */
  async initialize(onProgress?: (progress: number) => void): Promise<void> {
    if (this.status === 'ready') return

    this.status = 'loading'

    try {
      if (await this.isAvailable()) {
        // @ts-ignore - @mlc-ai/web-llm is optional, will be caught by try/catch
        const webllm = await import('@mlc-ai/web-llm')

        // Create MLCEngine for the selected model
        this.model = new webllm.MLCEngine({
          model: this.config.modelId,
          initProgressCallback: (progress: { progress: number }) => {
            onProgress?.(progress.progress)
          },
        })

        await (this.model as { reload(): Promise<void> }).reload()
        this.status = 'ready'
      } else {
        // Mock mode — no WebLLM available
        console.info('[WebLLM] Not available, using mock fallback')
        this.status = 'ready'
      }
    } catch (error) {
      this.status = 'error'
      console.error('[WebLLM] Failed to initialize:', error)
      throw error
    }
  }

  /** Generate text from a prompt */
  async generate(prompt: string): Promise<string> {
    if (this.status !== 'ready') {
      throw new Error('LLM session not initialized. Call initialize() first.')
    }

    if (!this.model) {
      return this.mockGenerate(prompt)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engine = this.model as any
    const response = await engine.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: '你是一个格式转换专家。严格按照用户要求的格式进行转换，确保数据的完整性和准确性。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: this.config.temperature,
      top_p: this.config.topP,
      max_tokens: this.config.maxTokens,
    })

    return response.choices[0]?.message?.content ?? ''
  }

  /** Mock generation for development/testing */
  private async mockGenerate(prompt: string): Promise<string> {
    await new Promise((r) => setTimeout(r, 200))
    return `[Mock LLM] Converted based on prompt: "${prompt.slice(0, 50)}..."`
  }

  /** Get session info */
  getInfo(): LLMSessionInfo {
    return {
      modelId: this.config.modelId,
      status: this.status,
      backend: this.model ? 'webgpu' : 'mock',
      memoryUsageMB: 0,
    }
  }

  /** Unload the model and free resources */
  async unload(): Promise<void> {
    this.model = null
    this.status = 'unloaded'
  }

  static getAvailableModels() {
    return AVAILABLE_MODELS
  }
}
