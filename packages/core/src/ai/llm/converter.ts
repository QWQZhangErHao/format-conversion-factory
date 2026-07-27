/**
 * LLM-Powered Semantic Format Converter.
 *
 * Uses the WebLLM session to perform intelligent format conversions
 * that understand context and semantics, not just syntax.
 *
 * Capabilities:
 * - JSON ↔ Natural Language (e.g., "summarize this JSON as text")
 * - CSV ↔ Human-Readable Tables
 * - Smart format mapping with context awareness
 * - Data cleaning and normalization during conversion
 */

import { LLMSession } from './session'
import type { LLMConversionRequest, LLMConversionResult } from '../types'

/**
 * Generate the system prompt for a given format conversion task.
 */
function buildConversionPrompt(request: LLMConversionRequest): string {
  const prompts: Record<string, string> = {
    'json-to-nl': `将以下 JSON 数据转换为自然语言描述，保持所有信息的完整性：

\`\`\`json
${request.content.slice(0, 2000)}
\`\`\``,
    'nl-to-json': `将以下自然语言描述转换为 JSON 格式：

${request.content.slice(0, 2000)}`,
    'csv-to-json': `将以下 CSV 数据转换为 JSON 格式：

${request.content.slice(0, 2000)}`,
    'json-to-csv': `将以下 JSON 数据转换为 CSV 格式，保留所有字段：

${request.content.slice(0, 2000)}`,
  }

  const key = `${request.sourceFormat}-to-${request.targetFormat}`
  const basePrompt = prompts[key]

  if (basePrompt) return basePrompt

  // Generic conversion prompt
  return `将以下内容从 ${request.sourceFormat} 格式转换为 ${request.targetFormat} 格式，确保数据完整：
${request.instructions ? `\n要求：${request.instructions}` : ''}

输入：
${request.content.slice(0, 2000)}`
}

/**
 * LLM converter — uses language models for semantic format conversion.
 *
 * ```ts
 * const converter = new LLMConverter()
 * await converter.initialize()
 * const result = await converter.convert({
 *   sourceFormat: 'json',
 *   targetFormat: 'nl',
 *   content: '{"name": "Alice", "age": 30}'
 * })
 * ```
 */
export class LLMConverter {
  private session: LLMSession
  private initialized = false

  constructor(modelId?: string) {
    this.session = new LLMSession({
      modelId: modelId ?? 'qwen2.5-1.5b',
      maxTokens: 2048,
      temperature: 0.1,
    })
  }

  /** Initialize the LLM session */
  async initialize(onProgress?: (progress: number) => void): Promise<void> {
    await this.session.initialize(onProgress)
    this.initialized = true
  }

  /** Perform a semantic format conversion */
  async convert(request: LLMConversionRequest): Promise<LLMConversionResult> {
    if (!this.initialized) {
      await this.initialize()
    }

    const startTime = performance.now()
    const prompt = buildConversionPrompt(request)

    try {
      const output = await this.session.generate(prompt)
      return {
        success: true,
        output,
        modelUsed: this.session.getInfo().modelId,
        tokensUsed: Math.ceil(output.length / 4),
        durationMs: performance.now() - startTime,
      }
    } catch (_error) {
      return {
        success: false,
        output: '',
        modelUsed: this.session.getInfo().modelId,
        tokensUsed: 0,
        durationMs: performance.now() - startTime,
      }
    }
  }

  /** Check if the LLM is ready */
  isReady(): boolean {
    return this.initialized && this.session.getInfo().status === 'ready'
  }

  /** Unload the model */
  async unload(): Promise<void> {
    await this.session.unload()
    this.initialized = false
  }
}
