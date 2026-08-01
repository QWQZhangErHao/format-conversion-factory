/**
 * Comprehensive tests for the Frontend Conversion Service.
 *
 * Architecture:
 *   Mock mode  – Tauri is unavailable (invoke rejects)
 *   Tauri mode – Tauri is available (invoke resolves, listen works)
 *
 * vi.hoisted() exposes controllable mock functions that the factory functions
 * inside vi.mock() can reference (hoisting requirement).
 * vi.resetModules() + dynamic import() give each test a fresh module instance,
 * which is essential for testing checkTauri() caching.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConversionStatus } from './types'

// ── Controllable Tauri mocks ──
// vi.hoisted is required so vi.mock factories can reference these variables
// (both are hoisted to the top of the file).

const { mockInvoke, mockListen } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockListen: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mockInvoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen: mockListen }))

// ── Mock Mode — Tauri is unavailable ──

describe('ConversionService (Mock)', () => {
  beforeEach(() => {
    mockInvoke.mockClear()
    mockListen.mockClear()
    mockInvoke.mockRejectedValue(new Error('Tauri not available'))
    vi.resetModules()
  })

  it('performs mock conversion', async () => {
    const { startConversion } = await import('./service')
    const onProgress = vi.fn()
    const result = await startConversion(
      'json',
      'csv',
      '/test/input.json',
      undefined,
      undefined,
      onProgress,
    )

    expect(result.success).toBe(true)
    expect(result.outputPath).toContain('.csv')
    expect(result.durationMs).toBeGreaterThan(0)
    expect(result.originalSizeBytes).toBeGreaterThan(0)
    expect(result.resultSizeBytes).toBeGreaterThan(0)
  })

  it('reports progress during mock conversion', async () => {
    const { startConversion } = await import('./service')
    const onProgress = vi.fn()
    await startConversion('md', 'html', '/test/doc.md', undefined, undefined, onProgress)

    expect(onProgress).toHaveBeenCalled()
    const statuses = onProgress.mock.calls.map(
      (c: unknown[]) => (c[0] as { status: ConversionStatus }).status,
    )
    expect(statuses).toContain(ConversionStatus.PREPROCESSING)
    expect(statuses).toContain(ConversionStatus.CONVERTING)
    expect(statuses).toContain(ConversionStatus.COMPLETED)
  })

  it('progress callback receives all expected fields', async () => {
    const { startConversion } = await import('./service')
    const onProgress = vi.fn()
    await startConversion('json', 'csv', '/test/input.json', undefined, undefined, onProgress)

    const firstCall = onProgress.mock.calls[0]![0] as Record<string, unknown>
    expect(firstCall).toHaveProperty('conversionId')
    expect(firstCall).toHaveProperty('status')
    expect(firstCall).toHaveProperty('progress')
    expect(firstCall).toHaveProperty('message')
    expect(firstCall.conversionId).toMatch(/^mock-/)
    expect(typeof firstCall.progress).toBe('number')
    expect(firstCall.progress).toBeGreaterThanOrEqual(0)
    expect(firstCall.progress).toBeLessThanOrEqual(1)

    const lastCall =
      onProgress.mock.calls[onProgress.mock.calls.length - 1]![0] as Record<string, unknown>
    expect(lastCall.status).toBe(ConversionStatus.COMPLETED)
    expect(lastCall.progress).toBe(1)
  })

  it('returns formats in mock mode', async () => {
    const { getSupportedFormats } = await import('./service')
    const formats = await getSupportedFormats()

    expect(formats.length).toBeGreaterThan(0)
    expect(formats.find((f: { id: string }) => f.id === 'json')).toBeDefined()
    expect(formats.find((f: { id: string }) => f.id === 'png')).toBeDefined()
  })

  it('getWorkerStats returns mock pool stats', async () => {
    const { getWorkerStats } = await import('./service')
    const stats = await getWorkerStats()

    expect(stats.maxWorkers).toBe(4)
    expect(stats.activeJobs).toBe(0)
    expect(stats).toHaveProperty('pendingJobs')
    expect(stats).toHaveProperty('globallyPaused')
  })

  it('FormatInfo shape is correct in mock mode', async () => {
    const { getSupportedFormats } = await import('./service')
    const formats = await getSupportedFormats()
    const format = formats[0]!

    expect(format).toHaveProperty('id')
    expect(format).toHaveProperty('name')
    expect(format).toHaveProperty('category')
    expect(format).toHaveProperty('extensions')
    expect(Array.isArray(format.extensions)).toBe(true)
    expect(format).toHaveProperty('mimeTypes')
    expect(Array.isArray(format.mimeTypes)).toBe(true)
    expect(format).toHaveProperty('description')
    expect(format).toHaveProperty('previewable')
    expect(typeof format.previewable).toBe('boolean')
  })
})

// ── Tauri Mode — Tauri is available ──

describe('ConversionService (Tauri)', () => {
  const mockConversionResult = {
    success: true,
    outputPath: '/tauri/output.csv',
    durationMs: 500,
    originalSizeBytes: 1024 * 50,
    resultSizeBytes: 1024 * 30,
  }

  beforeEach(() => {
    mockInvoke.mockClear()
    mockListen.mockClear()
    mockInvoke.mockResolvedValue(mockConversionResult)
    mockListen.mockResolvedValue(vi.fn())
    vi.resetModules()
  })

  it('performs Tauri conversion when Tauri is available', async () => {
    const { startConversion } = await import('./service')
    const result = await startConversion('json', 'csv', '/test/input.json')

    expect(result).toEqual(mockConversionResult)

    // checkTauri should have probed with greet
    expect(mockInvoke).toHaveBeenCalledWith('greet', { name: 'test' })
    // tauriConversion should have called convert_file
    expect(mockInvoke).toHaveBeenCalledWith('convert_file', {
      sourceFormat: 'json',
      targetFormat: 'csv',
      inputPath: '/test/input.json',
      outputPath: null,
      quality: null,
      width: null,
      height: null,
    })
  })

  it('passes path and options to Tauri convert_file', async () => {
    const { startConversion } = await import('./service')
    await startConversion('png', 'jpg', '/test/image.png', '/test/output.jpg', {
      quality: 85,
      width: 800,
      height: 600,
    })

    expect(mockInvoke).toHaveBeenCalledWith('convert_file', {
      sourceFormat: 'png',
      targetFormat: 'jpg',
      inputPath: '/test/image.png',
      outputPath: '/test/output.jpg',
      quality: 85,
      width: 800,
      height: 600,
    })
  })

  it('listens for progress events in Tauri mode', async () => {
    const { startConversion } = await import('./service')
    const onProgress = vi.fn()
    await startConversion('json', 'csv', '/test/input.json', undefined, undefined, onProgress)

    expect(mockListen).toHaveBeenCalledWith('conversion-progress', expect.any(Function))
  })

  it('forwards progress events to onProgress callback', async () => {
    let capturedHandler: ((event: { payload: Record<string, unknown> }) => void) | null = null
    mockListen.mockImplementation(
      (_event: string, handler: (event: { payload: Record<string, unknown> }) => void) => {
        capturedHandler = handler
        return Promise.resolve(vi.fn())
      },
    )

    const { startConversion } = await import('./service')
    const onProgress = vi.fn()
    await startConversion('json', 'csv', '/test/input.json', undefined, undefined, onProgress)

    expect(capturedHandler).not.toBeNull()
    capturedHandler!({
      payload: {
        conversionId: 'tauri-cid-001',
        status: ConversionStatus.CONVERTING,
        progress: 0.6,
        message: 'processing...',
      },
    })

    expect(onProgress).toHaveBeenCalledWith({
      conversionId: 'tauri-cid-001',
      status: ConversionStatus.CONVERTING,
      progress: 0.6,
      message: 'processing...',
    })
  })

  it('auto-unlistens on progress completion', async () => {
    const unlisten = vi.fn()
    let capturedHandler: ((event: { payload: Record<string, unknown> }) => void) | null = null
    mockListen.mockImplementation(
      (_event: string, handler: (event: { payload: Record<string, unknown> }) => void) => {
        capturedHandler = handler
        return Promise.resolve(unlisten)
      },
    )

    const { startConversion } = await import('./service')
    const onProgress = vi.fn()
    await startConversion('json', 'csv', '/test/input.json', undefined, undefined, onProgress)

    expect(capturedHandler).not.toBeNull()
    capturedHandler!({
      payload: {
        conversionId: 'tauri-complete',
        status: ConversionStatus.COMPLETED,
        progress: 1,
        message: 'done',
      },
    })

    expect(unlisten).toHaveBeenCalled()
  })

  it('auto-unlistens on progress failure', async () => {
    const unlisten = vi.fn()
    let capturedHandler: ((event: { payload: Record<string, unknown> }) => void) | null = null
    mockListen.mockImplementation(
      (_event: string, handler: (event: { payload: Record<string, unknown> }) => void) => {
        capturedHandler = handler
        return Promise.resolve(unlisten)
      },
    )

    const { startConversion } = await import('./service')
    const onProgress = vi.fn()
    await startConversion('json', 'csv', '/test/input.json', undefined, undefined, onProgress)

    expect(capturedHandler).not.toBeNull()
    capturedHandler!({
      payload: {
        conversionId: 'tauri-fail',
        status: ConversionStatus.FAILED,
        progress: 0.5,
        message: 'something went wrong',
      },
    })

    expect(unlisten).toHaveBeenCalled()
  })

  it('does NOT unlisten on intermediate progress', async () => {
    const unlisten = vi.fn()
    let capturedHandler: ((event: { payload: Record<string, unknown> }) => void) | null = null
    mockListen.mockImplementation(
      (_event: string, handler: (event: { payload: Record<string, unknown> }) => void) => {
        capturedHandler = handler
        return Promise.resolve(unlisten)
      },
    )

    const { startConversion } = await import('./service')
    const onProgress = vi.fn()
    await startConversion('json', 'csv', '/test/input.json', undefined, undefined, onProgress)

    capturedHandler!({
      payload: {
        conversionId: 't-1',
        status: ConversionStatus.CONVERTING,
        progress: 0.3,
      },
    })

    expect(unlisten).not.toHaveBeenCalled()
  })

  it('skips listen when no onProgress callback given', async () => {
    const { startConversion } = await import('./service')
    const result = await startConversion('json', 'csv', '/test/input.json')

    expect(result.success).toBe(true)
    expect(mockListen).not.toHaveBeenCalled()
  })

  it('getSupportedFormats delegates to Tauri', async () => {
    const tauriFormats = [
      {
        id: 'pdf',
        name: 'PDF',
        category: 'document',
        extensions: ['.pdf'],
        mimeTypes: ['application/pdf'],
        description: 'PDF format',
        previewable: true,
      },
      {
        id: 'svg',
        name: 'SVG',
        category: 'image',
        extensions: ['.svg'],
        mimeTypes: ['image/svg+xml'],
        description: 'SVG vector image',
        previewable: true,
      },
    ]
    mockInvoke.mockResolvedValue(tauriFormats)

    const { getSupportedFormats } = await import('./service')
    const formats = await getSupportedFormats()

    expect(formats).toEqual(tauriFormats)
    // tauriInvoke passes undefined for the args parameter when omitted
    expect(mockInvoke).toHaveBeenCalledWith('get_supported_formats', undefined)
  })

  it('getWorkerStats delegates to Tauri', async () => {
    mockInvoke.mockResolvedValue({ maxWorkers: 8, activeJobs: 2, available: 6 })

    const { getWorkerStats } = await import('./service')
    const stats = await getWorkerStats()

    expect(stats).toEqual({ maxWorkers: 8, activeJobs: 2, available: 6 })
    expect(mockInvoke).toHaveBeenCalledWith('get_worker_stats', undefined)
  })
})

// ── checkTauri caching behaviour ──

describe('checkTauri caching', () => {
  beforeEach(() => {
    mockInvoke.mockClear()
    mockListen.mockClear()
    vi.resetModules()
  })

  it('caches the result so the second call skips the greet probe', async () => {
    mockInvoke.mockResolvedValue({ success: true, durationMs: 100 })
    mockListen.mockResolvedValue(vi.fn())

    const { startConversion, getSupportedFormats } = await import('./service')

    // Call #1 — triggers checkTauri -> greet
    await startConversion('json', 'csv', '/test/a.json')

    const greetCallCount = mockInvoke.mock.calls.filter((c) => c[0] === 'greet').length
    expect(greetCallCount).toBe(1)

    mockInvoke.mockClear()
    mockListen.mockClear()

    // Call #2 — should reuse cached result, NOT call greet again
    await getSupportedFormats()

    const greetCallCount2 = mockInvoke.mock.calls.filter((c) => c[0] === 'greet').length
    expect(greetCallCount2).toBe(0)

    // But get_supported_formats should have been called
    // tauriInvoke passes undefined for args parameter when omitted
    expect(mockInvoke).toHaveBeenCalledWith('get_supported_formats', undefined)
  })

  it('sets false when invoke fails', async () => {
    mockInvoke.mockRejectedValue(new Error('Tauri not available'))

    const { startConversion } = await import('./service')
    const result = await startConversion('json', 'csv', '/test/input.json')

    // Falls back to mock conversion
    expect(result.success).toBe(true)

    // Should have attempted greet
    expect(mockInvoke).toHaveBeenCalledWith('greet', { name: 'test' })
    // Should NOT have called convert_file (mock mode was used)
    const convertCalls = mockInvoke.mock.calls.filter((c) => c[0] === 'convert_file')
    expect(convertCalls).toHaveLength(0)
  })

  it('stays false after first failure (cached)', async () => {
    mockInvoke.mockRejectedValue(new Error('Tauri not available'))

    const { startConversion, getSupportedFormats } = await import('./service')

    // Call #1 — greet fails -> checkTauri returns false
    await startConversion('json', 'csv', '/test/a.json')

    mockInvoke.mockClear()

    // Call #2 — cached false -> mock mode, no greet call
    const formats = await getSupportedFormats()
    expect(formats).toBeInstanceOf(Array)
    expect(formats.length).toBeGreaterThan(0)

    // mockInvoke should not have been called at all during call #2
    expect(mockInvoke).not.toHaveBeenCalled()
  })
})
