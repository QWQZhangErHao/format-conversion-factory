import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'

/** e2e/fixtures 目录的绝对路径(ESM 兼容,不依赖 __dirname) */
export const FIXTURES_DIR = fileURLToPath(new URL('./fixtures', import.meta.url))

export const fixturePath = (name: string) => `${FIXTURES_DIR}/${name}`

/**
 * 通过点击 DropZone 触发原生文件选择器来添加文件。
 * 空状态下 #file-input 尚未渲染,这是添加首个文件的方式。
 */
export async function addFilesViaDropZone(page: Page, files: string[]) {
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByText('拖放文件到此处').click()
  const chooser = await chooserPromise
  await chooser.setFiles(files)
}

/** 通过隐藏的 #file-input 添加文件(文件列表出现后可用,支持批量) */
export async function addFilesViaInput(page: Page, files: (string | { name: string; mimeType: string; buffer: Buffer })[]) {
  await page.locator('#file-input').setInputFiles(files as never)
}

/** 等待 N 个文件全部转换完成(头部计数) */
export async function waitForAllDone(page: Page, count: number) {
  await page.getByText(`${count} 已完成`).toBeVisible({ timeout: 20_000 })
}
