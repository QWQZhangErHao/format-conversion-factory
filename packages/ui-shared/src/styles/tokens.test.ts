import { describe, it, expect } from 'vitest'
import {
  COLORS, RADIUS, SPRING, SPACING, FONT_SIZE, SHADOWS, FONT_FAMILY,
} from './tokens'

describe('Design Tokens', () => {
  it('COLORS has all system colors', () => {
    expect(COLORS.blue).toBe('#007AFF')
    expect(COLORS.green).toBe('#34C759')
    expect(COLORS.red).toBe('#FF3B30')
    expect(COLORS.orange).toBe('#FF9500')
    expect(COLORS.yellow).toBe('#FFCC00')
    expect(COLORS.pink).toBe('#FF2D55')
    expect(COLORS.purple).toBe('#AF52DE')
    expect(COLORS.indigo).toBe('#5856D6')
    expect(COLORS.teal).toBe('#59ADC4')
    expect(COLORS.cyan).toBe('#32ADE6')
    expect(COLORS.brown).toBe('#A2845E')
    expect(COLORS.mint).toBe('#00C7BE')
    expect(COLORS.gray).toBeDefined()
    expect(COLORS.gray['1']).toBe('#1C1C1E')
    expect(COLORS.gray['6']).toBe('#8E8E93')
  })

  it('COLORS has background colors', () => {
    expect(COLORS.background.primary).toBe('#FFFFFF')
    expect(COLORS.background.secondary).toBe('#F2F2F7')
    expect(COLORS.backgroundDark.primary).toBe('#000000')
    expect(COLORS.backgroundDark.secondary).toBe('#1C1C1E')
  })

  it('RADIUS has all values', () => {
    expect(RADIUS.sm).toBe(6)
    expect(RADIUS.md).toBe(10)
    expect(RADIUS.lg).toBe(14)
    expect(RADIUS.xl).toBe(20)
    expect(RADIUS['2xl']).toBe(28)
    expect(RADIUS.full).toBe(9999)
  })

  it('SPRING has all 7 presets', () => {
    expect(SPRING.DEFAULT).toEqual({ stiffness: 400, damping: 30, mass: 1 })
    expect(SPRING.SNAPPY).toEqual({ stiffness: 500, damping: 35, mass: 0.8 })
    expect(SPRING.GENTLE).toEqual({ stiffness: 200, damping: 25, mass: 1 })
    expect(SPRING.BOUNCY).toEqual({ stiffness: 350, damping: 15, mass: 1 })
    expect(SPRING.WOBBLE).toEqual({ stiffness: 300, damping: 10, mass: 0.9 })
    expect(SPRING.SLOW).toEqual({ stiffness: 150, damping: 20, mass: 1.2 })
    expect(SPRING.MAGNETIC).toEqual({ stiffness: 600, damping: 40, mass: 0.6 })
  })

  it('SPACING has all values', () => {
    expect(SPACING.xs).toBe(4)
    expect(SPACING.sm).toBe(8)
    expect(SPACING.md).toBe(16)
    expect(SPACING.lg).toBe(24)
    expect(SPACING.xl).toBe(32)
    expect(SPACING['2xl']).toBe(48)
    expect(SPACING['3xl']).toBe(64)
    expect(SPACING['4xl']).toBe(80)
  })

  it('FONT_SIZE has all values', () => {
    expect(FONT_SIZE.caption).toBe(12)
    expect(FONT_SIZE.footnote).toBe(13)
    expect(FONT_SIZE.subhead).toBe(15)
    expect(FONT_SIZE.callout).toBe(16)
    expect(FONT_SIZE.body).toBe(17)
    expect(FONT_SIZE.title3).toBe(20)
    expect(FONT_SIZE.title2).toBe(22)
    expect(FONT_SIZE.title1).toBe(28)
    expect(FONT_SIZE.largeTitle).toBe(34)
  })

  it('SHADOWS has all elevations', () => {
    expect(SHADOWS.sm).toBeDefined()
    expect(SHADOWS.md).toBeDefined()
    expect(SHADOWS.lg).toBeDefined()
    expect(SHADOWS.xl).toBeDefined()
    expect(SHADOWS.sm.shadowOpacity).toBe(0.04)
    expect(SHADOWS.lg.shadowOpacity).toBe(0.08)
  })

  it('FONT_FAMILY has sans, mono, and rounded', () => {
    expect(FONT_FAMILY.sans).toContain('Inter')
    expect(FONT_FAMILY.sans).toContain('-apple-system')
    expect(FONT_FAMILY.mono).toContain('SF Mono')
    expect(FONT_FAMILY.rounded).toContain('SF Pro Rounded')
  })
})
