import type { ConversionRequest, ConversionProgress, ConversionResult, ConversionPlugin } from '../types'
import { ConversionStatus, StageType } from '../types'

/**
 * Conversion Pipeline — orchestrates the multi-stage conversion flow.
 * Each conversion passes through: PREPROCESS → PARSE → TRANSFORM → SERIALIZE → POSTPROCESS.
 */
export class ConversionPipeline {
  private plugins: ConversionPlugin[] = []
  // 每个 execute() 调用创建新的 AbortController
  private currentAbort: AbortController | null = null

  registerPlugin(plugin: ConversionPlugin): void {
    this.plugins.push(plugin)
  }

  private findPlugin(source: string, target: string): ConversionPlugin | undefined {
    return this.plugins.find(
      (p) => p.sourceFormats.includes(source) && p.targetFormats.includes(target),
    )
  }

  async execute(
    request: ConversionRequest,
    onProgress: (progress: ConversionProgress) => void,
  ): Promise<ConversionResult> {
    const startTime = performance.now()
    const abort = new AbortController()
    this.currentAbort = abort

    const emit = (status: ConversionStatus, progress: number, stage?: StageType, message?: string) => {
      onProgress({ conversionId: request.id ?? 'unknown', status, progress, stage, message })
    }

    const checkCancelled = (): void => {
      if (abort.signal.aborted) {
        emit(ConversionStatus.CANCELLED, 0, undefined, '转换已取消')
        throw new Error('转换已取消')
      }
    }

    try {
      // Phase 1: Preprocess
      checkCancelled()
      emit(ConversionStatus.PREPROCESSING, 0.05, StageType.PREPROCESS, '准备输入文件...')

      const plugin = this.findPlugin(request.sourceFormat, request.targetFormat)
      if (!plugin) {
        throw new Error(`No plugin found for conversion: ${request.sourceFormat} → ${request.targetFormat}`)
      }

      // Validate
      checkCancelled()
      if (plugin.validate) {
        const error = plugin.validate(request)
        if (error) throw new Error(error)
      }

      // Phase 2: Parse
      checkCancelled()
      emit(ConversionStatus.CONVERTING, 0.2, StageType.PARSE, `解析 ${request.sourceFormat}...`)

      // Phase 3-4: Transform & Serialize (handled by the plugin)
      checkCancelled()
      emit(ConversionStatus.CONVERTING, 0.4, StageType.TRANSFORM, `转换为 ${request.targetFormat}...`)

      const result = await plugin.execute(request, (progress) => {
        if (abort.signal.aborted) return // 取消后不再上报进度
        onProgress({
          ...progress,
          progress: 0.2 + progress.progress * 0.6,
        })
      })

      // Phase 5: Postprocess
      checkCancelled()
      emit(ConversionStatus.POSTPROCESSING, 0.95, StageType.POSTPROCESS, '完成处理...')

      const durationMs = performance.now() - startTime
      emit(ConversionStatus.COMPLETED, 1.0, undefined, '转换完成')

      return {
        ...result,
        durationMs,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown conversion error'
      if (!abort.signal.aborted) {
        emit(ConversionStatus.FAILED, 0, undefined, errorMessage)
      }
      return {
        success: false,
        error: errorMessage,
        durationMs: performance.now() - startTime,
      }
    } finally {
      if (this.currentAbort === abort) this.currentAbort = null
    }
  }

  cancel(): void {
    this.currentAbort?.abort()
  }
}
