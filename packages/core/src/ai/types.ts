// ── AI Module Types ──
// Core types for ML-powered document understanding & quality assessment

/** AI model execution backend */
export type AIBackend = 'webgpu' | 'webgl' | 'wasm' | 'cpu'

/** Status of an AI model */
export type ModelStatus = 'unloaded' | 'loading' | 'ready' | 'error'

/** AI model metadata */
export interface AIModelDescriptor {
  id: string
  name: string
  version: string
  sizeMB: number
  backend: AIBackend
  quantized: boolean
  description: string
}

// ── Layout Analysis (LayoutLMv3) ──

/** Types of document layout elements */
export enum LayoutElementType {
  PARAGRAPH = 'paragraph',
  HEADING = 'heading',
  SUBHEADING = 'subheading',
  CAPTION = 'caption',
  TABLE = 'table',
  LIST = 'list',
  LIST_ITEM = 'list_item',
  FIGURE = 'figure',
  FOOTER = 'footer',
  HEADER = 'header',
  PAGE_NUMBER = 'page_number',
  SIDEBAR = 'sidebar',
}

/** A single layout element detected in a document */
export interface LayoutElement {
  type: LayoutElementType
  text: string
  bbox: BoundingBox
  confidence: number
  pageNumber: number
  children?: LayoutElement[]
}

/** Bounding box coordinates (normalized 0–1) */
export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

/** Full document layout analysis result */
export interface DocumentLayout {
  pages: PageLayout[]
  metadata: LayoutMetadata
}

export interface PageLayout {
  pageNumber: number
  width: number
  height: number
  elements: LayoutElement[]
  readingOrder: LayoutElement[]
}

export interface LayoutMetadata {
  totalPages: number
  language?: string
  hasTables: boolean
  hasImages: boolean
  hasLists: boolean
  elementCount: number
  confidence: number
}

// ── Quality Assessment (LPIPS) ──

/** Quality assessment result */
export interface QualityScore {
  overall: number // 0–100, higher = better
  perceptualSimilarity: number // LPIPS score
  structuralSimilarity?: number // SSIM
  artifacts: ArtifactType[]
  details: QualityDetail
}

export interface QualityDetail {
  sharpness: number
  noise: number
  colorAccuracy: number
  compressionArtifacts: number
  textPreservation: number
}

export enum ArtifactType {
  BLOCKING = 'blocking',
  RINGING = 'ringing',
  BANDING = 'banding',
  BLUR = 'blur',
  NOISE = 'noise',
  COLOR_SHIFT = 'color_shift',
}

// ── LLM Semantic Conversion ──

export interface LLMConversionRequest {
  sourceFormat: string
  targetFormat: string
  content: string
  instructions?: string
}

export interface LLMConversionResult {
  success: boolean
  output: string
  modelUsed: string
  tokensUsed: number
  durationMs: number
}
