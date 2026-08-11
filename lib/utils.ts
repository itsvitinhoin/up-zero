import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { CSSProperties } from 'react'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Builds an inline `aspect-ratio` style for media thumbnails (images/videos)
 * from configurable width/height store settings. Returns undefined when
 * width/height are not informed, so callers can fall back to their current
 * default aspect ratio class (e.g. `aspect-3/4`).
 */
export function getMediaAspectRatioStyle(
  width?: number | null,
  height?: number | null,
): CSSProperties | undefined {
  const normalizedWidth = Number(width)
  const normalizedHeight = Number(height)

  if (!Number.isFinite(normalizedWidth) || !Number.isFinite(normalizedHeight)) return undefined
  if (normalizedWidth <= 0 || normalizedHeight <= 0) return undefined

  return { aspectRatio: `${normalizedWidth} / ${normalizedHeight}` }
}
