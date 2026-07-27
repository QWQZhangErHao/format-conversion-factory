import { FormatCategory } from '../types'
import type { FormatDescriptor } from '../types'
import { registry } from '../registry'

/**
 * Built-in format definitions.
 * Plugins can register additional formats via the registry.
 */
export const BUILTIN_FORMATS: FormatDescriptor[] = [
  // ── Documents ──
  { id: 'markdown', name: 'Markdown', category: FormatCategory.DOCUMENT, extensions: ['.md', '.mdx'], mimeTypes: ['text/markdown'], description: 'Markdown 文档格式', previewable: true, maxSizeBytes: 10 * 1024 * 1024 },
  { id: 'html', name: 'HTML', category: FormatCategory.DOCUMENT, extensions: ['.html', '.htm'], mimeTypes: ['text/html'], description: '超文本标记语言', previewable: true, maxSizeBytes: 10 * 1024 * 1024 },
  { id: 'pdf', name: 'PDF', category: FormatCategory.DOCUMENT, extensions: ['.pdf'], mimeTypes: ['application/pdf'], description: '便携式文档格式', previewable: true, maxSizeBytes: 100 * 1024 * 1024 },
  { id: 'docx', name: 'Word 文档', category: FormatCategory.DOCUMENT, extensions: ['.docx'], mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], description: 'Microsoft Word 文档', previewable: false, maxSizeBytes: 50 * 1024 * 1024 },

  // ── Images ──
  { id: 'png', name: 'PNG', category: FormatCategory.IMAGE, extensions: ['.png'], mimeTypes: ['image/png'], description: '便携式网络图形', previewable: true, maxSizeBytes: 20 * 1024 * 1024 },
  { id: 'jpeg', name: 'JPEG', category: FormatCategory.IMAGE, extensions: ['.jpg', '.jpeg'], mimeTypes: ['image/jpeg'], description: 'JPEG 图像', previewable: true, maxSizeBytes: 20 * 1024 * 1024 },
  { id: 'webp', name: 'WebP', category: FormatCategory.IMAGE, extensions: ['.webp'], mimeTypes: ['image/webp'], description: 'WebP 图像格式', previewable: true, maxSizeBytes: 20 * 1024 * 1024 },
  { id: 'svg', name: 'SVG', category: FormatCategory.IMAGE, extensions: ['.svg'], mimeTypes: ['image/svg+xml'], description: '可缩放矢量图形', previewable: true, maxSizeBytes: 5 * 1024 * 1024 },
  { id: 'ico', name: 'ICO', category: FormatCategory.IMAGE, extensions: ['.ico'], mimeTypes: ['image/x-icon'], description: 'Windows 图标', previewable: false, maxSizeBytes: 1 * 1024 * 1024 },

  // ── Audio ──
  { id: 'mp3', name: 'MP3', category: FormatCategory.AUDIO, extensions: ['.mp3'], mimeTypes: ['audio/mpeg'], description: 'MPEG 音频层 III', previewable: false, maxSizeBytes: 50 * 1024 * 1024 },
  { id: 'wav', name: 'WAV', category: FormatCategory.AUDIO, extensions: ['.wav'], mimeTypes: ['audio/wav'], description: '波形音频', previewable: false, maxSizeBytes: 100 * 1024 * 1024 },
  { id: 'flac', name: 'FLAC', category: FormatCategory.AUDIO, extensions: ['.flac'], mimeTypes: ['audio/flac'], description: '自由无损音频编码', previewable: false, maxSizeBytes: 100 * 1024 * 1024 },
  { id: 'ogg', name: 'OGG', category: FormatCategory.AUDIO, extensions: ['.ogg'], mimeTypes: ['audio/ogg'], description: 'OGG 音频', previewable: false, maxSizeBytes: 50 * 1024 * 1024 },

  // ── Data ──
  { id: 'json', name: 'JSON', category: FormatCategory.DATA, extensions: ['.json'], mimeTypes: ['application/json'], description: 'JavaScript 对象表示法', previewable: true, maxSizeBytes: 10 * 1024 * 1024 },
  { id: 'csv', name: 'CSV', category: FormatCategory.DATA, extensions: ['.csv'], mimeTypes: ['text/csv'], description: '逗号分隔值', previewable: true, maxSizeBytes: 10 * 1024 * 1024 },
  { id: 'xml', name: 'XML', category: FormatCategory.DATA, extensions: ['.xml'], mimeTypes: ['application/xml'], description: '可扩展标记语言', previewable: true, maxSizeBytes: 10 * 1024 * 1024 },
  { id: 'yaml', name: 'YAML', category: FormatCategory.DATA, extensions: ['.yaml', '.yml'], mimeTypes: ['text/yaml'], description: 'YAML 数据格式', previewable: true, maxSizeBytes: 5 * 1024 * 1024 },
  { id: 'toml', name: 'TOML', category: FormatCategory.DATA, extensions: ['.toml'], mimeTypes: ['text/toml'], description: 'TOML 配置文件格式', previewable: true, maxSizeBytes: 5 * 1024 * 1024 },
]

/** Register all built-in formats with the registry */
export function registerBuiltinFormats(): void {
  registry.registerMany(BUILTIN_FORMATS)
}
