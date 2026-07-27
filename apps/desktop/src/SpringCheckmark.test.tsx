import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SpringCheckmark } from './SpringCheckmark'

describe('SpringCheckmark', () => {
  it('renders with default size', () => {
    const { container } = render(<SpringCheckmark />)
    const div = container.firstChild as HTMLElement
    expect(div).toBeInTheDocument()
    expect(div.className).toContain('rounded-full')
    expect(div.className).toContain('bg-[#34C759]')
  })

  it('renders with custom size', () => {
    const { container } = render(<SpringCheckmark size={48} />)
    const div = container.firstChild as HTMLElement
    expect(div.style.width).toBe('48px')
    expect(div.style.height).toBe('48px')
  })

  it('renders SVG checkmark path', () => {
    const { container } = render(<SpringCheckmark />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toBeInTheDocument()
  })

  it('has motion animation props', () => {
    const { container } = render(<SpringCheckmark />)
    const div = container.firstChild as HTMLElement
    expect(div).toBeInTheDocument()
  })
})
