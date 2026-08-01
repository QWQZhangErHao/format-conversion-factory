import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { addFilesViaDropZone, fixturePath } from './helpers'

test.describe('文档转换核心流程', () => {
  test('Markdown → HTML:添加 → 识别 → 转换 → 下载 → 对比', async ({ page }) => {
    await page.goto('/')

    // 1. 空状态通过 DropZone 添加文件
    await addFilesViaDropZone(page, [fixturePath('sample.md')])

    // 2. 文件列表出现,自动识别为 Markdown
    await expect(page.getByText('sample.md', { exact: true })).toBeVisible()
    await expect(page.getByText(/Markdown · /)).toBeVisible()
    await expect(page.getByText('已添加 1 个文件')).toBeVisible()

    // 3. 文档 tab 默认选中,直接选择目标格式 HTML
    await page.getByRole('button', { name: 'HTML', exact: true }).click()

    // 4. 开始转换
    await page.getByRole('button', { name: '开始转换' }).click()

    // 5. 转换完成:计数 + 下载按钮 + 目标格式标注
    await expect(page.getByText('1 已完成')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: '下载', exact: true })).toBeVisible()
    await expect(page.getByText(/→ HTML/)).toBeVisible()

    // 6. 展开卡片:显示大小/耗时详情
    await page.getByText('sample.md', { exact: true }).click()
    await expect(page.getByText('原始大小')).toBeVisible()
    await expect(page.getByText('结果大小')).toBeVisible()
    await expect(page.getByText('压缩率')).toBeVisible()
    await expect(page.getByText('耗时')).toBeVisible()

    // 7. 下载转换后的文件并校验内容(真实转换产物,非 mock)
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '下载转换后的文件' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('sample.html')
    const dlPath = await download.path()
    expect(dlPath).toBeTruthy()
    const content = fs.readFileSync(dlPath!, 'utf-8')
    expect(content).toContain('<h1>')
    expect(content).toContain('格式转换工厂测试文档')

    // 8. 对比视图:原始内容 vs 转换结果
    await page.getByRole('button', { name: '对比' }).click()
    await expect(page.getByText('对比视图', { exact: true })).toBeVisible()
    await expect(page.getByText('原始内容')).toBeVisible()
    await expect(page.getByText('转换结果')).toBeVisible()
  })

  test('继续添加文件:追加第二个文件,转换后计数为 2', async ({ page }) => {
    await page.goto('/')

    await addFilesViaDropZone(page, [fixturePath('sample.md')])
    await expect(page.getByText('已添加 1 个文件')).toBeVisible()

    // 文件列表出现后,通过隐藏 input 追加文件
    await page.locator('#file-input').setInputFiles([fixturePath('sample.md')])
    await expect(page.getByText('已添加 2 个文件')).toBeVisible()

    await page.getByRole('button', { name: 'HTML', exact: true }).click()
    await page.getByRole('button', { name: '开始转换' }).click()
    await expect(page.getByText('2 已完成')).toBeVisible({ timeout: 15_000 })
  })
})
