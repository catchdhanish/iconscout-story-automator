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
import { detectAssetBottomEdge, calculateTextTier } from './asset-detection';
import { determineAdaptiveShadow } from './brightness-sampling';
import { generateTextSVG, getDefaultTextConfig } from './text-overlay';

/**
 * Options for story composition
 */
export interface ComposeOptions {
  /** Whether to include text overlay (default: true) */
  includeText?: boolean;
  /** Custom text content to override default */
  textOverride?: string;
}

/**
 * Analytics data for text overlay rendering
 */
export interface TextOverlayAnalytics {
  /** Whether text overlay was enabled */
  enabled: boolean;
  /** Position tier used (1, 2, or 3) */
  position_tier_used?: 1 | 2 | 3;
  /** Y position of text */
  position_y?: number;
  /** Shadow type applied (dark or light) */
  shadow_type?: 'dark' | 'light';
  /** Number of text lines rendered */
  lines_count?: number;
  /** Render time in milliseconds */
  render_time_ms?: number;
  /** Brightness sample values */
  brightness_samples?: number[];
  /** Average brightness value */
  avg_brightness?: number;
  /** Number of retry attempts */
  retry_count?: number;
  /** Whether text overlay failed */
  failed?: boolean;
  /** Error message if failed */
  error?: string;
  /** Whether fallback was applied */
  fallback_applied?: boolean;
}

/**
 * Result of story composition
 */
export interface ComposeResult {
  /** Whether composition succeeded */
  success: boolean;
  /** Path to output file */
  outputPath: string;
  /** Analytics data */
  analytics?: {
    text_overlay: TextOverlayAnalytics;
  };
}

/**
 * Compose an Instagram Story by layering an asset onto a background
 *
 * Takes a background image and an asset image, resizes them according to
 * Instagram Story specifications, centers the asset within the safe zone,
 * and composites them together. Optionally adds text overlay with adaptive
 * positioning and shadow.
 *
 * @param backgroundPath - Path to background image (will be resized to 1080x1920)
 * @param assetPath - Path to asset image (will be resized to fit 756x1344)
 * @param outputPath - Path for output file (PNG or JPEG)
 * @param options - Composition options (text overlay, custom text)
 * @returns Promise resolving to composition result with analytics
 * @throws Error if files don't exist, formats are invalid, or processing fails
 *
 * @example
 * ```typescript
 * const result = await composeStory(
 *   '/uploads/background.png',
 *   '/uploads/asset.png',
 *   '/uploads/output.png',
 *   { includeText: true, textOverride: 'Custom text' }
 * );
 * console.log(`Story saved to: ${result.outputPath}`);
 * console.log(`Analytics:`, result.analytics);
 * ```
 */
export async function composeStory(
  backgroundPath: string,
  assetPath: string,
  outputPath: string,
  options: ComposeOptions = {}
): Promise<ComposeResult> {
  const startTime = Date.now();
  const { includeText = true, textOverride } = options;

  const analytics: TextOverlayAnalytics = {
    enabled: includeText,
    retry_count: 0
  };

  // Temp file path for intermediate composition (before text overlay)
  const tempComposedPath = outputPath.replace(/\.(png|jpg|jpeg)$/i, '-temp.png');

  try {
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

    // 8. Composite asset over background and save to temp file (for analysis)
    await sharp(backgroundBuffer)
      .composite([
        {
          input: scaledAssetBuffer,
          top: centerY,
          left: centerX
        }
      ])
      .png()
      .toFile(tempComposedPath);

    // 9. Add text overlay if enabled
    let finalOutputPath = tempComposedPath;

    if (includeText) {
      try {
        // Detect asset bottom edge
        const assetBottomY = await detectAssetBottomEdge(tempComposedPath);
        const textY = calculateTextTier(assetBottomY);

        // Calculate tier number (1, 2, or 3)
        const tier: 1 | 2 | 3 = textY === 1560 ? 1 : textY === 1520 ? 2 : 3;

        analytics.position_tier_used = tier;
        analytics.position_y = textY;

        // Determine adaptive shadow based on brightness
        const shadowResult = await determineAdaptiveShadow(
          tempComposedPath,
          90,    // X offset for text area
          textY, // Y position
          900,   // Width of text area
          180    // Approximate height of text area
        );

        analytics.shadow_type = shadowResult.shadowType;
        analytics.avg_brightness = shadowResult.averageBrightness;
        analytics.brightness_samples = shadowResult.samples;

        // Generate text SVG
        const textConfig = getDefaultTextConfig();
        if (textOverride) {
          textConfig.text = textOverride;
        }
        textConfig.y = textY;

        const textSVG = generateTextSVG({
          ...textConfig,
          shadowColor: shadowResult.shadowColor
        });

        // Count lines in text
        const lines = textConfig.text.split('\n').length;
        analytics.lines_count = lines;

        // Composite text onto image
        const textBuffer = Buffer.from(textSVG);
        await sharp(tempComposedPath)
          .composite([{
            input: textBuffer,
            top: 0,
            left: 0
          }])
          .png()
          .toFile(outputPath);

        finalOutputPath = outputPath;
        analytics.render_time_ms = Date.now() - startTime;

      } catch (textError) {
        console.warn('Text overlay failed, retrying once:', textError);
        analytics.retry_count = 1;

        // Retry once with default values
        try {
          const textConfig = getDefaultTextConfig();
          if (textOverride) {
            textConfig.text = textOverride;
          }
          const textY = 1520; // Default tier 2
          textConfig.y = textY;

          const shadowResult = await determineAdaptiveShadow(tempComposedPath, 90, textY, 900, 180);

          const textSVG = generateTextSVG({
            ...textConfig,
            shadowColor: shadowResult.shadowColor
          });

          const textBuffer = Buffer.from(textSVG);
          await sharp(tempComposedPath)
            .composite([{ input: textBuffer, top: 0, left: 0 }])
            .png()
            .toFile(outputPath);

          finalOutputPath = outputPath;
          analytics.position_y = textY;
          analytics.position_tier_used = 2;
          analytics.shadow_type = shadowResult.shadowType;
          analytics.avg_brightness = shadowResult.averageBrightness;
          analytics.brightness_samples = shadowResult.samples;

        } catch (retryError) {
          // Silent fallback: Use composed image without text
          console.error('Text overlay retry failed, using fallback:', retryError);
          analytics.failed = true;
          analytics.error = textError instanceof Error ? textError.message : 'Unknown error';
          analytics.fallback_applied = true;
          await fs.copyFile(tempComposedPath, outputPath);
          finalOutputPath = outputPath;
        }
      }
    } else {
      // No text overlay requested - just copy temp to output
      await fs.copyFile(tempComposedPath, outputPath);
      finalOutputPath = outputPath;
    }

    // 10. Clean up temp file
    try {
      await fs.unlink(tempComposedPath);
    } catch (cleanupError) {
      // Ignore cleanup errors
      console.warn('Failed to clean up temp file:', cleanupError);
    }

    return {
      success: true,
      outputPath: finalOutputPath,
      analytics: { text_overlay: analytics }
    };

  } catch (error) {
    // Clean up temp file on error
    try {
      await fs.unlink(tempComposedPath);
    } catch {
      // Ignore cleanup errors
    }

    console.error('Composition failed:', error);

    if (error instanceof Error) {
      // Re-throw validation errors
      if (error.message.includes('not found') || error.message.includes('Unsupported')) {
        throw error;
      }
    }

    // Return failed result instead of throwing
    return {
      success: false,
      outputPath: outputPath,
      analytics: {
        text_overlay: {
          enabled: includeText,
          failed: true,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    };
  }
}
