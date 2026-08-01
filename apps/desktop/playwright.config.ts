import { defineConfig, devices } from '@playwright/test'

/**
 * 端到端测试配置 — 针对 Vite Web 端 (apps/desktop)
 *
 * 运行方式:
 *   cd apps/desktop && pnpm test:e2e          # 本包内运行
 *   pnpm run test:e2e                         # monorepo 根目录 (turbo 调度)
 *
 * webServer 自动启动 vite dev server (端口 1420, strictPort),
 * 测试直接驱动真实浏览器执行核心转换流程。
 */
export default defineConfig({
  testDir: './e2e',
  // 每个测试文件独立并行
  fullyParallel: true,
  // CI 上重试 1 次,本地不重试
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://localhost:1420',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm run dev:web',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
