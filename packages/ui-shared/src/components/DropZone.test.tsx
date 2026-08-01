import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DropZone } from './DropZone'

function createMockFileList(files: File[]): FileList {
  return {
    0: files[0],
    1: files[1],
    length: files.length,
    item(index: number): File | null {
      return files[index] ?? null
    },
    [Symbol.iterator]() {
      let i = 0
      return {
        next: () => (i < files.length ? { value: files[i++], done: false } : { done: true } as IteratorResult<File>),
      }
    },
  } as unknown as FileList
}

describe('DropZone', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders default label', () => {
    const onFilesDrop = vi.fn()
    render(<DropZone onFilesDrop={onFilesDrop} />)
    expect(screen.getByText('拖放文件到此处')).toBeInTheDocument()
    expect(screen.getByText('或点击选择文件')).toBeInTheDocument()
  })

  it('renders custom label and hint', () => {
    const onFilesDrop = vi.fn()
    render(
      <DropZone onFilesDrop={onFilesDrop} label="Drop files here" hint="Supports PDF, DOCX" />,
    )
    expect(screen.getByText('Drop files here')).toBeInTheDocument()
    expect(screen.getByText('Supports PDF, DOCX')).toBeInTheDocument()
  })

  it('calls onFilesDrop on file drop event', () => {
    const onFilesDrop = vi.fn()
    render(<DropZone onFilesDrop={onFilesDrop} />)
    const zone = screen.getByRole('button')

    const file = new File(['content'], 'test.md', { type: 'text/markdown' })
    fireEvent.drop(zone, {
      dataTransfer: { files: createMockFileList([file]) },
    })

    expect(onFilesDrop).toHaveBeenCalledTimes(1)
    expect(onFilesDrop).toHaveBeenCalledWith([file])
  })

  it('calls onFilesDrop with multiple files', () => {
    const onFilesDrop = vi.fn()
    render(<DropZone onFilesDrop={onFilesDrop} multiple />)
    const zone = screen.getByRole('button')

    const file1 = new File(['a'], 'a.txt', { type: 'text/plain' })
    const file2 = new File(['b'], 'b.txt', { type: 'text/plain' })
    fireEvent.drop(zone, {
      dataTransfer: { files: createMockFileList([file1, file2]) },
    })

    expect(onFilesDrop).toHaveBeenCalledTimes(1)
    expect(onFilesDrop).toHaveBeenCalledWith([file1, file2])
  })

  it('creates a file input on button click', () => {
    const onFilesDrop = vi.fn()

    // Only intercept 'input' createElement calls, delegate everything else to real impl
    const realCreateElement = document.createElement.bind(document)
    const createElementSpy = vi.spyOn(document, 'createElement')
    createElementSpy.mockImplementation((tagName: string) => {
      if (tagName === 'input') {
        return realCreateElement('input')
      }
      return realCreateElement(tagName)
    })

    render(<DropZone onFilesDrop={onFilesDrop} />)
    const zone = screen.getByRole('button')
    fireEvent.click(zone)

    expect(createElementSpy).toHaveBeenCalledWith('input')
    createElementSpy.mockRestore()
  })

  it('sets accept and multiple on the created input', () => {
    const onFilesDrop = vi.fn()

    let createdInput: HTMLInputElement | null = null
    const realCreateElement = document.createElement.bind(document)
    const createElementSpy = vi.spyOn(document, 'createElement')
    createElementSpy.mockImplementation((tagName: string) => {
      if (tagName === 'input') {
        const input = realCreateElement('input') as HTMLInputElement
        createdInput = input
        return input
      }
      return realCreateElement(tagName)
    })

    render(<DropZone onFilesDrop={onFilesDrop} accept=".pdf,.docx" multiple={false} />)
    const zone = screen.getByRole('button')
    fireEvent.click(zone)

    expect(createdInput).not.toBeNull()
    expect(createdInput!.accept).toBe('.pdf,.docx')
    expect(createdInput!.multiple).toBe(false)

    createElementSpy.mockRestore()
  })

  it('does not create file input when disabled and clicked', () => {
    const onFilesDrop = vi.fn()
    const createElementSpy = vi.spyOn(document, 'createElement')

    render(<DropZone onFilesDrop={onFilesDrop} disabled />)
    const zone = screen.getByRole('button')
    fireEvent.click(zone)

    expect(createElementSpy).not.toHaveBeenCalledWith('input')
    createElementSpy.mockRestore()
  })

  it('applies dragging border class on drag enter', () => {
    const onFilesDrop = vi.fn()
    render(<DropZone onFilesDrop={onFilesDrop} />)
    const zone = screen.getByRole('button')

    fireEvent.dragEnter(zone)

    expect(zone.className).toContain('border-[#007AFF]')
    expect(zone.className).toContain('bg-[#007AFF]/5')
  })

  it('removes dragging border class on drag leave', () => {
    const onFilesDrop = vi.fn()
    render(<DropZone onFilesDrop={onFilesDrop} />)
    const zone = screen.getByRole('button')

    fireEvent.dragEnter(zone)
    expect(zone.className).toContain('border-[#007AFF]')

    fireEvent.dragLeave(zone)
    expect(zone.className).toContain('border-dashed')
    expect(zone.className).toContain('border-gray-300')
  })

  it('removes dragging border class on drop', () => {
    const onFilesDrop = vi.fn()
    render(<DropZone onFilesDrop={onFilesDrop} />)
    const zone = screen.getByRole('button')

    fireEvent.dragEnter(zone)
    expect(zone.className).toContain('border-[#007AFF]')

    const file = new File(['c'], 'c.txt', { type: 'text/plain' })
    fireEvent.drop(zone, {
      dataTransfer: { files: createMockFileList([file]) },
    })

    expect(zone.className).toContain('border-dashed')
    expect(zone.className).toContain('border-gray-300')
  })

  it('does not call onFilesDrop when disabled and files dropped', () => {
    const onFilesDrop = vi.fn()
    render(<DropZone onFilesDrop={onFilesDrop} disabled />)
    const zone = screen.getByRole('button')

    const file = new File(['d'], 'd.txt', { type: 'text/plain' })
    fireEvent.drop(zone, {
      dataTransfer: { files: createMockFileList([file]) },
    })

    expect(onFilesDrop).not.toHaveBeenCalled()
  })

  it('applies disabled styles when disabled', () => {
    const onFilesDrop = vi.fn()
    render(<DropZone onFilesDrop={onFilesDrop} disabled />)
    const zone = screen.getByRole('button')

    expect(zone).toBeDisabled()
    expect(zone.className).toContain('opacity-50')
    expect(zone.className).toContain('cursor-not-allowed')
  })

  it('does not enter drag state when disabled', () => {
    const onFilesDrop = vi.fn()
    render(<DropZone onFilesDrop={onFilesDrop} disabled />)
    const zone = screen.getByRole('button')

    fireEvent.dragEnter(zone)

    expect(zone.className).not.toContain('border-[#007AFF]')
  })

  it('applies custom className', () => {
    const onFilesDrop = vi.fn()
    render(<DropZone onFilesDrop={onFilesDrop} className="my-dropzone" />)
    const zone = screen.getByRole('button')

    expect(zone.className).toContain('my-dropzone')
  })

  it('renders custom icon', () => {
    const onFilesDrop = vi.fn()
    render(
      <DropZone
        onFilesDrop={onFilesDrop}
        icon={<span data-testid="custom-icon">Custom Upload</span>}
      />,
    )
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
  })

  it('renders default upload SVG icon when no icon prop given', () => {
    const onFilesDrop = vi.fn()
    const { container } = render(<DropZone onFilesDrop={onFilesDrop} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('shows hover classes on mouse enter', () => {
    const onFilesDrop = vi.fn()
    render(<DropZone onFilesDrop={onFilesDrop} />)
    const zone = screen.getByRole('button')

    fireEvent.mouseEnter(zone)
    expect(zone.className).toContain('bg-gray-50/50')
  })

  it('removes hover classes on mouse leave', () => {
    const onFilesDrop = vi.fn()
    render(<DropZone onFilesDrop={onFilesDrop} />)
    const zone = screen.getByRole('button')

    fireEvent.mouseEnter(zone)
    fireEvent.mouseLeave(zone)
    expect(zone.className).not.toContain('bg-gray-50/50')
  })
})
