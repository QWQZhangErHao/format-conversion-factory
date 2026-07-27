import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConversionErrorBoundary } from './ConversionErrorBoundary'

describe('ConversionErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ConversionErrorBoundary>
        <div data-testid="child">正常内容</div>
      </ConversionErrorBoundary>,
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('正常内容')).toBeInTheDocument()
  })

  it('renders fallback UI on error', () => {
    const ThrowingComponent = () => {
      throw new Error('测试渲染错误')
    }

    render(
      <ConversionErrorBoundary>
        <ThrowingComponent />
      </ConversionErrorBoundary>,
    )

    expect(screen.getByText('视图渲染遇到了点小问题')).toBeInTheDocument()
    expect(screen.getByText('重试渲染')).toBeInTheDocument()
    expect(screen.getByText('复制错误日志')).toBeInTheDocument()
  })

  it('renders custom fallback title', () => {
    const ThrowingComponent = () => { throw new Error('err') }
    render(
      <ConversionErrorBoundary fallbackTitle="自定义错误标题">
        <ThrowingComponent />
      </ConversionErrorBoundary>,
    )
    expect(screen.getByText('自定义错误标题')).toBeInTheDocument()
  })

  it('shows error message text', () => {
    const ThrowingComponent = () => { throw new Error('测试异常消息') }
    render(
      <ConversionErrorBoundary>
        <ThrowingComponent />
      </ConversionErrorBoundary>,
    )
    expect(screen.getByText('测试异常消息')).toBeInTheDocument()
  })

  it('reset button exists and is clickable', () => {
    vi.spyOn(console, 'error').mockImplementation(() => { /* 静默测试错误 */ })
    const ThrowingComponent = () => { throw new Error('err') }
    render(
      <ConversionErrorBoundary>
        <ThrowingComponent />
      </ConversionErrorBoundary>,
    )
    const resetBtn = screen.getByText('重试渲染')
    expect(resetBtn).toBeInTheDocument()
    fireEvent.click(resetBtn)
  })
})
