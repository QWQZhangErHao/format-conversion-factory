/**
 * AI Worker — 在独立 Web Worker 线程中运行 AI 推理。
 *
 * 防御体系第二层：计算隔离
 * - ONNX Runtime / WebLLM 推理全量在 Worker 中执行
 * - 主线程 0 阻塞，保持 60-120fps
 * - 通过 Comlink RPC 桥接暴露 API
 */

// Comlink 用于主线程 ↔ Worker 之间的透明 RPC 桥接
// 安装: pnpm add comlink
// 导入: import * as Comlink from 'comlink'

import type { LayoutAnalyzer } from './layout/analyzer'
import type { QualityScorer } from './quality/scorer'

export interface AIWorkerAPI {
  /** 分析文档版面结构 */
  analyzeDocument(content: string, format: string): Promise<unknown>
  /** 评估转换质量 */
  scoreQuality(originalPath: string, convertedPath: string, format: string): Promise<unknown>
  /** 使用 LLM 进行语义转换 */
  llmConvert(sourceFormat: string, targetFormat: string, content: string): Promise<{ output: string; success: boolean }>
  /** 健康检查 */
  healthCheck(): Promise<{ status: string; memory: number }>
}

class AIWorkerImpl implements AIWorkerAPI {
  private analyzer: LayoutAnalyzer | null = null
  private scorer: QualityScorer | null = null
  private initialized = false

  async healthCheck(): Promise<{ status: string; memory: number }> {
    return {
      status: this.initialized ? 'ready' : 'idle',
      memory: 0,
    }
  }

  async analyzeDocument(content: string, format: string): Promise<unknown> {
    // 动态加载 AI 模块（仅在 Worker 中，不影响主线程）
    const { LayoutAnalyzer } = await import('./layout/analyzer')
    const { ONNXEngine } = await import('./onnx/runtime')

    const engine = new ONNXEngine()
    this.analyzer = new LayoutAnalyzer(engine)
    this.initialized = true

    // 在 Worker 线程中执行密集型分析
    return this.analyzer.analyze(content, format)
  }

  async scoreQuality(originalPath: string, convertedPath: string, format: string): Promise<unknown> {
    const { QualityScorer } = await import('./quality/scorer')
    const { ONNXEngine } = await import('./onnx/runtime')

    const engine = new ONNXEngine()
    this.scorer = new QualityScorer(engine)
    this.initialized = true

    return this.scorer.score(originalPath, convertedPath, format)
  }

  async llmConvert(sourceFormat: string, targetFormat: string, content: string): Promise<{ output: string; success: boolean }> {
    const { LLMConverter } = await import('./llm/converter')

    const converter = new LLMConverter()
    await converter.initialize()

    const result = await converter.convert({
      sourceFormat,
      targetFormat,
      content,
    })

    return { output: result.output, success: result.success }
  }
}

// 通过 Comlink 暴露 Worker API
// Comlink.expose(new AIWorkerImpl())
// 
// 由于 Comlink 是可选依赖，提供基于 postMessage 的 fallback：
self.onmessage = async (event: MessageEvent) => {
  const { id, method, args } = event.data
  const worker = new AIWorkerImpl()

  try {
    const result = await (worker as any)[method](...args)
    self.postMessage({ id, result, error: null })
  } catch (err) {
    self.postMessage({ id, result: null, error: String(err) })
  }
}
