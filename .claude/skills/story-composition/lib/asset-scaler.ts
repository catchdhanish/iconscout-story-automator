/**
 * Asset Scaling Logic for Instagram Stories
 *
 * Calculates scaled dimensions and position for assets to fit within the
 * Instagram Story asset safe zone (center 70%) while preserving aspect ratio.
 *
 * @module asset-scaler
 */

import { INSTAGRAM_STORY } from './safe-zones';

/**
 * Scaled asset dimensions and position
 */
export interface ScaledAsset {
  /** Scaled width in pixels */
  width: number;
  /** Scaled height in pixels */
  height: number;
  /** X coordinate (left edge) */
  x: number;
  /** Y coordinate (top edge) */
  y: number;
  /** Original aspect ratio */
  originalAspectRatio: number;
  /** Scale factor applied */
  scaleFactor: number;
}

/**
 * Calculate scaled dimensions and centered position for an asset
 *
 * Assets are scaled to fit within the asset safe zone (756x1344px) while
 * preserving aspect ratio. The scaled asset is then centered within the safe zone.
 *
 * **Scaling Logic**:
 * - Landscape assets (width > height): Scale by width
 * - Portrait/Square assets: Scale by height, clamping width if needed
 * - Always preserve aspect ratio
 * - Center within safe zone
 *
 * @param assetWidth - Original asset width in pixels
 * @param assetHeight - Original asset height in pixels
 * @param maxWidth - Maximum width (defaults to asset safe zone width)
 * @param maxHeight - Maximum height (defaults to asset safe zone height)
 * @returns Scaled dimensions and position
 *
 * @example
 * ```typescript
 * // Landscape asset (1200x800)
 * const scaled = calculateAssetDimensions(1200, 800);
 * // Result: { width: 756, height: 504, x: 162, y: 708 }
 *
 * // Portrait asset (600x1000)
 * const scaled = calculateAssetDimensions(600, 1000);
 * // Result: { width: 453, height: 755, x: 313, y: 583 }
 *
 * // Square asset (800x800)
 * const scaled = calculateAssetDimensions(800, 800);
 * // Result: { width: 756, height: 756, x: 162, y: 582 }
 * ```
 */
export function calculateAssetDimensions(
  assetWidth: number,
  assetHeight: number,
  maxWidth: number = INSTAGRAM_STORY.ASSET_ZONE.WIDTH,
  maxHeight: number = INSTAGRAM_STORY.ASSET_ZONE.HEIGHT
): ScaledAsset {
  const X_OFFSET = INSTAGRAM_STORY.ASSET_ZONE.X_OFFSET;
  const Y_OFFSET = INSTAGRAM_STORY.ASSET_ZONE.Y_OFFSET;

  // Calculate aspect ratios
  const assetAspectRatio = assetWidth / assetHeight;
  const safeZoneAspectRatio = maxWidth / maxHeight;

  let scaledWidth: number;
  let scaledHeight: number;
  let scaleFactor: number;

  if (assetAspectRatio > safeZoneAspectRatio) {
    // Landscape asset: wider than safe zone aspect ratio
    // Scale by width to fit horizontally
    scaledWidth = maxWidth;
    scaledHeight = scaledWidth / assetAspectRatio;
    scaleFactor = scaledWidth / assetWidth;
  } else {
    // Portrait or square asset: taller than or equal to safe zone aspect ratio
    // Scale by height to fit vertically
    scaledHeight = maxHeight;
    scaledWidth = scaledHeight * assetAspectRatio;
    scaleFactor = scaledHeight / assetHeight;

    // Clamp width if it exceeds maximum (rare case)
    if (scaledWidth > maxWidth) {
      scaledWidth = maxWidth;
      scaledHeight = scaledWidth / assetAspectRatio;
      scaleFactor = scaledWidth / assetWidth;
    }
  }

  // Center within safe zone
  const x = X_OFFSET + (maxWidth - scaledWidth) / 2;
  const y = Y_OFFSET + (maxHeight - scaledHeight) / 2;

  return {
    width: Math.round(scaledWidth),
    height: Math.round(scaledHeight),
    x: Math.round(x),
    y: Math.round(y),
    originalAspectRatio: assetAspectRatio,
    scaleFactor
  };
}

