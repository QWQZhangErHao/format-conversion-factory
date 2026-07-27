/**
 * Browser-side WebP encoder — zero-dependency fallback for Rust image crate limitation.
 *
 * When the Rust backend's `image 0.25` only supports lossless WebP,
 * this module provides lossy WebP encoding with quality control
 * via the browser's native Canvas/OffscreenCanvas API.
 *
 * Usage:
 *   const webpBlob = await convertToWebPInBrowser(pngBlob, 0.8)
 *   // webpBlob.type === 'image/webp', quality-controlled
 */

/** Quality range: 0.0 (worst) ~ 1.0 (best). Default 0.85. */
export async function convertToWebPInBrowser(
  imageBlob: Blob,
  quality = 0.85,
): Promise<Blob> {
  const bitmap = await createImageBitmap(imageBlob)

  // Use OffscreenCanvas when available (Chrome, Edge, modern Firefox)
  let canvas: OffscreenCanvas | HTMLCanvasElement
  let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null

  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('OffscreenCanvas 2D context 创建失败')
    ctx.drawImage(bitmap, 0, 0)
    return await (canvas as OffscreenCanvas).convertToBlob({
      type: 'image/webp',
      quality: Math.max(0, Math.min(1, quality)),
    })
  }

  // Fallback: regular Canvas (older browsers)
  canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context 创建失败')
  ctx.drawImage(bitmap, 0, 0)

  return new Promise((resolve, reject) => {
    ;(canvas as HTMLCanvasElement).toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Canvas toBlob 返回 null'))
      },
      'image/webp',
      quality,
    )
  })
}

/** Check if the browser supports WebP encoding */
export function supportsWebPEncoding(): boolean {
  const canvas = document.createElement('canvas')
  return canvas.toBlob !== undefined
    && canvas.toDataURL('image/webp').indexOf('image/webp') !== -1
}

/** Check if OffscreenCanvas is available (for worker usage) */
export function supportsOffscreenCanvas(): boolean {
  return typeof OffscreenCanvas !== 'undefined'
}
