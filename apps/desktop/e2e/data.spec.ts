import { test, expect } from '@playwright/test'
import { addFilesViaDropZone, fixturePath } from './helpers'

test.describe('数据格式转换', () => {
  test('JSON → YAML:切换数据 tab,转换后对比视图可见', async ({ page }) => {
    await page.goto('/')
    await addFilesViaDropZone(page, [fixturePath('data.json')])

    await expect(page.getByText('data.json', { exact: true })).toBeVisible()
    await expect(page.getByText(/JSON · /)).toBeVisible()

    // 切换到「数据」分类,选择 YAML
    await page.getByRole('button', { name: '数据', exact: true }).click()
    await page.getByRole('button', { name: 'YAML', exact: true }).click()
    await page.getByRole('button', { name: '开始转换' }).click()

    await expect(page.getByText('1 已完成')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/→ YAML/)).toBeVisible()

    // 展开 → 对比视图,右侧面板应包含转换出的 YAML 内容
    await page.getByText('data.json', { exact: true }).click()
    await page.getByRole('button', { name: '对比' }).click()
    await expect(page.getByText('对比视图', { exact: true })).toBeVisible()
    await expect(page.getByText('源文件: 12')).toBeVisible()
    await expect(page.locator('pre').nth(1)).toContainText('activeUsers: 1024')
  })

  test('CSV → JSON:转换产物包含表头结构', async ({ page }) => {
    await page.goto('/')
    await addFilesViaDropZone(page, [fixturePath('users.csv')])

    await expect(page.getByText('users.csv', { exact: true })).toBeVisible()
    await expect(page.getByText(/CSV · /)).toBeVisible()

    await page.getByRole('button', { name: '数据', exact: true }).click()
    await page.getByRole('button', { name: 'JSON', exact: true }).click()
    await page.getByRole('button', { name: '开始转换' }).click()

    await expect(page.getByText('1 已完成')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/→ JSON/)).toBeVisible()

    // 展开 → 对比,转换结果应为 JSON 对象数组(含表头字段)
    await page.getByText('users.csv', { exact: true }).click()
    await page.getByRole('button', { name: '对比' }).click()
    await expect(page.getByText('对比视图', { exact: true })).toBeVisible()
    await expect(page.getByText('源文件: 6')).toBeVisible()
    await expect(page.locator('pre').nth(1)).toContainText('"city"')
    await expect(page.locator('pre').nth(1)).toContainText('张三')
  })

  test('格式分类切换:图片 tab 展示图片格式', async ({ page }) => {
    await page.goto('/')
    await addFilesViaDropZone(page, [fixturePath('sample.md')])
    await expect(page.getByText('已添加 1 个文件')).toBeVisible()

    await page.getByRole('button', { name: '图片', exact: true }).click()
    await expect(page.getByRole('button', { name: 'PNG', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'WebP', exact: true })).toBeVisible()

    await page.getByRole('button', { name: '数据', exact: true }).click()
    await expect(page.getByRole('button', { name: 'TOML', exact: true })).toBeVisible()
  })
})
