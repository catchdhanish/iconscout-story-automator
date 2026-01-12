/**
 * Asset Detection Utility
 *
 * Analyzes composed images to detect asset boundaries for intelligent text positioning.
 */

import sharp from 'sharp';

/**
 * Detect the bottom edge of the asset in a composed story image
 *
 * Algorithm:
 * 1. Extract the asset zone region (756x1344px centered)
 * 2. Scan from bottom to top to find the lowest row with non-background pixels
 * 3. Use color variance to detect asset vs background
 * 4. Return Y coordinate of detected bottom edge
 *
 * @param imagePath - Path to composed story image (background + asset, 1080x1920)
 * @returns Y coordinate of asset's visual bottom edge (0 if not detected)
 */
export async function detectAssetBottomEdge(imagePath: string): Promise<number> {
  try {
    // Asset zone: 756x1344px centered at offset (162, 288)
    const assetZone = {
      left: 162,
      top: 288,
      width: 756,
      height: 1344
    };

    // Extract asset zone and convert to raw pixel data
    const { data, info } = await sharp(imagePath)
      .extract(assetZone)
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Scan from bottom to top to find lowest non-uniform row
    const width = info.width;
    const height = info.height;
    const channels = info.channels;

    // Get reference background color from corners (average of 4 corners)
    const corners = [
      { x: 10, y: 10 },
      { x: width - 10, y: 10 },
      { x: 10, y: height - 10 },
      { x: width - 10, y: height - 10 }
    ];

    let bgR = 0, bgG = 0, bgB = 0;
    for (const corner of corners) {
      const pixelIndex = (corner.y * width + corner.x) * channels;
      bgR += data[pixelIndex];
      bgG += data[pixelIndex + 1];
      bgB += data[pixelIndex + 2];
    }
    bgR /= corners.length;
    bgG /= corners.length;
    bgB /= corners.length;

    for (let y = height - 1; y >= 0; y--) {
      // Sample 5 points across the row
      const samples = [
        Math.floor(width * 0.2),
        Math.floor(width * 0.35),
        Math.floor(width * 0.5),
        Math.floor(width * 0.65),
        Math.floor(width * 0.8)
      ];

      const colors: number[][] = [];

      for (const x of samples) {
        const pixelIndex = (y * width + x) * channels;
        const r = data[pixelIndex];
        const g = data[pixelIndex + 1];
        const b = data[pixelIndex + 2];
        colors.push([r, g, b]);
      }

      // Calculate color variance across samples
      const variance = calculateColorVariance(colors);

      // Also check if colors differ significantly from background
      const diffFromBg = colors.some(([r, g, b]) => {
        const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
        return diff > 30; // Threshold for difference from background
      });

      // If variance > threshold OR colors differ from background, this row contains asset
      if (variance > 100 || diffFromBg) {
        // Convert relative Y to absolute Y in full image
        const absoluteY = assetZone.top + y;
        return absoluteY;
      }
    }

    // No asset detected (uniform background)
    return 0;

  } catch (error) {
    console.error('Asset detection failed:', error);
    return 0;
  }
}

/**
 * Calculate color variance across multiple color samples
 *
 * @param colors - Array of [r, g, b] color values
 * @returns Variance value (higher = more diverse colors)
 */
function calculateColorVariance(colors: number[][]): number {
  if (colors.length < 2) return 0;

  // Calculate average color
  const avgR = colors.reduce((sum, c) => sum + c[0], 0) / colors.length;
  const avgG = colors.reduce((sum, c) => sum + c[1], 0) / colors.length;
  const avgB = colors.reduce((sum, c) => sum + c[2], 0) / colors.length;

  // Calculate sum of squared differences
  let variance = 0;
  for (const [r, g, b] of colors) {
    variance += Math.pow(r - avgR, 2);
    variance += Math.pow(g - avgG, 2);
    variance += Math.pow(b - avgB, 2);
  }

  return variance / colors.length;
}

/**
 * Determine text position tier based on asset bottom edge
 *
 * Tiers:
 * - Tier 1 (Y=1560px): Asset bottom < 900px
 * - Tier 2 (Y=1520px): Asset bottom between 900px and 1100px
 * - Tier 3 (Y=1480px): Asset bottom > 1100px
 *
 * @param assetBottomY - Y coordinate of asset's bottom edge
 * @returns Text Y position (1560, 1520, or 1480)
 */
export function calculateTextTier(assetBottomY: number): number {
  if (assetBottomY === 0 || assetBottomY < 900) {
    return 1560; // Tier 1: Asset is high up or not detected
  } else if (assetBottomY <= 1100) {
    return 1520; // Tier 2: Asset is in middle range
  } else {
    return 1480; // Tier 3: Asset extends lower
  }
}
