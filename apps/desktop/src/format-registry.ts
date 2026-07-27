/**
 * 格式注册表 — 单一事实源 (SSOT)
 *
 * 所有格式定义、分类、显示名称集中在此文件。
 * App.tsx、FormatSelector.tsx 等组件从此导入，消除重复定义。
 */

export type FormatTab = 'document' | 'image' | 'data'

export interface FormatEntry {
  id: string
  name: string
  extensions: string[]
  tab: FormatTab
}

export const FORMAT_TABS: { value: FormatTab; label: string }[] = [
  { value: 'document', label: '文档' },
  { value: 'image', label: '图片' },
  { value: 'data', label: '数据' },
]

export const FORMAT_REGISTRY: Record<string, FormatEntry> = {
  // ── 文档 ──
  markdown: { id: 'markdown', name: 'Markdown', extensions: ['.md', '.mdx'], tab: 'document' },
  html: { id: 'html', name: 'HTML', extensions: ['.html', '.htm'], tab: 'document' },
  pdf: { id: 'pdf', name: 'PDF', extensions: ['.pdf'], tab: 'document' },
  docx: { id: 'docx', name: 'Word', extensions: ['.docx'], tab: 'document' },
  txt: { id: 'txt', name: '纯文本', extensions: ['.txt'], tab: 'document' },
  rtf: { id: 'rtf', name: 'RTF', extensions: ['.rtf'], tab: 'document' },
  epub: { id: 'epub', name: 'EPUB', extensions: ['.epub'], tab: 'document' },
  pptx: { id: 'pptx', name: 'PowerPoint', extensions: ['.pptx'], tab: 'document' },
  xlsx: { id: 'xlsx', name: 'Excel', extensions: ['.xlsx'], tab: 'document' },

  // ── 图片 ──
  png: { id: 'png', name: 'PNG', extensions: ['.png'], tab: 'image' },
  jpeg: { id: 'jpeg', name: 'JPEG', extensions: ['.jpg', '.jpeg', '.jfif'], tab: 'image' },
  webp: { id: 'webp', name: 'WebP', extensions: ['.webp'], tab: 'image' },
  svg: { id: 'svg', name: 'SVG', extensions: ['.svg'], tab: 'image' },
  gif: { id: 'gif', name: 'GIF', extensions: ['.gif'], tab: 'image' },
  ico: { id: 'ico', name: 'ICO', extensions: ['.ico'], tab: 'image' },
  bmp: { id: 'bmp', name: 'BMP', extensions: ['.bmp'], tab: 'image' },
  tiff: { id: 'tiff', name: 'TIFF', extensions: ['.tiff', '.tif'], tab: 'image' },
  avif: { id: 'avif', name: 'AVIF', extensions: ['.avif'], tab: 'image' },
  heic: { id: 'heic', name: 'HEIC', extensions: ['.heic', '.heif'], tab: 'image' },

  // ── 数据 ──
  json: { id: 'json', name: 'JSON', extensions: ['.json'], tab: 'data' },
  csv: { id: 'csv', name: 'CSV', extensions: ['.csv'], tab: 'data' },
  yaml: { id: 'yaml', name: 'YAML', extensions: ['.yaml', '.yml'], tab: 'data' },
  xml: { id: 'xml', name: 'XML', extensions: ['.xml', '.xsd', '.xslt'], tab: 'data' },
  toml: { id: 'toml', name: 'TOML', extensions: ['.toml'], tab: 'data' },
  ini: { id: 'ini', name: 'INI', extensions: ['.ini', '.cfg'], tab: 'data' },
  sql: { id: 'sql', name: 'SQL', extensions: ['.sql'], tab: 'data' },
  tsv: { id: 'tsv', name: 'TSV', extensions: ['.tsv'], tab: 'data' },
}

export const FORMAT_BY_TAB: Record<FormatTab, string[]> = {
  document: ['markdown', 'html', 'pdf', 'docx', 'txt', 'rtf', 'epub', 'pptx', 'xlsx'],
  image: ['png', 'jpeg', 'webp', 'svg', 'gif', 'bmp', 'tiff', 'avif', 'heic'],
  data: ['json', 'csv', 'yaml', 'xml', 'toml', 'ini', 'sql', 'tsv'],
}

export function detectFormat(fileName: string): string | null {
  const ext = '.' + fileName.split('.').pop()?.toLowerCase()
  for (const [, fmt] of Object.entries(FORMAT_REGISTRY)) {
    if (fmt.extensions.includes(ext)) return fmt.id
  }
  return null
}

export function getFormatName(formatId: string | null): string {
  if (!formatId) return ''
  return FORMAT_REGISTRY[formatId]?.name ?? formatId
}
