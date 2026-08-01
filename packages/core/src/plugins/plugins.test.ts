import { describe, it, expect, vi } from 'vitest'
import { EngineType, ConversionStatus } from '../types'
import { BasePlugin } from './index'
import type { ConversionRequest, ConversionProgress } from '../types'

class TestPlugin extends BasePlugin {
  id = 'test-plugin'
  name = 'Test Plugin'
  version = '1.0'
  sourceFormats = ['json']
  targetFormats = ['csv']
  engine = EngineType.NATIVE
  async execute(_req: ConversionRequest, _onProgress: (p: ConversionProgress) => void) {
    return { success: true, durationMs: 0 }
  }
}

/** Exposes the protected `emitProgress` so tests can exercise it. */
class ExposedTestPlugin extends TestPlugin {
  callEmitProgress(
    onProgress: (p: ConversionProgress) => void,
    progress: number,
    message?: string,
    conversionId?: string,
  ): void {
    this.emitProgress(onProgress, progress, message, conversionId)
  }
}

describe('BasePlugin', () => {
  it('can be extended with concrete implementation', () => {
    const plugin = new TestPlugin()
    expect(plugin.id).toBe('test-plugin')
    expect(plugin.name).toBe('Test Plugin')
    expect(plugin.sourceFormats).toContain('json')
    expect(plugin.targetFormats).toContain('csv')
  })
  it('validate returns null by default', () => {
    const plugin = new TestPlugin()
    const req = { sourceFormat:'json',targetFormat:'csv',inputPath:'/a.json' }
    expect(plugin.validate!(req)).toBeNull()
  })
  it('emitProgress calls _onProgress correctly', () => {
    const plugin = new ExposedTestPlugin()
    const _onProgress = vi.fn()
    plugin.callEmitProgress(_onProgress, 0.5, 'halfway')
    expect(_onProgress).toHaveBeenCalledTimes(1)
    const arg = _onProgress.mock.calls[0]![0]
    expect(arg.progress).toBe(0.5)
    expect(arg.message).toBe('halfway')
    expect(arg.status).toBe(ConversionStatus.CONVERTING)
    expect(arg.conversionId).toBe('unknown')
  })
  it('emitProgress uses custom conversionId', () => {
    const plugin = new ExposedTestPlugin()
    const _onProgress = vi.fn()
    plugin.callEmitProgress(_onProgress, 1.0, 'done', 'conv-001')
    const arg = _onProgress.mock.calls[0]![0]
    expect(arg.conversionId).toBe('conv-001')
  })
  it('validate can be overridden', () => {
    class ValidatingPlugin extends BasePlugin {
      id='v';name='v';version='1';sourceFormats=['a'];targetFormats=['b'];engine=EngineType.NATIVE
      validate(request: ConversionRequest) { return request.inputPath ? null : 'no path' }
      async execute(_req: ConversionRequest, _onProgress: (p: ConversionProgress) => void) { return { success:true, durationMs:0 } }
    }
    const p = new ValidatingPlugin()
    expect(p.validate({} as ConversionRequest)).toBe('no path')
    expect(p.validate({ inputPath:'/f' } as ConversionRequest)).toBeNull()
  })
})