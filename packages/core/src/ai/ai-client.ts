/**
 * AI Client — 主线程调用 AI Worker 的桥接层。
 *
 * 封装 Worker postMessage RPC 为 Promise API。
 * 当 Comlink 可用时使用 Comlink，否则使用原生 postMessage 桥接。
 *
 * 使用示例:
 * ```ts
 * import { aiClient } from './ai-client'
 * const layout = await aiClient.analyzeDocument('# Hello', 'markdown')
 * ```
 */

import type { AIWorkerAPI } from './ai.worker'

type RpcCallback = (result: unknown) => void
type RpcErrorCallback = (error: string) => void

let worker: Worker | null = null
let requestId = 0
const pending = new Map<number, { resolve: RpcCallback; reject: RpcErrorCallback }>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      /* @vite-ignore */ new URL('./ai.worker.ts', import.meta.url),
      { type: 'module' },
    )

    worker.onmessage = (event: MessageEvent) => {
      const { id, result, error } = event.data
      const pending_call = pending.get(id)
      if (!pending_call) return

      pending.delete(id)
      if (error) {
        pending_call.reject(error)
      } else {
        pending_call.resolve(result)
      }
    }

    worker.onerror = (event) => {
      console.error('[AI Worker] 未捕获错误:', event.message)
    }
  }
  return worker
}

async function rpcCall(method: keyof AIWorkerAPI, ...args: unknown[]): Promise<unknown> {
  const id = ++requestId
  const w = getWorker()

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    w.postMessage({ id, method, args })

    // 30 秒超时保护
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error(`AI Worker 调用超时: ${method}`))
      }
    }, 30000)
  })
}

export const aiClient: AIWorkerAPI = {
  async analyzeDocument(content, format) {
    return rpcCall('analyzeDocument', content, format)
  },

  async scoreQuality(originalPath, convertedPath, format) {
    return rpcCall('scoreQuality', originalPath, convertedPath, format)
  },

  async llmConvert(sourceFormat, targetFormat, content) {
    return rpcCall('llmConvert', sourceFormat, targetFormat, content)
  },

  async healthCheck() {
    return rpcCall('healthCheck')
  },
}

/** 终止 Worker 释放资源 */
export function terminateAIWorker(): void {
  if (worker) {
    worker.terminate()
    worker = null
    pending.clear()
  }
}
