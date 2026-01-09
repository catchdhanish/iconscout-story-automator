/**
 * Main Story Composition Function
 *
 * Composes Instagram Stories by layering assets onto backgrounds using the Sharp library.
 * Handles scaling, positioning, transparency, and format conversion.
 *
 * @module compose-story
 */

import sharp from 'sharp';
import { calculateAssetDimensions } from './asset-scaler';
import { INSTAGRAM_STORY, isValidStoryDimensions } from './safe-zones';

export interface CompositionOptions {
  /** Preserve PNG transparency (default: true) */
  preserveTransparency?: boolean;
  /** Output format (default: 'png') */
  format?: 'png' | 'jpg' | 'webp';
  /** JPEG quality 1-100 (default: 90) */
  quality?: number;
  /** Flatten transparent background to this color (default: none) */
  flattenBackground?: string;
}

export interface CompositionResult {
  /** Path to output file */
  outputPath: string;
  /** Final dimensions */
  dimensions: {
    width: number;
    height: number;
  };
  /** Asset dimensions and position */
  asset: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
  /** Processing time in milliseconds */
  processingTime: number;
}

/**
 * Compose an Instagram Story by layering an asset onto a background
 *
 * @param backgroundPath - Path to background image (1080x1920)
 * @param assetPath - Path to asset image
 * @param outputPath - Path for output file
 * @param options - Composition options
 * @returns Composition result with metadata
 *
 * @example
 * ```typescript
 * const result = await composeStory(
 *   '/uploads/background.png',
 *   '/uploads/asset.png',
 *   '/uploads/output.png'
 * );
 *
 * console.log(`Composed story in ${result.processingTime}ms`);
 * ```
 */
export async function composeStory(
  backgroundPath: string,
  assetPath: string,
  outputPath: string,
  options: CompositionOptions = {}
): Promise<CompositionResult> {
  const startTime = Date.now();

  const {
    preserveTransparency = true,
    format = 'png',
    quality = 90,
    flattenBackground
  } = options;

  // 1. Load and validate background
  const backgroundMetadata = await sharp(backgroundPath).metadata();

  if (
    !backgroundMetadata.width ||
    !backgroundMetadata.height ||
    !isValidStoryDimensions(backgroundMetadata.width, backgroundMetadata.height)
  ) {
    throw new Error(
      `Background must be ${INSTAGRAM_STORY.WIDTH}x${INSTAGRAM_STORY.HEIGHT}px ` +
        `(got ${backgroundMetadata.width}x${backgroundMetadata.height}px)`
    );
  }

  // 2. Load and get asset metadata
  const assetMetadata = await sharp(assetPath).metadata();

  if (!assetMetadata.width || !assetMetadata.height) {
    throw new Error('Unable to read asset dimensions');
  }

  // 3. Calculate scaled dimensions and position
  const { width, height, x, y } = calculateAssetDimensions(
    assetMetadata.width,
    assetMetadata.height
  );

  // 4. Resize and prepare asset
  let assetPipeline = sharp(assetPath).resize(width, height, {
    fit: 'contain',
    background: preserveTransparency
      ? { r: 0, g: 0, b: 0, alpha: 0 }
      : { r: 255, g: 255, b: 255, alpha: 1 }
  });

  // Convert to appropriate format
  if (assetMetadata.format === 'svg') {
    assetPipeline = assetPipeline.png();
  }

  const scaledAssetBuffer = await assetPipeline.toBuffer();

  // 5. Prepare background pipeline
  let backgroundPipeline = sharp(backgroundPath);

  // Flatten background if requested
  if (flattenBackground) {
    backgroundPipeline = backgroundPipeline.flatten({
      background: flattenBackground
    });
  }

  // 6. Composite asset onto background
  backgroundPipeline = backgroundPipeline.composite([
    {
      input: scaledAssetBuffer,
      top: y,
      left: x
    }
  ]);

  // 7. Apply output format
  switch (format) {
    case 'jpg':
    case 'jpeg':
      backgroundPipeline = backgroundPipeline.jpeg({ quality });
      break;
    case 'webp':
      backgroundPipeline = backgroundPipeline.webp({ quality });
      break;
    case 'png':
    default:
      backgroundPipeline = backgroundPipeline.png({
        compressionLevel: 9
      });
      break;
  }

  // 8. Write to output file
  await backgroundPipeline.toFile(outputPath);

  const processingTime = Date.now() - startTime;

  return {
    outputPath,
    dimensions: {
      width: INSTAGRAM_STORY.WIDTH,
      height: INSTAGRAM_STORY.HEIGHT
    },
    asset: { width, height, x, y },
    processingTime
  };
}

