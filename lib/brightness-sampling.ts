/**
 * Brightness Sampling Utility
 *
 * Analyzes background brightness under text overlay area to determine
 * optimal shadow color (dark vs light) for text readability.
 */

import sharp from 'sharp';

export interface BrightnessSampleResult {
  averageBrightness: number;
  samples: number[];
}

export interface AdaptiveShadowResult {
  shadowColor: string;
  shadowType: 'dark' | 'light';
  averageBrightness: number;
  samples: number[];
}

/**
 * Sample brightness at 9 points in a 3x3 grid within the text area
 *
 * Algorithm:
 * 1. Extract text overlay region from composed image
 * 2. Sample brightness at 9 evenly distributed points
 * 3. Calculate average brightness (0-255 scale)
 *
 * @param imagePath - Path to composed story image
 * @param x - Text area left offset
 * @param y - Text area top offset
 * @param width - Text area width
 * @param height - Text area height
 * @returns Brightness sample results
 */
export async function sampleBrightness(
  imagePath: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<BrightnessSampleResult> {
  try {
    // Extract text overlay region
    const { data, info } = await sharp(imagePath)
      .extract({ left: x, top: y, width, height })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Calculate sample points in 3x3 grid
    const samplePoints = [
      { x: Math.floor(width * 0.167), y: Math.floor(height * 0.167) },
      { x: Math.floor(width * 0.5), y: Math.floor(height * 0.167) },
      { x: Math.floor(width * 0.833), y: Math.floor(height * 0.167) },
      { x: Math.floor(width * 0.167), y: Math.floor(height * 0.5) },
      { x: Math.floor(width * 0.5), y: Math.floor(height * 0.5) },
      { x: Math.floor(width * 0.833), y: Math.floor(height * 0.5) },
      { x: Math.floor(width * 0.167), y: Math.floor(height * 0.833) },
      { x: Math.floor(width * 0.5), y: Math.floor(height * 0.833) },
      { x: Math.floor(width * 0.833), y: Math.floor(height * 0.833) }
    ];

    const samples: number[] = [];

    for (const point of samplePoints) {
      const pixelIndex = (point.y * info.width + point.x) * info.channels;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];

      // Calculate perceived brightness (weighted average)
      // Formula: 0.299*R + 0.587*G + 0.114*B (ITU-R BT.601)
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      samples.push(Math.round(brightness));
    }

    const averageBrightness = samples.reduce((sum, b) => sum + b, 0) / samples.length;

    return {
      averageBrightness: Math.round(averageBrightness),
      samples
    };

  } catch (error) {
    console.error('Brightness sampling failed:', error);
    // Return neutral brightness on error
    return {
      averageBrightness: 128,
      samples: [128, 128, 128, 128, 128, 128, 128, 128, 128]
    };
  }
}

/**
 * Determine adaptive shadow color based on background brightness
 *
 * Algorithm:
 * 1. Sample brightness at 9 points in text area
 * 2. Calculate average brightness
 * 3. If average > 127.5: Use dark shadow (light background)
 * 4. If average ≤ 127.5: Use light shadow (dark background)
 *
 * @param imagePath - Path to composed story image
 * @param x - Text area left offset
 * @param y - Text area top offset
 * @param width - Text area width
 * @param height - Text area height
 * @returns Adaptive shadow configuration
 */
export async function determineAdaptiveShadow(
  imagePath: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<AdaptiveShadowResult> {
  const { averageBrightness, samples } = await sampleBrightness(imagePath, x, y, width, height);

  const shadowType = averageBrightness > 127.5 ? 'dark' : 'light';
  const shadowColor = shadowType === 'dark'
    ? 'rgba(0,0,0,0.8)'
    : 'rgba(255,255,255,0.8)';

  return {
    shadowColor,
    shadowType,
    averageBrightness,
    samples
  };
}
