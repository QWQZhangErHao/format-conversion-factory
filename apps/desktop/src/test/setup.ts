import '@testing-library/jest-dom'

// Suppress framer-motion / jsdom compatibility warnings
// framer-motion uses CSSStyleDeclaration APIs that are not fully implemented in jsdom
const originalConsoleError = console.error
console.error = (...args: unknown[]) => {
  const message = typeof args[0] === 'string' ? args[0] : ''
  if (
    message.includes('undefined is not a string') ||
    message.includes('@asamuzakjp') ||
    message.includes('CSSStyleDeclaration') ||
    message.includes('Motion')
  ) {
    return
  }
  originalConsoleError.call(console, ...args)
}

// Catch unhandled errors from framer-motion animation frame processing
process.on('uncaughtException', (err) => {
  if (
    err.message?.includes('undefined is not a string') ||
    err.message?.includes('CSSStyleDeclaration')
  ) {
    return
  }
  console.error('Uncaught Exception:', err)
})
