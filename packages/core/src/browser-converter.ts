/**
 * Browser-based format converter.
 * Runs entirely in the browser — no backend needed.
 *
 * Supported conversions:
 * - Data: JSON ↔ CSV, JSON ↔ YAML, JSON ↔ TOML, JSON ↔ XML
 * - Document: Markdown ↔ HTML
 */

// ── Data Conversions ──

/** Safe JSON parse — returns fallback on invalid input */
function safeJsonParse<T = unknown>(json: string): { ok: true; data: T } | { ok: false } {
  try {
    const data = JSON.parse(json) as T
    return { ok: true, data }
  } catch {
    return { ok: false }
  }
}

function csvToJson(csv: string): string {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return '[]'
  const headers = lines[0]!.split(',').map((h) => h.trim())
  const result = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]!.split(',').map((v) => v.trim())
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => { obj[h] = values[idx] ?? '' })
    result.push(obj)
  }
  return JSON.stringify(result, null, 2)
}

function jsonToCsv(json: string): string {
  const parsed = safeJsonParse<unknown>(json)
  if (!parsed.ok) throw new Error('JSON 解析失败')
  const data = parsed.data
  const arr = Array.isArray(data) ? data : [data]
  if (arr.length === 0) return ''
  const keys = [...new Set(arr.flatMap(Object.keys))]
  const lines = [keys.join(',')]
  for (const item of arr) {
    lines.push(keys.map((k) => String(item[k] ?? '')).join(','))
  }
  return lines.join('\n')
}

function jsonToYaml(json: string): string {
  const parsed = safeJsonParse<unknown>(json)
  if (!parsed.ok) throw new Error('JSON 解析失败')
  const data = parsed.data
  function toYaml(obj: unknown, indent = 0): string {
    const pad = '  '.repeat(indent)
    if (obj === null) return 'null\n'
    if (typeof obj === 'string') {
      // Escape quotes and special chars
      if (obj.includes(':') || obj.includes('#') || obj.includes("'") || obj === '') {
        return `"${obj.replace(/"/g, '\\"')}"\n`
      }
      return `${obj}\n`
    }
    if (typeof obj === 'number' || typeof obj === 'boolean') return `${obj}\n`
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]\n'
      return obj.map((item) => `${pad}- ${toYaml(item, indent + 1).trimStart()}`).join('')
    }
    if (typeof obj === 'object') {
      const entries = Object.entries(obj as Record<string, unknown>)
      if (entries.length === 0) return '{}\n'
      return entries.map(([k, v]) => `${pad}${k}: ${toYaml(v, indent + 1).trimStart()}`).join('')
    }
    return ''
  }
  return toYaml(data)
}

