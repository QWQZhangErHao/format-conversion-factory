import { describe, it, expect, vi } from 'vitest'
import { formatFileSize, classNames, debounce } from './index'

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(500)).toBe('500 B')
  })

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })

  it('formats megabytes', () => {
    const oneMB = 1024 * 1024
    expect(formatFileSize(oneMB)).toBe('1.0 MB')
    expect(formatFileSize(oneMB * 2.5)).toBe('2.5 MB')
  })

  it('formats gigabytes', () => {
    const oneGB = 1024 * 1024 * 1024
    expect(formatFileSize(oneGB)).toBe('1.0 GB')
  })

  it('handles Infinity without infinite loop', () => {
    expect(formatFileSize(Infinity)).toBe('0 B')
    expect(formatFileSize(-1)).toBe('0 B')
    expect(formatFileSize(NaN)).toBe('0 B')
  })
})

describe('classNames', () => {
  it('joins class names', () => {
    expect(classNames('a', 'b', 'c')).toBe('a b c')
  })

  it('filters falsy values', () => {
    expect(classNames('a', false, null, undefined, 'b')).toBe('a b')
  })
})

describe('debounce', () => {
  it('calls function after delay', async () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 50)
    debounced('test')
    expect(fn).not.toHaveBeenCalled()
    await new Promise((r) => setTimeout(r, 60))
    expect(fn).toHaveBeenCalledWith('test')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('cancels previous pending call', async () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 50)
    debounced('first')
    debounced('second')
    await new Promise((r) => setTimeout(r, 60))
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('second')
  })

  it('supports multiple independent calls', async () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 30)
    debounced('a')
    await new Promise((r) => setTimeout(r, 40))
    debounced('b')
    await new Promise((r) => setTimeout(r, 40))
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenNthCalledWith(1, 'a')
    expect(fn).toHaveBeenNthCalledWith(2, 'b')
  })
})
