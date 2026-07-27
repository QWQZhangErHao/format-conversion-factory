import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ImageWiper } from './ImageWiper'

describe('ImageWiper', () => {
  it('renders both images', () => {
    render(<ImageWiper sourceUrl="a.png" targetUrl="b.webp" sourceLabel="PNG" targetLabel="WebP" />)
    expect(screen.getByAltText('PNG')).toBeInTheDocument()
    expect(screen.getByAltText('WebP')).toBeInTheDocument()
  })

  it('shows source error fallback on image error', () => {
    render(<ImageWiper sourceUrl="bad.png" targetUrl="b.webp" sourceLabel="PNG" targetLabel="WebP" />)
    fireEvent.error(screen.getByAltText('PNG'))
    expect(screen.getByText(/无法加载原始图片/i)).toBeInTheDocument()
  })

  it('shows target error fallback on image error', () => {
    render(<ImageWiper sourceUrl="a.png" targetUrl="bad.webp" sourceLabel="PNG" targetLabel="WebP" />)
    fireEvent.error(screen.getByAltText('WebP'))
    expect(screen.getByText(/无法加载图片/i)).toBeInTheDocument()
  })

  it('renders with default labels on bottom bar', () => {
    const { container } = render(<ImageWiper sourceUrl="a.png" targetUrl="b.webp" />)
    // Labels appear in the bottom indicator bar
    expect(container.textContent).toContain('Original')
    expect(container.textContent).toContain('Converted')
  })

  it('renders in rounded container', () => {
    const { container } = render(<ImageWiper sourceUrl="a.png" targetUrl="b.webp" />)
    const outer = container.firstChild as HTMLElement
    expect(outer.className).toContain('rounded-[14px]')
  })
})
