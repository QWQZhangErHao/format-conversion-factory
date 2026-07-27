import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { GlassPanel } from './GlassPanel'

describe('GlassPanel', () => {
  it('renders children', () => {
    render(
      <GlassPanel>
        <span data-testid="child">Content</span>
      </GlassPanel>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('renders with light intensity', () => {
    const { container } = render(<GlassPanel intensity="light">Light</GlassPanel>)
    const div = container.firstChild as HTMLElement
    expect(div.className).toContain('backdrop-blur-[8px]')
  })

  it('renders with medium intensity (default)', () => {
    const { container } = render(<GlassPanel intensity="medium">Medium</GlassPanel>)
    const div = container.firstChild as HTMLElement
    expect(div.className).toContain('backdrop-blur-[20px]')
  })

  it('renders with heavy intensity', () => {
    const { container } = render(<GlassPanel intensity="heavy">Heavy</GlassPanel>)
    const div = container.firstChild as HTMLElement
    expect(div.className).toContain('backdrop-blur-[40px]')
    expect(div.className).toContain('saturate-[1.8]')
  })

  it('renders with sm padding', () => {
    const { container } = render(<GlassPanel padding="sm">Small Padding</GlassPanel>)
    const div = container.firstChild as HTMLElement
    expect(div.className).toContain('p-4')
  })

  it('renders with md padding (default)', () => {
    const { container } = render(<GlassPanel padding="md">Medium Padding</GlassPanel>)
    const div = container.firstChild as HTMLElement
    expect(div.className).toContain('p-6')
  })

  it('renders with lg padding', () => {
    const { container } = render(<GlassPanel padding="lg">Large Padding</GlassPanel>)
    const div = container.firstChild as HTMLElement
    expect(div.className).toContain('p-8')
  })

  it('renders with md rounded', () => {
    const { container } = render(<GlassPanel rounded="md">Rounded MD</GlassPanel>)
    const div = container.firstChild as HTMLElement
    expect(div.className).toContain('rounded-[10px]')
  })

  it('renders with lg rounded', () => {
    const { container } = render(<GlassPanel rounded="lg">Rounded LG</GlassPanel>)
    const div = container.firstChild as HTMLElement
    expect(div.className).toContain('rounded-[14px]')
  })

  it('renders with xl rounded (default)', () => {
    const { container } = render(<GlassPanel rounded="xl">Rounded XL</GlassPanel>)
    const div = container.firstChild as HTMLElement
    expect(div.className).toContain('rounded-[20px]')
  })

  it('renders with 2xl rounded', () => {
    const { container } = render(<GlassPanel rounded="2xl">Rounded 2XL</GlassPanel>)
    const div = container.firstChild as HTMLElement
    expect(div.className).toContain('rounded-[28px]')
  })

  it('adds bordered shadow classes when bordered is true (default)', () => {
    const { container } = render(<GlassPanel bordered>Bordered</GlassPanel>)
    const div = container.firstChild as HTMLElement
    // bordered=true adds the inset shadow with white border effect
    expect(div.className).toContain('shadow-[0_0_0_1px_rgba(255,255,255,0.5)_inset')
  })

  it('uses non-bordered shadow when bordered is false', () => {
    const { container } = render(<GlassPanel bordered={false}>No Border</GlassPanel>)
    const div = container.firstChild as HTMLElement
    // bordered=false should use shadow without inset
    expect(div.className).toContain('shadow-[0_1px_3px_rgba(0,0,0,0.04)')
    // bordered=true specific class should not be present
    expect(div.className).not.toContain('shadow-[0_0_0_1px_rgba(255,255,255,0.5)_inset')
  })

  it('adds cursor-pointer when hoverable is true', () => {
    const { container } = render(<GlassPanel hoverable>Hoverable</GlassPanel>)
    const div = container.firstChild as HTMLElement
    expect(div.className).toContain('cursor-pointer')
  })

  it('does not add cursor-pointer when hoverable is false', () => {
    const { container } = render(<GlassPanel hoverable={false}>Not Hoverable</GlassPanel>)
    const div = container.firstChild as HTMLElement
    expect(div.className).not.toContain('cursor-pointer')
  })

  it('applies custom className', () => {
    const { container } = render(<GlassPanel className="my-panel">Custom Class</GlassPanel>)
    const div = container.firstChild as HTMLElement
    expect(div.className).toContain('my-panel')
  })

  it('applies dark mode shadow classes', () => {
    const { container } = render(<GlassPanel>Dark Mode</GlassPanel>)
    const div = container.firstChild as HTMLElement
    expect(div.className).toContain('dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset')
  })

  it('renders multiple children', () => {
    render(
      <GlassPanel>
        <span data-testid="child1">First</span>
        <span data-testid="child2">Second</span>
      </GlassPanel>,
    )
    expect(screen.getByTestId('child1')).toBeInTheDocument()
    expect(screen.getByTestId('child2')).toBeInTheDocument()
  })

  it('applies default props when none specified', () => {
    const { container } = render(<GlassPanel>Default</GlassPanel>)
    const div = container.firstChild as HTMLElement
    // Default: intensity=medium
    expect(div.className).toContain('backdrop-blur-[20px]')
    // Default: padding=md
    expect(div.className).toContain('p-6')
    // Default: rounded=xl
    expect(div.className).toContain('rounded-[20px]')
    // Default: bordered=true
    expect(div.className).toContain('shadow-[0_0_0_1px_rgba(255,255,255,0.5)_inset')
  })

  it('accepts ref via forwardRef', () => {
    const ref = React.createRef<HTMLDivElement>()
    const { container } = render(<GlassPanel ref={ref}>Ref Test</GlassPanel>)
    expect(ref.current).toBe(container.firstChild)
  })
})
