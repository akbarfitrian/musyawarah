/**
 * Client-side image compression: resizes and re-encodes an image as WebP
 * before it ever leaves the browser, so uploads are small and fast.
 */

export interface CompressImageOptions {
  /** Longest edge, in px, the output image will be scaled down to fit within. */
  maxDimension?: number
  /** WebP quality, 0–1. */
  quality?: number
}

const DEFAULT_MAX_DIMENSION = 1920
const DEFAULT_QUALITY = 0.8

/**
 * Compresses an image file to WebP. Animated GIFs are returned unchanged
 * (canvas-based compression would flatten them to a single frame).
 * Falls back to the original file only if compression fails outright
 * (e.g. the browser can't decode the image or draw to canvas).
 */
export async function compressImageToWebp(
  file: File,
  options: CompressImageOptions = {}
): Promise<File> {
  if (file.type === 'image/gif') return file

  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION
  const quality = options.quality ?? DEFAULT_QUALITY

  try {
    const source = await loadImageSource(file)
    const { width: srcWidth, height: srcHeight } = getSourceDimensions(source)
    const { width, height } = fitWithin(srcWidth, srcHeight, maxDimension)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    ctx.drawImage(source as CanvasImageSource, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality)
    )
    if (!blob) return file

    const newName = file.name.replace(/\.[^./\\]+$/, '') + '.webp'
    return new File([blob], newName, { type: 'image/webp' })
  } catch (err) {
    console.error('Image compression failed, using original file:', err)
    return file
  }
}

function getSourceDimensions(source: ImageBitmap | HTMLImageElement) {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight }
  }
  return { width: source.width, height: source.height }
}

function fitWithin(width: number, height: number, maxDimension: number) {
  if (width <= maxDimension && height <= maxDimension) return { width, height }
  const ratio = width > height ? maxDimension / width : maxDimension / height
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) }
}

async function loadImageSource(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file)
    } catch {
      // Some browsers/formats don't support createImageBitmap — fall back below.
    }
  }
  return loadHtmlImage(file)
}

function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (err) => {
      URL.revokeObjectURL(url)
      reject(err)
    }
    img.src = url
  })
}