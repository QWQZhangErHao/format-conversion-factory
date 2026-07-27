/**
 * Worker Client — provides a clean promise-based API over the conversion Web Worker.
 *
 * Usage:
 *   const result = await workerClient.convert(content, 'txt', 'json')
 *   const text = await workerClient.extractDocx(buffer)
 */

import type { WorkerRequest, WorkerResponse } from './conversion.worker'

let workerPromise: Promise<Worker> | null = null
const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
let requestId = 0

async function getWorker(): Promise<Worker> {
  if (workerPromise) return workerPromise
  workerPromise = (async () => {
    let worker: Worker
    try {
      // Vite native worker import
      const { default: WorkerCtor } = await import('./conversion.worker?worker')
      worker = new WorkerCtor()
    } catch {
      // Fallback for non-Vite/test environments
      worker = new Worker(
        new URL('./conversion.worker.ts', import.meta.url),
        { type: 'module' },
      )
    }
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { id, type, data } = e.data
      const p = pending.get(id)
      if (!p) return
      pending.delete(id)
      if (type === 'error') p.reject(new Error(String(data)))
      else p.resolve(data)
    }
    worker.onerror = (err) => {
      for (const [id, p] of pending) {
        p.reject(new Error(`Worker 异常: ${err.message}`))
        pending.delete(id)
      }
    }
    return worker
  })()
  return workerPromise
}

function post<T>(type: WorkerRequest['type'], payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = `req_${++requestId}`
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
    getWorker().then((worker) => {
      worker.postMessage({ id, type, payload } satisfies WorkerRequest)
    }).catch((err) => {
      pending.delete(id)
      reject(err)
    })
  })
}

export const workerClient = {
  convert(content: string, sourceFormat: string, targetFormat: string): Promise<string> {
    return post<string>('convert', { content, sourceFormat, targetFormat })
  },
  extractDocx(buffer: ArrayBuffer): Promise<string> {
    // 使用 Transferable Objects 转移 ArrayBuffer 所有权，零拷贝
    return new Promise((resolve, reject) => {
      const id = `req_${++requestId}`
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      getWorker().then((worker) => {
        worker.postMessage({ id, type: 'extract-docx', payload: { buffer } } satisfies WorkerRequest, [buffer])
      }).catch((err) => {
        pending.delete(id)
        reject(err)
      })
    })
  },
  isConvertible(source: string, target: string): Promise<boolean> {
    return post<boolean>('is-convertible', { source, target })
  },
  terminate(): void {
    workerPromise?.then((w) => w.terminate())
    workerPromise = null
    pending.clear()
  },
}
