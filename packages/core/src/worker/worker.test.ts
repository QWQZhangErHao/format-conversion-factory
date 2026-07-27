import { describe, it, expect, vi } from 'vitest'
import { WorkerPool } from './index'

describe('WorkerPool', () => {
  // Helper to create mock pool workers for testing
  const makeWorker = (id: string, busy = false) => ({
    id,
    busy,
    terminate: vi.fn(),
  })

  it('creates pool with workers initialized', () => {
    const pool = new WorkerPool(4)
    expect(pool.stats.total).toBe(4)
    expect(pool.stats.busy).toBe(0)
  })

  it('executes tasks sequentially when only one worker', async () => {
    const pool = new WorkerPool(1)

    const order: number[] = []
    const r1 = await pool.run(async () => { order.push(1); return 10 })
    const r2 = await pool.run(async () => { order.push(2); return 20 })

    expect(order).toEqual([1, 2])
    expect(r1).toBe(10)
    expect(r2).toBe(20)
  })

  it('multiple workers execute tasks in parallel', async () => {
    const pool = new WorkerPool(2)

    let concurrent = 0
    let maxConcurrent = 0

    const task = async (id: number) => {
      concurrent++
      maxConcurrent = Math.max(maxConcurrent, concurrent)
      await new Promise((r) => setTimeout(r, 50))
      concurrent--
      return id
    }

    const [r1, r2] = await Promise.all([
      pool.run(() => task(1)),
      pool.run(() => task(2)),
    ])

    expect(r1).toBe(1)
    expect(r2).toBe(2)
    expect(maxConcurrent).toBeGreaterThan(1)
  })

  it('queues tasks when all workers busy', async () => {
    const pool = new WorkerPool(1)

    let resolveSlow!: (v: number) => void
    const slowTask = () => new Promise<number>((r) => { resolveSlow = r })

    const slowPromise = pool.run(slowTask)
    const fastPromise = pool.run(async () => 42)

    expect(pool.stats.queued).toBe(1)
    resolveSlow(1)

    const [slowResult, fastResult] = await Promise.all([slowPromise, fastPromise])
    expect(slowResult).toBe(1)
    expect(fastResult).toBe(42)
  })

  it('tracks stats correctly', async () => {
    const pool = new WorkerPool(2)

    // Initial state
    expect(pool.stats.total).toBe(2)
    expect(pool.stats.busy).toBe(0)
    expect(pool.stats.queued).toBe(0)

    let resolve1!: (v: string) => void
    const task1 = () => new Promise<string>((r) => { resolve1 = r })
    let resolve2!: (v: string) => void
    const task2 = () => new Promise<string>((r) => { resolve2 = r })

    // First task — one worker busy
    const p1 = pool.run(task1)
    expect(pool.stats.busy).toBe(1)

    // Second task — both workers busy
    const p2 = pool.run(task2)
    expect(pool.stats.busy).toBe(2)

    // Third task — no workers available, goes to queue
    const p3 = pool.run(async () => 'queued')
    expect(pool.stats.queued).toBe(1)

    // Complete the blocking tasks
    resolve1('a')
    resolve2('b')

    const results = await Promise.all([p1, p2, p3])
    expect(results).toEqual(['a', 'b', 'queued'])

    // All workers free again
    expect(pool.stats.busy).toBe(0)
  })

  it('caps max workers at 8', () => {
    const pool1 = new WorkerPool(100)
    expect(pool1.stats.total).toBe(8)

    const pool2 = new WorkerPool(5)
    expect(pool2.stats.total).toBe(5)

    const pool3 = new WorkerPool()
    expect(pool3.stats.total).toBeLessThanOrEqual(8)
  })
})
