import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
    setupFiles: ['./src/test/vitest-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      thresholds: {
        statements: 98,
        branches: 98,
        functions: 98,
        lines: 98,
      },
    },
  },
})
