import type { FormatDescriptor, FormatId } from '../types'
import type { FormatCategory } from '../types'

/**
 * Format registry — the single source of truth for all supported formats.
 * Follows the Registry pattern: centralized lookup with lazy plugin registration.
 */
class FormatRegistry {
  private formats = new Map<FormatId, FormatDescriptor>()

  register(format: FormatDescriptor): void {
    if (this.formats.has(format.id)) {
      console.warn(`[Registry] Format "${format.id}" is already registered. Overwriting.`)
    }
    this.formats.set(format.id, format)
  }

  registerMany(formats: FormatDescriptor[]): void {
    for (const f of formats) this.register(f)
  }

  get(id: FormatId): FormatDescriptor | undefined {
    return this.formats.get(id)
  }

  getAll(): FormatDescriptor[] {
    return Array.from(this.formats.values())
  }

  getByCategory(category: FormatCategory): FormatDescriptor[] {
    return this.getAll().filter((f) => f.category === category)
  }

  /** Check if a conversion path exists between two formats */
  canConvert(source: FormatId, target: FormatId): boolean {
    // 实际转换能力由 browser-converter.ts 的 CONVERTERS 和 Rust 后端插件决定
    // 此方法仅检查格式是否已被注册，不保证有对应的转换器
    const bothExist = this.formats.has(source) && this.formats.has(target)
    if (!bothExist) return false
    // 同一格式无需转换，但视为可转换（自身兼容）
    if (source === target) return true
    return true
  }

  /** Find all formats that can be converted from a given format */
  getConvertibleTargets(source: FormatId): FormatDescriptor[] {
    // TODO: Check registered plugins for actual conversion capability
    return this.getAll().filter((f) => f.id !== source)
  }
}

export const registry = new FormatRegistry()
export type { FormatRegistry }
