import { describe, it, expect, vi } from 'vitest'
import { ConversionPipeline } from './index'
import type { ConversionRequest, ConversionPlugin, ConversionProgress } from '../types'
import { ConversionStatus, EngineType, StageType } from '../types'

describe('ConversionPipeline', () => {
  const makePlugin = (overrides: Partial<ConversionPlugin> = {}): ConversionPlugin => ({
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0',
    sourceFormats: ['json'],
    targetFormats: ['csv'],
    engine: EngineType.NATIVE,
    execute: vi.fn().mockResolvedValue({ success: true, outputPath: '/out.csv', durationMs: 100 }),
    ...overrides,
  })

  const makeRequest = (overrides: Partial<ConversionRequest> = {}): ConversionRequest => ({
    id: 'test-conversion',
    sourceFormat: 'json',
    targetFormat: 'csv',
    inputPath: '/test/input.json',
    outputPath: '/test/output.csv',
    ...overrides,
  })

  it('registers and finds plugins', async () => {
    const pipeline = new ConversionPipeline()
    const plugin = makePlugin()
    pipeline.registerPlugin(plugin)

    const request = makeRequest()
    await pipeline.execute(request, vi.fn())

    // The plugin was found and used by execute
    expect(plugin.execute).toHaveBeenCalledWith(request, expect.any(Function))
  })

  it('handles no-plugin-found error gracefully', async () => {
    const pipeline = new ConversionPipeline()
    const request: ConversionRequest = {
      sourceFormat: 'unknown',
      targetFormat: 'unknown',
      inputPath: '/test/file.txt',
    }
    const onProgress = vi.fn()
    const result = await pipeline.execute(request, onProgress)
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.error).toContain('No plugin found')
  })

  it('cancels and allows new conversions to proceed', async () => {
    const pipeline = new ConversionPipeline()
    pipeline.cancel()
    pipeline.registerPlugin(makePlugin())
    // After cancel, a new conversion should still work
    const result = await pipeline.execute(makeRequest(), vi.fn())
    expect(result.success).toBe(true)
  })

  it('executes full path with a mock plugin that succeeds', async () => {
    const pipeline = new ConversionPipeline()
    const execute = vi.fn().mockResolvedValue({
      success: true,
      outputPath: '/out.csv',
      durationMs: 100,
    })
    const plugin = makePlugin({ execute })
    pipeline.registerPlugin(plugin)

    const request = makeRequest()
    const result = await pipeline.execute(request, vi.fn())

    expect(result.success).toBe(true)
    expect(result.outputPath).toBe('/out.csv')
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(execute).toHaveBeenCalledWith(request, expect.any(Function))
  })

  it('execute with plugin validate returning error => result.success = false', async () => {
    const pipeline = new ConversionPipeline()
    const validate = vi.fn().mockReturnValue('Invalid format: unsupported type')
    const execute = vi.fn()
    const plugin = makePlugin({ validate, execute })
    pipeline.registerPlugin(plugin)

    const request = makeRequest()
    const result = await pipeline.execute(request, vi.fn())

    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid format: unsupported type')
    expect(validate).toHaveBeenCalledWith(request)
    expect(execute).not.toHaveBeenCalled()
  })

  it('execute with plugin execute throwing => result.success = false', async () => {
    const pipeline = new ConversionPipeline()
    const execute = vi.fn().mockRejectedValue(new Error('Execution failed'))
    const plugin = makePlugin({ execute })
    pipeline.registerPlugin(plugin)

    const request = makeRequest()
    const result = await pipeline.execute(request, vi.fn())

    expect(result.success).toBe(false)
    expect(result.error).toBe('Execution failed')
  })

  it('handles non-Error thrown from plugin execution', async () => {
    const pipeline = new ConversionPipeline()
    const execute = vi.fn().mockRejectedValue('string error')
    const plugin = makePlugin({ execute })
    pipeline.registerPlugin(plugin)

    const result = await pipeline.execute(makeRequest(), vi.fn())

    expect(result.success).toBe(false)
    expect(result.error).toBe('Unknown conversion error')
  })

  it('uses "unknown" as conversionId when request.id is undefined', async () => {
    const pipeline = new ConversionPipeline()
    pipeline.registerPlugin(makePlugin())

    const progresses: ConversionProgress[] = []
    await pipeline.execute(
      { sourceFormat: 'json', targetFormat: 'csv', inputPath: '/in.json' },
      (p) => progresses.push(p),
    )

    expect(progresses.length).toBeGreaterThan(0)
    expect(progresses.every((p) => p.conversionId === 'unknown')).toBe(true)
  })

  it('emit() progress events in correct order', async () => {
    const pipeline = new ConversionPipeline()
    pipeline.registerPlugin(makePlugin())

    const progresses: ConversionProgress[] = []
    await pipeline.execute(makeRequest(), (p) => progresses.push(p))

    const statuses = progresses.map((p) => p.status)
    expect(statuses).toEqual([
      ConversionStatus.PREPROCESSING,
      ConversionStatus.CONVERTING,
      ConversionStatus.CONVERTING,
      ConversionStatus.POSTPROCESSING,
      ConversionStatus.COMPLETED,
    ])
  })

  it('passes stage types correctly through progress events', async () => {
    const pipeline = new ConversionPipeline()
    pipeline.registerPlugin(makePlugin())

    const stages: (StageType | undefined)[] = []
    await pipeline.execute(makeRequest(), (p) => stages.push(p.stage))

    expect(stages).toEqual([
      StageType.PREPROCESS,
      StageType.PARSE,
      StageType.TRANSFORM,
      StageType.POSTPROCESS,
      undefined,
    ])
  })

  it('progress values increase monotonically on success', async () => {
    const pipeline = new ConversionPipeline()
    pipeline.registerPlugin(makePlugin())

    const values: number[] = []
    await pipeline.execute(makeRequest(), (p) => values.push(p.progress))

    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1])
    }
    expect(values[values.length - 1]).toBe(1)
  })

  it('execute with plugin validate returning null proceeds successfully', async () => {
    const pipeline = new ConversionPipeline()
    const validate = vi.fn().mockReturnValue(null)
    const plugin = makePlugin({ validate })
    pipeline.registerPlugin(plugin)

    const result = await pipeline.execute(makeRequest(), vi.fn())

    expect(result.success).toBe(true)
    expect(validate).toHaveBeenCalled()
  })

  it('cancel() does not throw', () => {
    const pipeline = new ConversionPipeline()
    expect(() => pipeline.cancel()).not.toThrow()
    // Idempotent — second call should also not throw
    expect(() => pipeline.cancel()).not.toThrow()
  })
})
