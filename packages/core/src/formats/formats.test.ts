import { describe, it, expect, beforeAll } from 'vitest'
import { BUILTIN_FORMATS, registerBuiltinFormats } from './index'
import { FormatCategory } from '../types'

describe('Built-in Formats', () => {
  it('defines at least 15 formats', () => {
    expect(BUILTIN_FORMATS.length).toBeGreaterThanOrEqual(15)
  })

  it('includes document formats', () => {
    const docs = BUILTIN_FORMATS.filter((f) => f.category === FormatCategory.DOCUMENT)
    expect(docs.length).toBeGreaterThanOrEqual(4)
    expect(docs.find((f) => f.id === 'markdown')).toBeDefined()
    expect(docs.find((f) => f.id === 'pdf')).toBeDefined()
  })

  it('includes image formats', () => {
    const images = BUILTIN_FORMATS.filter((f) => f.category === FormatCategory.IMAGE)
    expect(images.length).toBeGreaterThanOrEqual(4)
    expect(images.find((f) => f.id === 'png')).toBeDefined()
  })

  it('includes data formats', () => {
    const data = BUILTIN_FORMATS.filter((f) => f.category === FormatCategory.DATA)
    expect(data.length).toBeGreaterThanOrEqual(5)
    expect(data.find((f) => f.id === 'json')).toBeDefined()
    expect(data.find((f) => f.id === 'yaml')).toBeDefined()
  })

  it('all formats have required fields', () => {
    for (const fmt of BUILTIN_FORMATS) {
      expect(fmt.id).toBeTruthy()
      expect(fmt.name).toBeTruthy()
      expect(fmt.extensions.length).toBeGreaterThan(0)
      expect(fmt.mimeTypes.length).toBeGreaterThan(0)
    }
  })

  it('registerBuiltinFormats does not throw', () => {
    expect(() => registerBuiltinFormats()).not.toThrow()
  })
})
