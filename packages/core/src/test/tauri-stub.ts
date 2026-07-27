/**
 * Stub for optional external packages in dev/test environment.
 * These packages are loaded dynamically and may not be installed.
 */

// Tauri API stubs
export const invoke = async () => { throw new Error('Tauri not available') }
export const listen = async () => { return () => {} }

// Tauri window API stub (window controls)
export class LogicalPosition {
  constructor(_x: number, _y: number) {}
}
export class LogicalSize {
  constructor(_w: number, _h: number) {}
}
export class PhysicalPosition {
  constructor(_x: number, _y: number) {}
}
export class PhysicalSize {
  constructor(_w: number, _h: number) {}
}
class WindowStub {
  async minimize() {}
  async toggleMaximize() {}
  async close() {}
  async center() {}
  async setSize(_size: PhysicalSize) {}
  async setPosition(_pos: PhysicalPosition) {}
  async setTitle(_title: string) {}
}
export function getCurrentWindow() { return new WindowStub() }
export function getAllWindows() { return [] }

// ONNX Runtime Web stubs
export class InferenceSession {
  static async create() { return new InferenceSession() }
  async run() { return {} }
}
export class Tensor {
  data: Float32Array
  constructor(_type: string, data: Float32Array) { this.data = data }
}

// WebLLM stubs
export class MLCEngine {
  constructor(_config: Record<string, unknown>) {}
  async reload() {}
  chat = {
    completions: {
      create: async () => ({ choices: [{ message: { content: '' } }] }),
    },
  }
}
