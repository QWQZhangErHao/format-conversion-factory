import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QualityScorer } from './scorer'
import { ONNXEngine } from '../onnx/runtime'
import { ArtifactType } from '../types'

// Mock fs for structural quality tests — the scorer uses dynamic import('fs')
vi.mock('fs', () => ({
  readFileSync: vi.fn((path: string) => {
    if (path.includes('missing')) {
      throw new Error('ENOENT: no such file')
    }
    return 'Standard content for structural quality validation'
  }),
}))

describe('QualityScorer', () => {
  let engine: ONNXEngine

  beforeEach(() => {
    engine = new ONNXEngine()
  })

  it('scores image quality without model', async () => {
    const scorer = new QualityScorer(engine)
    const score = await scorer.score('input.png', 'output.webp', 'webp')
    expect(score.overall).toBeGreaterThanOrEqual(0)
    expect(score.overall).toBeLessThanOrEqual(100)
    expect(score.perceptualSimilarity).toBeGreaterThanOrEqual(0)
  })

  it('identifies potential artifacts', async () => {
    const scorer = new QualityScorer(engine)
    const score = await scorer.score('input.png', 'output.jpg', 'jpeg')
    expect(Array.isArray(score.artifacts)).toBe(true)
  })

  it('provides detail breakdown', async () => {
    const scorer = new QualityScorer(engine)
    const score = await scorer.score('input.png', 'output.webp', 'webp')
    expect(score.details.sharpness).toBeGreaterThan(0)
    expect(score.details.noise).toBeGreaterThan(0)
    expect(score.details.colorAccuracy).toBeGreaterThan(0)
    expect(score.details.compressionArtifacts).toBeGreaterThan(0)
    expect(score.details.textPreservation).toBeGreaterThan(0)
  })

  it('scores structural quality with existing files', async () => {
    const scorer = new QualityScorer(engine)
    // Both paths return the same length, so ratio = 1 → overall = 100
    const score = await scorer.score('input.txt', 'output.txt', 'txt')
    expect(score.overall).toBe(100)
    expect(score.structuralSimilarity).toBe(1)
    expect(score.artifacts).toEqual([])
    expect(score.details.textPreservation).toBe(100)
  })

  it('handles missing files in structural quality', async () => {
    const scorer = new QualityScorer(engine)
    // Paths that include "missing" trigger readFileSync to throw → catch block
    const score = await scorer.score('missing.json', 'missing.csv', 'csv')
    expect(score.overall).toBe(85)
    expect(score.perceptualSimilarity).toBe(0.85)
    expect(score.details.textPreservation).toBe(85)
  })

  it('falls back to heuristic when useModel=true but model not loaded', async () => {
    const scorer = new QualityScorer(engine, { useModel: true })
    const score = await scorer.score('input.png', 'output.webp', 'webp')
    // Falls back to heuristicScore
    expect(score.overall).toBeGreaterThanOrEqual(0)
  })

  it('scores different image format variants', async () => {
    const scorer = new QualityScorer(engine)
    const png = await scorer.score('a.png', 'b.png', 'image/png')
    expect(png.overall).toBeGreaterThanOrEqual(0)
    const jpg = await scorer.score('a.jpg', 'b.jpg', 'jpg')
    expect(jpg.overall).toBeGreaterThanOrEqual(0)
    const webp = await scorer.score('a.webp', 'b.webp', 'webp')
    expect(webp.overall).toBeGreaterThanOrEqual(0)
  })

  it('perceptualSimilarity matches overall/100', async () => {
    const scorer = new QualityScorer(engine)
    const score = await scorer.score('input.png', 'output.webp', 'webp')
    // perceptualSimilarity is always calculated as overall / 100
    expect(score.perceptualSimilarity).toBe(score.overall / 100)
  })

  it('artifact detection adds BLOCKING when compressionArtifacts is low', async () => {
    const scorer = new QualityScorer(engine)
    // Force Math.random to 0.1 → compressionArtifacts = 75 + 2.5 = 77.5 < 80
    vi.spyOn(Math, 'random').mockReturnValue(0.1)
    const score = await scorer.score('input.png', 'output.webp', 'webp')
    expect(score.artifacts).toContain(ArtifactType.BLOCKING)
    expect(score.artifacts).not.toContain(ArtifactType.BLUR)
    expect(score.artifacts).not.toContain(ArtifactType.NOISE)
  })

  it('no artifacts when all detail values are high', async () => {
    const scorer = new QualityScorer(engine)
    // Force Math.random to 0.8 → all values above thresholds
    vi.spyOn(Math, 'random').mockReturnValue(0.8)
    const score = await scorer.score('input.png', 'output.webp', 'webp')
    // compressionArtifacts = 75 + 20 = 95 >= 80, no artifacts
    // sharpness = 85 + 12 = 97 >= 85
    // noise = 80 + 16 = 96 >= 80
    expect(score.artifacts).not.toContain(ArtifactType.BLOCKING)
  })

  it('handles non-image formats via structural scoring path', async () => {
    const scorer = new QualityScorer(engine)
    // Non-image formats go through scoreStructuralQuality
    const score = await scorer.score('input.json', 'output.csv', 'json')
    expect(score.overall).toBeGreaterThan(0)
    expect(score.structuralSimilarity).toBeDefined()
  })
})
