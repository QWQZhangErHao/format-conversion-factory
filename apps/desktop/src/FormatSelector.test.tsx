import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FormatSelector } from './FormatSelector'

describe('FormatSelector', () => {
  const defaultProps = {
    activeTab: 'document' as const,
    selectedTarget: null as string | null,
    onTabChange: vi.fn(),
    onTargetChange: vi.fn(),
  }

  it('renders format tabs', () => {
    render(<FormatSelector {...defaultProps} />)
    expect(screen.getByText('文档')).toBeInTheDocument()
    expect(screen.getByText('图片')).toBeInTheDocument()
    expect(screen.getByText('数据')).toBeInTheDocument()
  })

  it('renders document formats by default', () => {
    render(<FormatSelector {...defaultProps} />)
    expect(screen.getByText('Markdown')).toBeInTheDocument()
    expect(screen.getByText('HTML')).toBeInTheDocument()
  })

  it('renders image formats when image tab selected', () => {
    render(<FormatSelector {...defaultProps} activeTab="image" />)
    expect(screen.getByText('PNG')).toBeInTheDocument()
    expect(screen.getByText('JPEG')).toBeInTheDocument()
  })

  it('renders data formats when data tab selected', () => {
    render(<FormatSelector {...defaultProps} activeTab="data" />)
    expect(screen.getByText('JSON')).toBeInTheDocument()
    expect(screen.getByText('CSV')).toBeInTheDocument()
    expect(screen.getByText('YAML')).toBeInTheDocument()
  })

  it('highlights selected target format', () => {
    render(<FormatSelector {...defaultProps} selectedTarget="json" activeTab="data" />)
    const jsonBtn = screen.getByText('JSON').closest('button')!
    expect(jsonBtn.className).toContain('bg-[#007AFF]')
  })

  it('calls onTargetChange when format clicked', () => {
    const onTargetChange = vi.fn()
    render(<FormatSelector {...defaultProps} onTargetChange={onTargetChange} activeTab="data" />)
    fireEvent.click(screen.getByText('CSV'))
    expect(onTargetChange).toHaveBeenCalledWith('csv')
  })
})
