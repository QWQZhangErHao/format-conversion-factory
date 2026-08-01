import { test, expect } from '@playwright/test'

test.describe('应用加载与基础 UX', () => {
  test('空状态:标题栏 / Hero / DropZone / 页脚', async ({ page }) => {
    await page.goto('/')

    // 标题栏
    await expect(page.getByText('格式转换工厂', { exact: true })).toBeVisible()
    await expect(page.getByText('v0.2', { exact: true })).toBeVisible()

    // Hero 空状态
    await expect(page.getByRole('heading', { name: /格式转换/ })).toBeVisible()
    await expect(page.getByText('拖放文件到此处')).toBeVisible()
    await expect(page.getByText('拖放文件 · 智能识别 · 一键转换 · 极致体验')).toBeVisible()

    // 页脚
    await expect(page.getByText(/格式转换工厂 v0\.2/)).toBeVisible()
  })

  test('暗色模式切换', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    await page.getByTitle('切换暗色模式').click()
    await expect(page.locator('html')).toHaveClass(/dark/)

    await page.getByTitle('切换暗色模式').click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('日志面板可开关', async ({ page }) => {
    await page.goto('/')

    await page.getByTitle('日志').click()
    await expect(page.getByText('应用日志')).toBeVisible()

    await page.getByTitle('日志').click()
    await expect(page.getByText('应用日志')).toBeHidden()
  })
})
