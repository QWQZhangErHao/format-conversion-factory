import { describe, it, expect, beforeAll, vi } from 'vitest'
import { registry } from './index'
import { FormatCategory } from '../types'
import type { FormatDescriptor } from '../types'

const testFormat: FormatDescriptor = {
  id: 'test-format',
  name: 'Test Format',
  category: FormatCategory.DATA,
  extensions: ['.test'],
  mimeTypes: ['application/x-test'],
  description: 'A test format for unit testing',
  previewable: true,
  maxSizeBytes: 1024 * 1024,
}

beforeAll(() => {
  registry.register(testFormat)
})

describe('FormatRegistry', () => {
  it('registers and retrieves a format', () => {
    const retrieved = registry.get('test-format')
    expect(retrieved).toBeDefined()
    expect(retrieved?.id).toBe('test-format')
  })

  it('returns undefined for unknown formats', () => {
    expect(registry.get('nonexistent')).toBeUndefined()
  })

  it('filters formats by category', () => {
    const dataFormats = registry.getByCategory(FormatCategory.DATA)
    expect(dataFormats.length).toBeGreaterThan(0)
    dataFormats.forEach((f) => {
      expect(f.category).toBe(FormatCategory.DATA)
    })
  })

  it('checks convertible paths', () => {
    expect(registry.canConvert('test-format', 'test-format')).toBe(false)
    expect(registry.canConvert('test-format', 'missing-format')).toBe(false)
    expect(registry.canConvert('missing-format', 'test-format')).toBe(false)
  })

  it('registerMany adds multiple formats', () => {
    const formatA: FormatDescriptor = {
      id: 'fmt-a',
      name: 'Format A',
      category: FormatCategory.CODE,
      extensions: ['.a'],
      mimeTypes: ['application/x-a'],
      description: '',
      previewable: false,
      maxSizeBytes: 0,
    }
    const formatB: FormatDescriptor = {
      id: 'fmt-b',
      name: 'Format B',
      category: FormatCategory.IMAGE,
      extensions: ['.b'],
      mimeTypes: ['application/x-b'],
      description: '',
      previewable: false,
      maxSizeBytes: 0,
    }
    registry.registerMany([formatA, formatB])

    expect(registry.get('fmt-a')?.id).toBe('fmt-a')
    expect(registry.get('fmt-b')?.id).toBe('fmt-b')
  })

  it('register overwrites existing (warn shown)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const overwrite: FormatDescriptor = { ...testFormat, name: 'Overwritten Format' }
    registry.register(overwrite)

    expect(warnSpy).toHaveBeenCalled()
    const warnMsg = warnSpy.mock.calls[0][0] as string
    expect(warnMsg).toContain('already registered')
    expect(registry.get('test-format')?.name).toBe('Overwritten Format')

    warnSpy.mockRestore()
  })

  it('getConvertibleTargets returns all formats except source', () => {
    const targets = registry.getConvertibleTargets('test-format')
    expect(targets.some((f) => f.id === 'test-format')).toBe(false)
    expect(targets.length).toBeGreaterThan(0)
  })

  it('canConvert with both formats missing', () => {
    expect(registry.canConvert('missing-a', 'missing-b')).toBe(false)
  })

  it('getAll returns all registered', () => {
    const all = registry.getAll()
    expect(all.length).toBeGreaterThan(0)
    expect(all.some((f) => f.id === 'test-format')).toBe(true)
  })

  it('getByCategory with empty result', () => {
    const result = registry.getByCategory(FormatCategory.AUDIO)
    expect(result).toHaveLength(0)
  })
})