function yamlToJson(yaml: string): string {
  // Basic YAML to JSON — works for flat and simple nested structures
  const lines = yaml.trim().split('\n')
  const result: Record<string, unknown> = {}
  let currentKey = ''
  let currentIndent = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // Array item
    if (trimmed.startsWith('- ')) {
      if (!result[currentKey] || !Array.isArray(result[currentKey])) {
        result[currentKey] = []
      }
      ;(result[currentKey] as unknown[]).push(trimmed.slice(2))
      continue
    }

    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue

    const key = trimmed.slice(0, colonIdx).trim()
    let value = trimmed.slice(colonIdx + 1).trim()

    if (value === '' || value === '|' || value === '>') {
      currentKey = key
      currentIndent = line.search(/\S/)
      result[key] = {}
      continue
    }

    // Parse YAML value
    if (value === 'null' || value === '~') result[key] = null
    else if (value === 'true') result[key] = true
    else if (value === 'false') result[key] = false
    else if (/^\d+$/.test(value)) result[key] = parseInt(value)
    else if (/^\d+\.\d+$/.test(value)) result[key] = parseFloat(value)
    else {
      // Remove surrounding quotes
      value = value.replace(/^["']|["']$/g, '')
      result[key] = value
    }
  }
  return JSON.stringify(result, null, 2)
}

function jsonToToml(json: string): string {
  const parsed = safeJsonParse<unknown>(json)
  if (!parsed.ok) throw new Error('JSON 解析失败')
  const data = parsed.data
  function toToml(obj: unknown, prefix = ''): string {
    if (typeof obj !== 'object' || obj === null) return ''
    const entries = Object.entries(obj as Record<string, unknown>)
    let result = ''
    for (const [k, v] of entries) {
      const key = prefix ? `${prefix}.${k}` : k
      if (v === null) result += `${key} = "null"\n`
      else if (typeof v === 'string') result += `${key} = "${v.replace(/"/g, '\\"')}"\n`
      else if (typeof v === 'number' || typeof v === 'boolean') result += `${key} = ${v}\n`
      else if (Array.isArray(v)) result += `${key} = ${JSON.stringify(v)}\n`
      else if (typeof v === 'object') result += `\n[${key}]\n${toToml(v, key)}`
    }
    return result
  }
  return toToml(data)
}

function jsonToXml(json: string): string {
  const parsed = safeJsonParse<unknown>(json)
  if (!parsed.ok) throw new Error('JSON 解析失败')
  const data = parsed.data
  function toXml(obj: unknown, tag = 'root'): string {
    if (obj === null) return `<${tag} null="true"/>\n`
    if (typeof obj === 'string') return `<${tag}>${obj.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</${tag}>\n`
    if (typeof obj === 'number' || typeof obj === 'boolean') return `<${tag}>${obj}</${tag}>\n`
    if (Array.isArray(obj)) return obj.map((item) => toXml(item, tag)).join('')
    if (typeof obj === 'object') {
      let xml = ''
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        xml += toXml(v, k)
      }
      return xml ? `<${tag}>\n${xml}</${tag}>\n` : `<${tag}/>\n`
    }
    return ''
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + toXml(data)
}

// ── Document Conversion ──

function markdownToHtml(md: string): string {
  // Simple markdown to HTML converter
  let html = md
    // Headings
    .replace(/^###### (.+)$/gm, '<h6>$1</h6>')
    .replace(/^##### (.+)$/gm, '<h5>$1</h5>')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    // Images
    .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" />')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr />')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br />')

  html = `<p>${html}</p>`
  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Converted</title></head><body>${html}</body></html>`
}

function htmlToMarkdown(html: string): string {
  const md = html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<code>(.*?)<\/code>/gi, '`$1`')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![image]($1)')
    .replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return md
}

// ── Markdown → JSON (extract structure) ──

function markdownToJson(md: string): string {
  const result: { title?: string; headings: { level: number; text: string }[]; paragraphs: string[]; lists: string[][] } = {
    headings: [], paragraphs: [], lists: [],
  }
  let currentList: string[] = []
  for (const line of md.split('\n')) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      if (currentList.length) { result.lists.push(currentList); currentList = [] }
      const level = headingMatch[1]!.length
      const text = headingMatch[2]!.trim()
      result.headings.push({ level, text })
      if (level === 1 && !result.title) result.title = text
      continue
    }
    const listMatch = line.match(/^(\s*)[-*+]\s+(.+)/)
    if (listMatch) {
      currentList.push(listMatch[2]!.trim())
      continue
    }
    if (currentList.length) { result.lists.push(currentList); currentList = [] }
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      result.paragraphs.push(trimmed)
    }
  }
  if (currentList.length) result.lists.push(currentList)
  return JSON.stringify(result, null, 2)
}

// ── Main Converter ──

export type ConverterId = 'json->csv' | 'csv->json' | 'json->yaml' | 'yaml->json'
  | 'json->toml' | 'json->xml' | 'markdown->html' | 'html->markdown' | 'markdown->json'
  | 'txt->markdown' | 'txt->json'

const txtToMarkdown = (txt: string) => txt
const txtToJson = (txt: string) => {
  const lines = txt.split('\n').filter(l => l.trim())
  const obj = { lines, totalLines: lines.length, characterCount: txt.length }
  return JSON.stringify(obj, null, 2)
}

const CONVERTERS: Record<ConverterId, (input: string) => string> = {
  'json->csv': jsonToCsv,
  'csv->json': csvToJson,
  'json->yaml': jsonToYaml,
  'yaml->json': yamlToJson,
  'json->toml': jsonToToml,
  'json->xml': jsonToXml,
  'markdown->html': markdownToHtml,
  'html->markdown': htmlToMarkdown,
  'markdown->json': markdownToJson,
  'txt->markdown': txtToMarkdown,
  'txt->json': txtToJson,
}

export const SUPPORTED_BROWSER_CONVERSIONS: Record<string, string[]> = {
  json: ['csv', 'yaml', 'toml', 'xml'],
  csv: ['json'],
  yaml: ['json'],
  markdown: ['html', 'json'],
  html: ['markdown'],
  txt: ['markdown', 'json'],
}

export function getConverterId(source: string, target: string): ConverterId | null {
  const id = `${source}->${target}` as ConverterId
  return id in CONVERTERS ? id : null
}

export function isBrowserConvertible(source: string, target: string): boolean {
  return getConverterId(source, target) !== null
}

export function convertInBrowser(fileContent: string, source: string, target: string): string {
  const converterId = getConverterId(source, target)
  if (!converterId) throw new Error(`不支持的浏览器内转换: ${source} → ${target}`)
  return CONVERTERS[converterId]!(fileContent)
}

export function getOutputExtension(format: string): string {
  const extMap: Record<string, string> = {
    json: 'json', csv: 'csv', tsv: 'tsv', yaml: 'yaml', yml: 'yaml',
    toml: 'toml', xml: 'xml', markdown: 'md', html: 'html',
    txt: 'txt', sql: 'sql', ini: 'ini',
    png: 'png', jpeg: 'jpg', jpg: 'jpg', webp: 'webp',
    gif: 'gif', bmp: 'bmp', ico: 'ico', svg: 'svg',
    pdf: 'pdf', docx: 'docx', pptx: 'pptx', xlsx: 'xlsx',
  }
  return extMap[format] ?? format
}
