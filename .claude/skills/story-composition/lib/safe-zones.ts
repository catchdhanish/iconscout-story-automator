/**
 * Instagram Story Safe Zone Constants and Utilities
 *
 * Provides exact safe zone coordinates and helper functions for Instagram Story
 * composition. Safe zones ensure content doesn't get obscured by Instagram's UI.
 *
 * @module safe-zones
 */

/**
 * Instagram Story canvas and safe zone specifications
 */
export const INSTAGRAM_STORY = {
  /** Canvas width in pixels */
  WIDTH: 1080,

  /** Canvas height in pixels */
  HEIGHT: 1920,

  /** Aspect ratio (9:16) */
  ASPECT_RATIO: 9 / 16,

  /** Safe zones where Instagram overlays UI */
  SAFE_ZONES: {
    /** Top safe zone (profile, timestamp) */
    TOP: 250,
    /** Bottom safe zone (interaction buttons) */
    BOTTOM: 180
  },

  /** Center 70% area reserved for main asset */
  ASSET_ZONE: {
    /** Asset zone width (70% of 1080) */
    WIDTH: 756,
    /** Asset zone height (70% of 1920) */
    HEIGHT: 1344,
    /** X offset from left edge */
    X_OFFSET: 162, // (1080 - 756) / 2
    /** Y offset from top edge */
    Y_OFFSET: 288  // (1920 - 1344) / 2
  }
} as const;

/**
 * Rectangle representing a region on the canvas
 */
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Get the asset safe zone as a rectangle
 *
 * @returns Rectangle representing the center 70% safe zone for assets
 *
 * @example
 * ```typescript
 * const zone = getAssetSafeZone();
 * console.log(zone); // { x: 162, y: 288, width: 756, height: 1344 }
 * ```
 */
export function getAssetSafeZone(): Rectangle {
  return {
    x: INSTAGRAM_STORY.ASSET_ZONE.X_OFFSET,
    y: INSTAGRAM_STORY.ASSET_ZONE.Y_OFFSET,
    width: INSTAGRAM_STORY.ASSET_ZONE.WIDTH,
    height: INSTAGRAM_STORY.ASSET_ZONE.HEIGHT
  };
}

/**
 * Get the top UI safe zone as a rectangle
 *
 * @returns Rectangle representing the top safe zone (profile, timestamp)
 */
export function getTopSafeZone(): Rectangle {
  return {
    x: 0,
    y: 0,
    width: INSTAGRAM_STORY.WIDTH,
    height: INSTAGRAM_STORY.SAFE_ZONES.TOP
  };
}

/**
 * Get the bottom UI safe zone as a rectangle
 *
 * @returns Rectangle representing the bottom safe zone (interaction buttons)
 */
export function getBottomSafeZone(): Rectangle {
  return {
    x: 0,
    y: INSTAGRAM_STORY.HEIGHT - INSTAGRAM_STORY.SAFE_ZONES.BOTTOM,
    width: INSTAGRAM_STORY.WIDTH,
    height: INSTAGRAM_STORY.SAFE_ZONES.BOTTOM
  };
}

/**
 * Check if a rectangle is fully contained within the asset safe zone
 *
 * @param x - X coordinate of rectangle
 * @param y - Y coordinate of rectangle
 * @param width - Width of rectangle
 * @param height - Height of rectangle
 * @returns True if rectangle fits within asset safe zone
 *
 * @example
 * ```typescript
 * const fits = isInAssetSafeZone(162, 288, 756, 1344);
 * console.log(fits); // true (exactly fills safe zone)
 *
 * const tooBig = isInAssetSafeZone(0, 0, 1080, 1920);
 * console.log(tooBig); // false (exceeds safe zone)
 * ```
 */
export function isInAssetSafeZone(
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  const zone = getAssetSafeZone();

  return (
    x >= zone.x &&
    y >= zone.y &&
    x + width <= zone.x + zone.width &&
    y + height <= zone.y + zone.height
  );
}

/**
 * Check if a rectangle overlaps with the top or bottom UI safe zones
 *
 * @param x - X coordinate of rectangle
 * @param y - Y coordinate of rectangle
 * @param width - Width of rectangle
 * @param height - Height of rectangle
 * @returns True if rectangle overlaps with UI safe zones (should be avoided)
 *
 * @example
 * ```typescript
 * const overlaps = overlapsUISafeZones(0, 0, 100, 300);
 * console.log(overlaps); // true (overlaps top safe zone)
 * ```
 */
export function overlapsUISafeZones(
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  const top = getTopSafeZone();
  const bottom = getBottomSafeZone();

  // Check overlap with top safe zone
  const overlapsTop =
    x < top.x + top.width &&
    x + width > top.x &&
    y < top.y + top.height &&
    y + height > top.y;

  // Check overlap with bottom safe zone
  const overlapsBottom =
    x < bottom.x + bottom.width &&
    x + width > bottom.x &&
    y < bottom.y + bottom.height &&
    y + height > bottom.y;

  return overlapsTop || overlapsBottom;
}

/**
 * Calculate the usable content area (excluding UI safe zones)
 *
 * @returns Rectangle representing the area safe from UI overlays
 */
export function getContentSafeArea(): Rectangle {
  return {
    x: 0,
    y: INSTAGRAM_STORY.SAFE_ZONES.TOP,
    width: INSTAGRAM_STORY.WIDTH,
    height: INSTAGRAM_STORY.HEIGHT - INSTAGRAM_STORY.SAFE_ZONES.TOP - INSTAGRAM_STORY.SAFE_ZONES.BOTTOM
  };
}

/**
 * Validate that dimensions match Instagram Story requirements
 *
 * @param width - Canvas width
 * @param height - Canvas height
 * @returns True if dimensions are correct
 */
export function isValidStoryDimensions(width: number, height: number): boolean {
  return width === INSTAGRAM_STORY.WIDTH && height === INSTAGRAM_STORY.HEIGHT;
}

/**
 * Calculate percentage of canvas for a given pixel dimension
 *
 * @param pixels - Pixel dimension
 * @param dimension - 'width' or 'height'
 * @returns Percentage of canvas (0-100)
 */
export function pixelsToPercentage(
  pixels: number,
  dimension: 'width' | 'height'
): number {
  const total = dimension === 'width' ? INSTAGRAM_STORY.WIDTH : INSTAGRAM_STORY.HEIGHT;
  return (pixels / total) * 100;
}

/**
 * Convert percentage to pixels
 *
 * @param percentage - Percentage (0-100)
 * @param dimension - 'width' or 'height'
 * @returns Pixel value
 */
export function percentageToPixels(
  percentage: number,
  dimension: 'width' | 'height'
): number {
  const total = dimension === 'width' ? INSTAGRAM_STORY.WIDTH : INSTAGRAM_STORY.HEIGHT;
  return Math.round((percentage / 100) * total);
}
