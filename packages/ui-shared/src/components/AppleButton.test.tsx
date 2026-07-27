import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { AppleButton } from './AppleButton'

describe('AppleButton', () => {
  it('renders with default props (variant=primary, size=md)', () => {
    render(<AppleButton>Click me</AppleButton>)
    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
    // Default classes from primary variant
    expect(button.className).toContain('bg-[#007AFF]')
    expect(button.className).toContain('text-white')
    // Default size md padding
    expect(button.className).toContain('px-5')
    expect(button.className).toContain('py-2.5')
  })

  it('renders text children', () => {
    render(<AppleButton>转换文件</AppleButton>)
    expect(screen.getByText('转换文件')).toBeInTheDocument()
  })

  it('renders with primary variant', () => {
    render(<AppleButton variant="primary">Primary</AppleButton>)
    const button = screen.getByRole('button')
    expect(button.className).toContain('bg-[#007AFF]')
    expect(button.className).toContain('text-white')
  })

  it('renders with secondary variant', () => {
    render(<AppleButton variant="secondary">Secondary</AppleButton>)
    const button = screen.getByRole('button')
    expect(button.className).toContain('bg-gray-100')
    expect(button.className).toContain('text-gray-900')
  })

  it('renders with tertiary variant', () => {
    render(<AppleButton variant="tertiary">Tertiary</AppleButton>)
    const button = screen.getByRole('button')
    expect(button.className).toContain('text-gray-900')
    expect(button.className).toContain('shadow-[0_0_0_1px_rgba(0,0,0,0.06)_inset]')
  })

  it('renders with ghost variant', () => {
    render(<AppleButton variant="ghost">Ghost</AppleButton>)
    const button = screen.getByRole('button')
    expect(button.className).toContain('bg-transparent')
    expect(button.className).toContain('text-[#007AFF]')
  })

  it('renders with sm size', () => {
    render(<AppleButton size="sm">Small</AppleButton>)
    const button = screen.getByRole('button')
    expect(button.className).toContain('px-3.5')
    expect(button.className).toContain('py-1.5')
    expect(button.className).toContain('text-[13px]')
  })

  it('renders with md size', () => {
    render(<AppleButton size="md">Medium</AppleButton>)
    const button = screen.getByRole('button')
    expect(button.className).toContain('px-5')
    expect(button.className).toContain('py-2.5')
    expect(button.className).toContain('text-[15px]')
  })

  it('renders with lg size', () => {
    render(<AppleButton size="lg">Large</AppleButton>)
    const button = screen.getByRole('button')
    expect(button.className).toContain('px-6')
    expect(button.className).toContain('py-3')
    expect(button.className).toContain('text-[17px]')
  })

  it('shows spinner and hides children when loading', () => {
    const { container } = render(<AppleButton loading>Hidden Text</AppleButton>)
    // Children text should NOT be visible
    expect(screen.queryByText('Hidden Text')).not.toBeInTheDocument()
    // Spinner SVG should be present
    const spinner = container.querySelector('svg.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('disables button when loading', () => {
    render(<AppleButton loading>Click</AppleButton>)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('applies w-full class when fullWidth is true', () => {
    render(<AppleButton fullWidth>Full Width</AppleButton>)
    const button = screen.getByRole('button')
    expect(button.className).toContain('w-full')
  })

  it('does not apply w-full class when fullWidth is false', () => {
    render(<AppleButton fullWidth={false}>Not Full</AppleButton>)
    const button = screen.getByRole('button')
    expect(button.className).not.toContain('w-full')
  })

  it('renders iconLeading icon', () => {
    render(<AppleButton iconLeading={<span data-testid="leading-icon">L</span>}>With Icon</AppleButton>)
    expect(screen.getByTestId('leading-icon')).toBeInTheDocument()
  })

  it('renders iconTrailing icon', () => {
    render(<AppleButton iconTrailing={<span data-testid="trailing-icon">T</span>}>With Icon</AppleButton>)
    expect(screen.getByTestId('trailing-icon')).toBeInTheDocument()
  })

  it('renders both leading and trailing icons', () => {
    render(
      <AppleButton
        iconLeading={<span data-testid="leading-icon">L</span>}
        iconTrailing={<span data-testid="trailing-icon">T</span>}
      >
        Both
      </AppleButton>,
    )
    expect(screen.getByTestId('leading-icon')).toBeInTheDocument()
    expect(screen.getByTestId('trailing-icon')).toBeInTheDocument()
  })

  it('renders custom className appended to default classes', () => {
    render(<AppleButton className="my-custom-class">Custom</AppleButton>)
    const button = screen.getByRole('button')
    expect(button.className).toContain('my-custom-class')
    // Default classes should still be present
    expect(button.className).toContain('inline-flex')
  })

  it('supports motion props like whileHover and whileTap without error', () => {
    render(
      <AppleButton whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        Motion
      </AppleButton>,
    )
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('passes additional HTML button props', () => {
    const handleClick = vi.fn()
    render(<AppleButton onClick={handleClick}>Clickable</AppleButton>)
    screen.getByRole('button').click()
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('accepts ref via forwardRef', () => {
    const ref = React.createRef<HTMLButtonElement>()
    render(<AppleButton ref={ref}>Ref</AppleButton>)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })
})
