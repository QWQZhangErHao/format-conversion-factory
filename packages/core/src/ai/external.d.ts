// Type declarations for optional external AI packages.
// These are imported dynamically and may not be installed.

declare module 'onnxruntime-web' {
  export class InferenceSession {
    static create(
      modelData: ArrayBuffer,
      options?: { executionProviders?: string[]; intraOpNumThreads?: number; enableProfiling?: boolean; graphOptimizationLevel?: string },
    ): Promise<InferenceSession>
    run(feeds: Record<string, unknown>): Promise<Record<string, unknown>>
  }

  export class Tensor {
    constructor(type: string, data: Float32Array, dims?: number[])
    data: Float32Array
  }
}

declare module '@mlc-ai/web-llm' {
  export class MLCEngine {
    constructor(config: { model: string; initProgressCallback?: (progress: { progress: number }) => void })
    reload(): Promise<void>
    chat: {
      completions: {
        create(params: {
          messages: Array<{ role: string; content: string }>
          temperature?: number
          top_p?: number
          max_tokens?: number
        }): Promise<{ choices: Array<{ message: { content: string } }> }>
      }
    }
  }
}
