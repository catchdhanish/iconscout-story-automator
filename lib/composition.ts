/**
 * Story Composition Engine
 *
 * Composes Instagram Stories by layering assets onto backgrounds using Sharp.
 * Implements Instagram Story specifications with proper safe zones and positioning.
 *
 * @module compose
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { config } from './config';

/**
 * Compose an Instagram Story by layering an asset onto a background
 *
 * Takes a background image and an asset image, resizes them according to
 * Instagram Story specifications, centers the asset within the safe zone,
 * and composites them together.
 *
 * @param backgroundPath - Path to background image (will be resized to 1080x1920)
 * @param assetPath - Path to asset image (will be resized to fit 756x1344)
 * @param outputPath - Path for output file (PNG or JPEG)
 * @returns Promise resolving to the output path on success
 * @throws Error if files don't exist, formats are invalid, or processing fails
 *
 * @example
 * ```typescript
 * const result = await composeStory(
 *   '/uploads/background.png',
 *   '/uploads/asset.png',
 *   '/uploads/output.png'
 * );
 * console.log(`Story saved to: ${result}`);
 * ```
 */
export async function composeStory(
  backgroundPath: string,
  assetPath: string,
  outputPath: string
): Promise<string> {
  // 1. Validate input files exist
  try {
    await fs.access(backgroundPath);
  } catch (error) {
    throw new Error(`Background file not found: ${backgroundPath}`);
  }

  try {
    await fs.access(assetPath);
  } catch (error) {
    throw new Error(`Asset file not found: ${assetPath}`);
  }

  // 2. Validate image formats
  const supportedFormats = ['.png', '.jpg', '.jpeg'];
  const bgExt = path.extname(backgroundPath).toLowerCase();
  const assetExt = path.extname(assetPath).toLowerCase();

  if (!supportedFormats.includes(bgExt)) {
    throw new Error(
      `Unsupported background format: ${bgExt}. Supported formats: ${supportedFormats.join(', ')}`
    );
  }

  if (!supportedFormats.includes(assetExt)) {
    throw new Error(
      `Unsupported asset format: ${assetExt}. Supported formats: ${supportedFormats.join(', ')}`
    );
  }

  try {
    // 3. Load and resize background to exact Instagram Story dimensions
    const backgroundBuffer = await sharp(backgroundPath)
      .resize(config.instagram.width, config.instagram.height, {
        fit: 'cover',
        position: 'center'
      })
      .toBuffer();

    // 4. Load asset and get its metadata
    const assetMetadata = await sharp(assetPath).metadata();

    if (!assetMetadata.width || !assetMetadata.height) {
      throw new Error('Unable to read asset dimensions');
    }

    // 5. Calculate scaled dimensions to fit within asset zone (756x1344)
    // maintaining aspect ratio
    const assetZoneWidth = config.instagram.assetZone.width;
    const assetZoneHeight = config.instagram.assetZone.height;

    const assetAspectRatio = assetMetadata.width / assetMetadata.height;
    const zoneAspectRatio = assetZoneWidth / assetZoneHeight;

    let scaledWidth: number;
    let scaledHeight: number;

    if (assetAspectRatio > zoneAspectRatio) {
      // Landscape: wider than zone aspect ratio, scale by width
      scaledWidth = assetZoneWidth;
      scaledHeight = Math.round(scaledWidth / assetAspectRatio);
    } else {
      // Portrait or square: scale by height
      scaledHeight = assetZoneHeight;
      scaledWidth = Math.round(scaledHeight * assetAspectRatio);

      // Clamp width if it exceeds maximum
      if (scaledWidth > assetZoneWidth) {
        scaledWidth = assetZoneWidth;
        scaledHeight = Math.round(scaledWidth / assetAspectRatio);
      }
    }

    // 6. Resize asset to calculated dimensions
    const scaledAssetBuffer = await sharp(assetPath)
      .resize(scaledWidth, scaledHeight, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toBuffer();

    // 7. Calculate centering offset within asset zone
    const assetZoneX = config.instagram.assetZone.xOffset;
    const assetZoneY = config.instagram.assetZone.yOffset;

    const centerX = assetZoneX + Math.round((assetZoneWidth - scaledWidth) / 2);
    const centerY = assetZoneY + Math.round((assetZoneHeight - scaledHeight) / 2);

    // 8. Composite asset over background at calculated position
    const outputExtension = path.extname(outputPath).toLowerCase();
    let compositePipeline = sharp(backgroundBuffer).composite([
      {
        input: scaledAssetBuffer,
        top: centerY,
        left: centerX
      }
    ]);

    // 9. Apply output format
    if (outputExtension === '.jpg' || outputExtension === '.jpeg') {
      compositePipeline = compositePipeline.jpeg({ quality: 90 });
    } else {
      compositePipeline = compositePipeline.png({ compressionLevel: 9 });
    }

    // 10. Save to output file
    await compositePipeline.toFile(outputPath);

    return outputPath;
  } catch (error) {
    if (error instanceof Error) {
      // Re-throw validation errors
      if (error.message.includes('not found') || error.message.includes('Unsupported')) {
        throw error;
      }
      // Wrap Sharp processing errors
      throw new Error(`Image processing failed: ${error.message}`);
    }
    throw new Error('Image processing failed: Unknown error');
  }
}
