/**
 * Conversion Web Worker
 *
 * Offloads CPU-intensive conversion work from the main thread:
 * - universalConvert() IR pipeline
 * - extractDocxText() ZIP + XML parsing
 *
 * This keeps the UI thread free for Framer Motion animations at 60 FPS.
 */

import { universalConvert } from '../universal-converter'
import { isBrowserConvertible } from '../browser-converter'

// ── ZIP/XML helpers (self-contained, no DOM deps) ──

interface ZipEntry {
  name: string
  compMethod: number
  compSize: number
  uncompSize: number
  offset: number
}

function readU16(bytes: Uint8Array, pos: number): number {
  if (pos + 1 >= bytes.length) throw new RangeError('ZIP: 越界读取')
  return bytes[pos]! | (bytes[pos + 1]! << 8)
}
function readU32(bytes: Uint8Array, pos: number): number {
  if (pos + 3 >= bytes.length) throw new RangeError('ZIP: 越界读取')
  return bytes[pos]! | (bytes[pos + 1]! << 8) | (bytes[pos + 2]! << 16) | (bytes[pos + 3]! << 24)
}

async function extractDocxTextWorker(arrayBuffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(arrayBuffer)
  let i = 0
  let scanCount = 0
  const MAX_SCAN = 10000
  const entries: ZipEntry[] = []

  while (i < bytes.length - 30 && scanCount < MAX_SCAN) {
    scanCount++
    if (readU32(bytes, i) === 0x04034b50) {
      const nameLen = readU16(bytes, i + 26)
      const extraLen = readU16(bytes, i + 28)
      const compMethod = readU16(bytes, i + 8)
      const compSize = readU32(bytes, i + 18)
      const uncompSize = readU32(bytes, i + 22)
      const headerEnd = i + 30 + nameLen + extraLen
      if (headerEnd > bytes.length) throw new RangeError('ZIP: 文件头越界')
      const name = new TextDecoder().decode(bytes.slice(i + 30, i + 30 + nameLen))
      entries.push({ name, compMethod, compSize, uncompSize, offset: headerEnd })
      i = headerEnd + compSize
    } else {
      i++
    }
  }

  const docEntry = entries.find(e => e.name === 'word/document.xml')
  if (!docEntry) throw new Error('DOCX: 未找到 word/document.xml')

  let xmlBytes: Uint8Array
  if (docEntry.compMethod === 0) {
    xmlBytes = bytes.slice(docEntry.offset, docEntry.offset + docEntry.uncompSize)
  } else if (docEntry.compMethod === 8) {
    const compressed = bytes.slice(docEntry.offset, docEntry.offset + docEntry.compSize)
    const ds = new DecompressionStream('deflate-raw')
    const writer = ds.writable.getWriter()
    await writer.write(compressed)
    await writer.close()
    const reader = ds.readable.getReader()
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) chunks.push(value)
    }
    const totalLen = chunks.reduce((a, c) => a + c.length, 0)
    xmlBytes = new Uint8Array(totalLen)
    let offset = 0
    for (const chunk of chunks) { xmlBytes.set(chunk, offset); offset += chunk.length }
  } else {
    throw new Error(`DOCX: 不支持的压缩方法 ${docEntry.compMethod}`)
  }

  const xmlText = new TextDecoder().decode(xmlBytes)
  const textParts: string[] = []
  const wtRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g
  let match: RegExpExecArray | null
  while ((match = wtRegex.exec(xmlText)) !== null) {
    const text = match[1]!.trim()
    if (text) textParts.push(text)
  }
  if (textParts.length === 0) throw new Error('DOCX: 未能提取文本')
  return textParts.join('')
}

// ── Worker Message Handler ──

export interface WorkerRequest {
  id: string
  type: 'convert' | 'extract-docx' | 'is-convertible'
  payload: unknown
}

export interface WorkerResponse {
  id: string
  type: 'result' | 'error'
  data: unknown
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, type, payload } = e.data

  try {
    switch (type) {
      case 'convert': {
        const { content, sourceFormat, targetFormat } = payload as {
          content: string; sourceFormat: string; targetFormat: string
        }
        const result = universalConvert(content, sourceFormat, targetFormat)
        self.postMessage({ id, type: 'result', data: result } satisfies WorkerResponse)
        break
      }

      case 'extract-docx': {
        const { buffer } = payload as { buffer: ArrayBuffer }
        const text = await extractDocxTextWorker(buffer)
        self.postMessage({ id, type: 'result', data: text } satisfies WorkerResponse)
        break
      }

      case 'is-convertible': {
        const { source, target } = payload as { source: string; target: string }
        const result = isBrowserConvertible(source, target)
        self.postMessage({ id, type: 'result', data: result } satisfies WorkerResponse)
        break
      }

      default:
        throw new Error(`Worker: 未知消息类型 ${type}`)
    }
  } catch (err) {
    self.postMessage({ id, type: 'error', data: String(err) } satisfies WorkerResponse)
  }
}