/**
 * Calculate asset dimensions for a custom safe zone
 *
 * @param assetWidth - Asset width
 * @param assetHeight - Asset height
 * @param safeZone - Custom safe zone bounds
 * @returns Scaled dimensions and position within custom zone
 */
export function calculateAssetDimensionsCustomZone(
  assetWidth: number,
  assetHeight: number,
  safeZone: { x: number; y: number; width: number; height: number }
): ScaledAsset {
  const scaled = calculateAssetDimensions(
    assetWidth,
    assetHeight,
    safeZone.width,
    safeZone.height
  );

  // Adjust position to custom zone offset
  return {
    ...scaled,
    x: safeZone.x + (scaled.x - INSTAGRAM_STORY.ASSET_ZONE.X_OFFSET),
    y: safeZone.y + (scaled.y - INSTAGRAM_STORY.ASSET_ZONE.Y_OFFSET)
  };
}

/**
 * Determine if an asset is landscape, portrait, or square
 *
 * @param width - Asset width
 * @param height - Asset height
 * @returns Asset orientation
 */
export function getAssetOrientation(
  width: number,
  height: number
): 'landscape' | 'portrait' | 'square' {
  const aspectRatio = width / height;

  if (Math.abs(aspectRatio - 1.0) < 0.01) {
    return 'square';
  } else if (aspectRatio > 1.0) {
    return 'landscape';
  } else {
    return 'portrait';
  }
}

/**
 * Calculate scale factor needed to fit asset in safe zone
 *
 * @param assetWidth - Asset width
 * @param assetHeight - Asset height
 * @returns Scale factor (1.0 = no scaling, <1.0 = scale down, >1.0 = scale up)
 */
export function calculateScaleFactor(
  assetWidth: number,
  assetHeight: number
): number {
  const scaled = calculateAssetDimensions(assetWidth, assetHeight);
  return scaled.scaleFactor;
}

/**
 * Check if asset needs to be scaled down
 *
 * @param assetWidth - Asset width
 * @param assetHeight - Asset height
 * @returns True if asset exceeds safe zone and needs scaling
 */
export function needsScaling(assetWidth: number, assetHeight: number): boolean {
  const MAX_WIDTH = INSTAGRAM_STORY.ASSET_ZONE.WIDTH;
  const MAX_HEIGHT = INSTAGRAM_STORY.ASSET_ZONE.HEIGHT;

  return assetWidth > MAX_WIDTH || assetHeight > MAX_HEIGHT;
}

/**
 * Preview dimensions for different scenarios
 *
 * Useful for displaying multiple size options to users
 *
 * @param assetWidth - Asset width
 * @param assetHeight - Asset height
 * @returns Array of preview dimensions at different scales
 */
export function generatePreviewDimensions(
  assetWidth: number,
  assetHeight: number
): Array<ScaledAsset & { label: string }> {
  const full = calculateAssetDimensions(assetWidth, assetHeight);

  return [
    { ...full, label: 'Full Size (Recommended)' },
    {
      ...calculateAssetDimensions(
        assetWidth,
        assetHeight,
        INSTAGRAM_STORY.ASSET_ZONE.WIDTH * 0.75,
        INSTAGRAM_STORY.ASSET_ZONE.HEIGHT * 0.75
      ),
      label: '75% Size'
    },
    {
      ...calculateAssetDimensions(
        assetWidth,
        assetHeight,
        INSTAGRAM_STORY.ASSET_ZONE.WIDTH * 0.5,
        INSTAGRAM_STORY.ASSET_ZONE.HEIGHT * 0.5
      ),
      label: '50% Size'
    }
  ];
}

/**
 * Validate that scaled dimensions fit within bounds
 *
 * @param scaled - Scaled asset dimensions
 * @returns True if dimensions are valid
 */
export function validateScaledDimensions(scaled: ScaledAsset): boolean {
  const MAX_WIDTH = INSTAGRAM_STORY.ASSET_ZONE.WIDTH;
  const MAX_HEIGHT = INSTAGRAM_STORY.ASSET_ZONE.HEIGHT;

  return (
    scaled.width > 0 &&
    scaled.height > 0 &&
    scaled.width <= MAX_WIDTH &&
    scaled.height <= MAX_HEIGHT
  );
}
