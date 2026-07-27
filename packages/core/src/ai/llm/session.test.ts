import { describe, it, expect } from 'vitest'
import { LLMSession } from './session'

describe('LLMSession', () => {
  it('creates session with default model', () => {
    const session = new LLMSession()
    expect(session.getInfo().modelId).toBe('qwen2.5-1.5b')
  })

  it('creates session with custom model', () => {
    const session = new LLMSession({ modelId: 'phi-3-mini', maxTokens: 512 })
    expect(session.getInfo().modelId).toBe('phi-3-mini')
  })

  it('initializes in mock mode', async () => {
    const session = new LLMSession()
    await session.initialize()
    expect(session.getInfo().status).toBe('ready')
  })

  it('generates in mock mode', async () => {
    const session = new LLMSession()
    await session.initialize()
    const result = await session.generate('Convert this')
    expect(result).toContain('[Mock WebLLM]')
  })

  it('can be unloaded', async () => {
    const session = new LLMSession()
    await session.initialize()
    await session.unload()
    expect(session.getInfo().status).toBe('unloaded')
  })
})
