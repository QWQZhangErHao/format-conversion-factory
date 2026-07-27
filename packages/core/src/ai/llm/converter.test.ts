import { describe, it, expect, vi } from 'vitest'
import { LLMConverter } from './converter'
import { LLMSession } from './session'

describe('LLMConverter', () => {
  it('creates converter with default model', () => {
    const c = new LLMConverter()
    expect(c.isReady()).toBe(false)
  })

  it('creates converter with custom model', () => {
    const c = new LLMConverter('phi-3-mini')
    expect(c.isReady()).toBe(false)
  })

  it('initialize() succeeds', async () => {
    const c = new LLMConverter()
    await c.initialize()
    expect(c.isReady()).toBe(true)
  })

  it('convert() with explicit initialization', async () => {
    const c = new LLMConverter()
    await c.initialize()
    const r = await c.convert({ sourceFormat: 'json', targetFormat: 'nl', content: '{"name":"A"}' })
    expect(r.success).toBe(true)
    expect(r.output).toBeTruthy()
    expect(r.modelUsed).toBe('qwen2.5-1.5b')
    expect(r.tokensUsed).toBeGreaterThan(0)
    expect(r.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('convert() auto-initializes when not explicitly initialized', async () => {
    const c = new LLMConverter()
    const r = await c.convert({ sourceFormat: 'csv', targetFormat: 'json', content: 'x,y' })
    expect(r.success).toBe(true)
  })

  it('convert() returns success:false when LLM fails', async () => {
    const c = new LLMConverter()
    vi.spyOn(LLMSession.prototype, 'generate').mockRejectedValueOnce(new Error('fail'))
    const r = await c.convert({ sourceFormat: 'json', targetFormat: 'nl', content: 'test' })
    expect(r.success).toBe(false)
    expect(r.output).toBe('')
  })

  it('isReady() reflects state correctly', async () => {
    const c = new LLMConverter()
    expect(c.isReady()).toBe(false)
    await c.initialize()
    expect(c.isReady()).toBe(true)
  })

  it('unload() resets ready state', async () => {
    const c = new LLMConverter()
    await c.initialize()
    expect(c.isReady()).toBe(true)
    await c.unload()
    expect(c.isReady()).toBe(false)
  })

  describe('prompt types', () => {
    it('json-to-nl', async () => {
      const c = new LLMConverter()
      const r = await c.convert({ sourceFormat: 'json', targetFormat: 'nl', content: '{"a":1}' })
      expect(r.success).toBe(true)
    })

    it('nl-to-json', async () => {
      const c = new LLMConverter()
      const r = await c.convert({ sourceFormat: 'nl', targetFormat: 'json', content: 'text' })
      expect(r.success).toBe(true)
    })

    it('csv-to-json', async () => {
      const c = new LLMConverter()
      const r = await c.convert({ sourceFormat: 'csv', targetFormat: 'json', content: 'a,b' })
      expect(r.success).toBe(true)
    })

    it('json-to-csv', async () => {
      const c = new LLMConverter()
      const r = await c.convert({ sourceFormat: 'json', targetFormat: 'csv', content: '{"a":1}' })
      expect(r.success).toBe(true)
    })

    it('generic fallback with instructions', async () => {
      const c = new LLMConverter()
      const r = await c.convert({ sourceFormat: 'yaml', targetFormat: 'toml', content: 'k:v', instructions: 'keep' })
      expect(r.success).toBe(true)
    })
  })
})
