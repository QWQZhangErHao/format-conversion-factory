/**
 * ConversionErrorBoundary — Apple 风格优雅错误兜底
 *
 * 防御体系第三层：视图兜底
 * - 局部隔离：仅包裹转换预览区，不影响导航/设置
 * - 毛玻璃兜底 UI：错误卡片 + 一键恢复 + 复制日志
 * - Framer Motion 弹簧动画
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { SPRING } from '../../../packages/ui-shared/src'

interface Props {
  children: ReactNode
  fallbackTitle?: string
  /** 是否在错误时记录到控制台 */
  silent?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ConversionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    if (!this.props.silent) {
      console.error('[ErrorBoundary] 捕获渲染异常:', error.message)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  handleCopyError = () => {
    if (this.state.error) {
      navigator.clipboard.writeText(
        `[格式转换工厂错误报告]\n时间: ${new Date().toISOString()}\n消息: ${this.state.error.message}\n堆栈: ${this.state.error.stack}`,
      )
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={SPRING.GENTLE}
          className="relative overflow-hidden rounded-[20px] bg-white/70 dark:bg-gray-900/70 backdrop-blur-[20px] shadow-[0_0_0_1px_rgba(255,255,255,0.5)_inset,0_4px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_4px_12px_rgba(0,0,0,0.2)] p-8"
        >
          <div className="flex flex-col items-center gap-4 text-center">
            {/* 错误图标 */}
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            {/* 标题 */}
            <h3 className="text-[17px] font-semibold text-gray-900 dark:text-white">
              {this.props.fallbackTitle ?? '视图渲染遇到了点小问题'}
            </h3>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 max-w-md">
              转换结果展示时出现异常，这通常是由文件内容中的特殊字符引起的。
              我们的底层引擎仍然安全运行，您可以重试或查看错误详情。
            </p>

            {/* 错误详情（可折叠） */}
            {this.state.error && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="w-full max-w-md overflow-hidden"
              >
                <div className="rounded-[12px] bg-gray-100/80 dark:bg-gray-800/80 p-4">
                  <pre className="text-[11px] font-mono text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-all max-h-[120px] overflow-y-auto text-left">
                    {this.state.error.message}
                  </pre>
                </div>
              </motion.div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-3 mt-2">
              <button
                onClick={this.handleReset}
                className="rounded-[10px] bg-[#007AFF] px-6 py-2.5 text-[14px] font-medium text-white hover:brightness-[1.15] active:brightness-[0.85] transition-all dark:bg-[#0A84FF]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block mr-1.5 -mt-0.5">
                  <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                </svg>
                重试渲染
              </button>
              <button
                onClick={this.handleCopyError}
                className="rounded-[10px] bg-gray-100 dark:bg-gray-800 px-4 py-2.5 text-[14px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block mr-1.5 -mt-0.5">
                  <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                复制错误日志
              </button>
            </div>
          </div>
        </motion.div>
      )
    }

    return this.props.children
  }
}
