import { describe, it, expect } from 'vitest'
import { useSpring, springVariants } from './spring'

describe('useSpring', () => {
  it('returns SPRING config for DEFAULT preset', () => {
    const result = useSpring('DEFAULT')
    expect(result).toBeDefined()
    expect(result).toHaveProperty('stiffness')
    expect(result).toHaveProperty('damping')
    expect(result).toHaveProperty('mass')
  })

  it('returns SNAPPY config', () => {
    const result = useSpring('SNAPPY')
    expect(result.stiffness).toBe(500)
    expect(result.damping).toBe(35)
  })

  it('returns GENTLE config', () => {
    const result = useSpring('GENTLE')
    expect(result.stiffness).toBe(200)
  })

  it('returns BOUNCY config', () => {
    const result = useSpring('BOUNCY')
    expect(result.stiffness).toBe(350)
    expect(result.damping).toBe(15)
  })

  it('returns WOBBLE config', () => {
    const result = useSpring('WOBBLE')
    expect(result.stiffness).toBe(300)
    expect(result.damping).toBe(10)
  })

  it('returns SLOW config', () => {
    const result = useSpring('SLOW')
    expect(result.stiffness).toBe(150)
    expect(result.damping).toBe(20)
  })

  it('returns MAGNETIC config', () => {
    const result = useSpring('MAGNETIC')
    expect(result.stiffness).toBe(600)
    expect(result.damping).toBe(40)
  })
})

describe('springVariants', () => {
  it('has slideUp variant with initial/animate/exit', () => {
    expect(springVariants.slideUp).toBeDefined()
    expect(springVariants.slideUp.initial).toEqual({ opacity: 0, y: 20 })
    expect(springVariants.slideUp.animate).toEqual({ opacity: 1, y: 0 })
    expect(springVariants.slideUp.exit).toEqual({ opacity: 0, y: 10 })
  })

  it('has scaleIn variant', () => {
    expect(springVariants.scaleIn).toBeDefined()
    expect(springVariants.scaleIn.initial).toEqual({ opacity: 0, scale: 0.8 })
    expect(springVariants.scaleIn.animate).toEqual({ opacity: 1, scale: 1 })
  })

  it('has fadeIn variant', () => {
    expect(springVariants.fadeIn).toBeDefined()
    expect(springVariants.fadeIn.initial).toEqual({ opacity: 0 })
    expect(springVariants.fadeIn.animate).toEqual({ opacity: 1 })
  })

  it('has staggerContainer and staggerItem variants', () => {
    expect(springVariants.staggerContainer).toBeDefined()
    expect(springVariants.staggerItem).toBeDefined()
    expect(springVariants.staggerItem.initial).toEqual({ opacity: 0, y: 12 })
    expect(springVariants.staggerItem.animate).toEqual({ opacity: 1, y: 0 })
  })
})
