import type { ConversionPlugin, ConversionRequest, ConversionResult, ConversionProgress } from '../types'
import { EngineType, ConversionStatus } from '../types'

/**
 * Base plugin — all conversion plugins extend this.
 * Implement `execute()` for the actual conversion logic.
 */
export abstract class BasePlugin implements ConversionPlugin {
  abstract id: string
  abstract name: string
  abstract version: string
  abstract sourceFormats: string[]
  abstract targetFormats: string[]
  abstract engine: EngineType

  validate?(request: ConversionRequest): string | null {
    return null
  }

  abstract execute(
    request: ConversionRequest,
    onProgress: (progress: ConversionProgress) => void,
  ): Promise<ConversionResult>

  protected emitProgress(
    onProgress: (progress: ConversionProgress) => void,
    progress: number,
    message?: string,
    conversionId = 'unknown',
  ): void {
    onProgress({
      conversionId,
      status: ConversionStatus.CONVERTING,
      progress,
      message,
    })
  }
}
