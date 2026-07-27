/**
 * Worker Pool — manages a pool of background workers for concurrent conversions.
 *
 * Architecture note (per Phase 1 optimization):
 * - Rust native workers: Heavy lifting (FFmpeg, Sharp, Pandoc) → runs on Rust threads
 * - Web Workers: Lightweight data parsing only (JSON, CSV, YAML, Markdown AST)
 */

export interface PoolWorker {
  id: string
  busy: boolean
  terminate(): void
}

export class WorkerPool {
  private workers: PoolWorker[] = []
  private maxWorkers: number
  private queue: Array<{ task: () => Promise<unknown>; resolve: (v: unknown) => void; reject: (e: Error) => void }> = []

  constructor(maxWorkers = navigator.hardwareConcurrency || 4) {
    this.maxWorkers = Math.min(maxWorkers, 8)
    this.initWorkers()
  }

  /** Initialize the worker pool with real workers */
  private initWorkers(): void {
    for (let i = 0; i < this.maxWorkers; i++) {
      this.workers.push({
        id: `worker-${i}`,
        busy: false,
        terminate: () => { /* no-op for now */ },
      })
    }
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    const worker = this.getAvailableWorker()
    if (worker) {
      worker.busy = true
      try {
        return await task()
      } finally {
        worker.busy = false
        this.processQueue()
      }
    }
    // Queue if all workers busy
    return new Promise((resolve, reject) => {
      this.queue.push({ task: task as () => Promise<unknown>, resolve: resolve as (v: unknown) => void, reject })
    })
  }

  private getAvailableWorker(): PoolWorker | undefined {
    return this.workers.find((w) => !w.busy)
  }

  private processQueue(): void {
    const next = this.queue.shift()
    if (next) {
      this.run(next.task).then(next.resolve).catch(next.reject)
    }
  }

  get stats() {
    return {
      total: this.workers.length,
      busy: this.workers.filter((w) => w.busy).length,
      queued: this.queue.length,
    }
  }
}
