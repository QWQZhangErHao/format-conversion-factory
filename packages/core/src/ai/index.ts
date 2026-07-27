// ── AI Module ──
// SOTA paper integrations for intelligent format conversion

export * from './types'

// ONNX Runtime — quantized model inference engine
export { ONNXEngine, AI_MODELS, getModelInfo, getRecommendedBackend } from './onnx'
export type { ONNXConfig, InferenceResult, ModelRegistryEntry } from './onnx'

// LayoutLMv3 — document layout analyzer
export { LayoutAnalyzer } from './layout'
export type { AnalyzerConfig } from './layout'

// LPIPS — perceptual quality scorer
export { QualityScorer } from './quality'
export type { ScorerConfig } from './quality'

// WebLLM — semantic LLM conversion engine
export { LLMSession, LLMConverter } from './llm'
export type { LLMConfig, LLMSessionInfo, LLMModelId } from './llm'
