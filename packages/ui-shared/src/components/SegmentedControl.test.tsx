import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SegmentedControl } from './SegmentedControl'

const options = [
  { value: 'document', label: '文档' },
  { value: 'image', label: '图片' },
  { value: 'data', label: '数据' },
]

describe('SegmentedControl', () => {
  it('renders all options', () => {
    render(<SegmentedControl options={options} value="document" onChange={() => {}} />)
    expect(screen.getByText('文档')).toBeInTheDocument()
    expect(screen.getByText('图片')).toBeInTheDocument()
    expect(screen.getByText('数据')).toBeInTheDocument()
  })

  it('highlights the active option', () => {
    render(<SegmentedControl options={options} value="document" onChange={() => {}} />)
    const docBtn = screen.getByText('文档').closest('button')!
    expect(docBtn.className).toContain('text-white')
  })

  it('calls onChange when clicking an option', () => {
    const onChange = vi.fn()
    render(<SegmentedControl options={options} value="document" onChange={onChange} />)
    fireEvent.click(screen.getByText('图片'))
    expect(onChange).toHaveBeenCalledWith('image')
  })

  it('calls onChange with correct value for different option', () => {
    const onChange = vi.fn()
    render(<SegmentedControl options={options} value="image" onChange={onChange} />)
    fireEvent.click(screen.getByText('数据'))
    expect(onChange).toHaveBeenCalledWith('data')
  })

  it('renders with size sm', () => {
    const { container } = render(
      <SegmentedControl options={options} value="document" onChange={() => {}} size="sm" />,
    )
    expect(container.querySelectorAll('button').length).toBe(3)
  })

  it('renders with size lg', () => {
    const { container } = render(
      <SegmentedControl options={options} value="document" onChange={() => {}} size="lg" />,
    )
    expect(container.querySelectorAll('button').length).toBe(3)
  })

  it('applies fullWidth class when fullWidth is true', () => {
    const { container } = render(
      <SegmentedControl options={options} value="document" onChange={() => {}} fullWidth />,
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('w-full')
  })

  it('renders options with icons', () => {
    const optionsWithIcons = [
      { value: 'a', label: 'Option A', icon: <span data-testid="icon-a">★</span> },
      { value: 'b', label: 'Option B', icon: <span data-testid="icon-b">☆</span> },
    ]
    render(<SegmentedControl options={optionsWithIcons} value="a" onChange={() => {}} />)
    expect(screen.getByTestId('icon-a')).toBeInTheDocument()
    expect(screen.getByTestId('icon-b')).toBeInTheDocument()
  })
})