/**
 * Compose story with SVG asset (automatically rasterizes)
 *
 * @param backgroundPath - Background image path
 * @param svgPath - SVG asset path
 * @param outputPath - Output path
 * @param options - Composition options
 * @returns Composition result
 */
export async function composeStoryWithSVG(
  backgroundPath: string,
  svgPath: string,
  outputPath: string,
  options: CompositionOptions = {}
): Promise<CompositionResult> {
  // Sharp automatically rasterizes SVG
  return composeStory(backgroundPath, svgPath, outputPath, options);
}

/**
 * Compose story and generate preview thumbnail
 *
 * @param backgroundPath - Background path
 * @param assetPath - Asset path
 * @param outputPath - Full-size output path
 * @param thumbnailPath - Thumbnail output path
 * @param thumbnailWidth - Thumbnail width (default: 256px)
 * @returns Composition result
 */
export async function composeStoryWithThumbnail(
  backgroundPath: string,
  assetPath: string,
  outputPath: string,
  thumbnailPath: string,
  thumbnailWidth: number = 256
): Promise<CompositionResult> {
  // Compose full-size story
  const result = await composeStory(backgroundPath, assetPath, outputPath);

  // Generate thumbnail (maintaining aspect ratio)
  const thumbnailHeight = Math.round(
    (thumbnailWidth / INSTAGRAM_STORY.WIDTH) * INSTAGRAM_STORY.HEIGHT
  );

  await sharp(outputPath)
    .resize(thumbnailWidth, thumbnailHeight, { fit: 'contain' })
    .png()
    .toFile(thumbnailPath);

  return result;
}

/**
 * Batch compose multiple stories
 *
 * @param items - Array of composition items
 * @param concurrency - Number of concurrent compositions (default: 5)
 * @returns Array of composition results
 */
export async function composeBatch(
  items: Array<{
    background: string;
    asset: string;
    output: string;
    options?: CompositionOptions;
  }>,
  concurrency: number = 5
): Promise<CompositionResult[]> {
  const results: CompositionResult[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(item =>
        composeStory(item.background, item.asset, item.output, item.options)
      )
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Validate composition inputs before processing
 *
 * @param backgroundPath - Background path
 * @param assetPath - Asset path
 * @returns Validation result
 */
export async function validateCompositionInputs(
  backgroundPath: string,
  assetPath: string
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Check background
    const bgMetadata = await sharp(backgroundPath).metadata();
    if (
      !bgMetadata.width ||
      !bgMetadata.height ||
      !isValidStoryDimensions(bgMetadata.width, bgMetadata.height)
    ) {
      errors.push(
        `Background must be ${INSTAGRAM_STORY.WIDTH}x${INSTAGRAM_STORY.HEIGHT}px`
      );
    }

    // Check asset
    const assetMetadata = await sharp(assetPath).metadata();
    if (!assetMetadata.width || !assetMetadata.height) {
      errors.push('Unable to read asset dimensions');
    }

    // Check supported formats
    const supportedFormats = ['jpeg', 'png', 'webp', 'svg', 'gif'];
    if (
      assetMetadata.format &&
      !supportedFormats.includes(assetMetadata.format)
    ) {
      errors.push(`Unsupported asset format: ${assetMetadata.format}`);
    }
  } catch (error) {
    errors.push(
      `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
