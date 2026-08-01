import { test, expect } from '@playwright/test'
import { addFilesViaDropZone, addFilesViaInput, fixturePath } from './helpers'

test.describe('批量转换与队列', () => {
  test('批量转换:3 个文件 → JSON,全部完成,可清除重置', async ({ page }) => {
    await page.goto('/')

    // 首个文件走 DropZone 选择器
    await addFilesViaDropZone(page, [fixturePath('sample.md')])
    await expect(page.getByText('已添加 1 个文件')).toBeVisible()

    // 追加 2 个内联 Markdown 文件 → 总数 3(setInputFiles 不能混用路径与 buffer,全部用 buffer)
    await addFilesViaInput(page, [
      { name: 'note-a.md', mimeType: 'text/markdown', buffer: Buffer.from('# 笔记 A\n\n这是第一条笔记') },
      { name: 'note-b.md', mimeType: 'text/markdown', buffer: Buffer.from('# 笔记 B\n\n这是第二条笔记') },
    ])
    await expect(page.getByText('已添加 3 个文件')).toBeVisible()

    // 3 个文件均为 Markdown → 目标 JSON(数据 tab)
    await page.getByRole('button', { name: '数据', exact: true }).click()
    await page.getByRole('button', { name: 'JSON', exact: true }).click()
    await page.getByRole('button', { name: '开始转换' }).click()

    // 全部完成:计数、下载按钮、目标格式标注
    await expect(page.getByText('3 已完成')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: '下载', exact: true })).toHaveCount(3)
    await expect(page.getByText(/→ JSON/)).toHaveCount(3)

    // 展开其中一个,校验转换出的 JSON 内容
    await page.getByText('sample.md', { exact: true }).click()
    await page.getByRole('button', { name: '对比' }).click()
    await expect(page.getByText('对比视图', { exact: true })).toBeVisible()
    await expect(page.locator('pre').nth(1)).toContainText('"title"')
    await expect(page.locator('pre').nth(1)).toContainText('格式转换工厂测试文档')

    // 清除全部 → 回到空状态
    await page.getByRole('button', { name: '清除全部' }).click()
    await expect(page.getByText('拖放文件到此处')).toBeVisible()
    await expect(page.getByText('已添加 3 个文件')).toBeHidden()
  })

  test('批量转换中格式识别:JSON/CSV/Markdown 混合队列', async ({ page }) => {
    await page.goto('/')

    await addFilesViaDropZone(page, [fixturePath('sample.md')])
    await addFilesViaInput(page, [
      fixturePath('data.json'),
      fixturePath('users.csv'),
    ])
    await expect(page.getByText('已添加 3 个文件')).toBeVisible()

    // 各自识别出正确格式
    await expect(page.getByText(/Markdown · /)).toBeVisible()
    await expect(page.getByText(/JSON · /)).toBeVisible()
    await expect(page.getByText(/CSV · /)).toBeVisible()
  })
})
