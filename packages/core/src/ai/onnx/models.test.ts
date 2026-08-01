import { describe, it, expect } from 'vitest'
import { AI_MODELS, getModelInfo, getRecommendedBackend } from './models'

describe('AI_MODELS', () => {
  it('has layoutlmv3-tiny', () => {
    expect(AI_MODELS['layoutlmv3-tiny']!).toBeDefined()
  })

  it('has lpips-alex', () => {
    expect(AI_MODELS['lpips-alex']!).toBeDefined()
  })

  it('models are INT8 quantized', () => {
    expect(AI_MODELS['layoutlmv3-tiny']!.descriptor.quantized).toBe(true)
    expect(AI_MODELS['lpips-alex']!.descriptor.quantized).toBe(true)
  })

  it('models have lazyLoad true', () => {
    expect(AI_MODELS['layoutlmv3-tiny']!.lazyLoad).toBe(true)
    expect(AI_MODELS['lpips-alex']!.lazyLoad).toBe(true)
  })

  it('models have download urls', () => {
    expect(AI_MODELS['layoutlmv3-tiny']!.downloadUrl).toContain('https://')
    expect(AI_MODELS['lpips-alex']!.downloadUrl).toContain('https://')
  })

  it('models have checksum', () => {
    expect(AI_MODELS['layoutlmv3-tiny']!.checksum).toBeDefined()
    expect(AI_MODELS['lpips-alex']!.checksum).toBeDefined()
  })

  it('has correct model metadata', () => {
    expect(AI_MODELS['layoutlmv3-tiny']!.descriptor.name).toContain('LayoutLMv3')
    expect(AI_MODELS['layoutlmv3-tiny']!.descriptor.sizeMB).toBe(35)
    expect(AI_MODELS['lpips-alex']!.descriptor.name).toContain('LPIPS')
    expect(AI_MODELS['lpips-alex']!.descriptor.sizeMB).toBe(15)
  })
})

describe('getModelInfo', () => {
  it('returns descriptor for known model', () => {
    const info = getModelInfo('layoutlmv3-tiny')
    expect(info).toBeDefined()
    expect(info!.id).toBe('layoutlmv3-tiny')
    expect(info!.version).toBe('0.1.0')
    expect(info!.backend).toBe('webgpu')
  })

  it('returns descriptor for lpips-alex', () => {
    const info = getModelInfo('lpips-alex')
    expect(info).toBeDefined()
    expect(info!.id).toBe('lpips-alex')
    expect(info!.description).toContain('感知')
  })

  it('returns undefined for unknown model', () => {
    expect(getModelInfo('nonexistent')).toBeUndefined()
  })
})

describe('getRecommendedBackend', () => {
  it('returns one of the valid backends', () => {
    const backend = getRecommendedBackend()
    expect(['webgpu', 'webgl', 'wasm', 'cpu']).toContain(backend)
  })
})
