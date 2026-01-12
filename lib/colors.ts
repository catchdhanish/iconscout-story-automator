/**
 * Color Extraction Module
 *
 * Extracts dominant colors from asset images using node-vibrant
 * to guide background generation.
 */

import { Vibrant } from 'node-vibrant/node';

/**
 * Extract dominant colors from an asset image
 *
 * @param assetPath - Full filesystem path to the asset image
 * @returns Promise<string[]> - Array of 3-5 hex color codes (e.g., ["#FF5733", "#33A1FF"])
 * @throws Error if file doesn't exist or color extraction fails
 */
export async function extractDominantColors(assetPath: string): Promise<string[]> {
  try {
    // Use node-vibrant to analyze the image
    const palette = await Vibrant.from(assetPath).getPalette();

    const colors: string[] = [];

    // Extract colors in priority order (from SPEC.md:169-182)
    // 1. Vibrant
    if (palette.Vibrant) {
      colors.push(palette.Vibrant.hex);
    }

    // 2. Muted
    if (palette.Muted) {
      colors.push(palette.Muted.hex);
    }

    // 3. DarkVibrant
    if (palette.DarkVibrant) {
      colors.push(palette.DarkVibrant.hex);
    }

    // 4. LightVibrant
    if (palette.LightVibrant) {
      colors.push(palette.LightVibrant.hex);
    }

    // 5. DarkMuted
    if (palette.DarkMuted) {
      colors.push(palette.DarkMuted.hex);
    }

    // 6. LightMuted
    if (palette.LightMuted) {
      colors.push(palette.LightMuted.hex);
    }

    // Deduplicate colors (in case multiple swatches have same hex)
    const uniqueColors = Array.from(new Set(colors));

    // Return up to 5 colors
    const finalColors = uniqueColors.slice(0, 5);

    // If no colors found, return basic fallback
    if (finalColors.length === 0) {
      console.warn('No colors extracted from image, using fallback colors');
      return ['#000000', '#FFFFFF'];
    }

    return finalColors;

  } catch (error) {
    // Log error for debugging
    console.error('Color extraction failed:', error);

    // If file not found, throw specific error
    if (error instanceof Error && error.message.includes('ENOENT')) {
      throw new Error(`Asset file not found: ${assetPath}`);
    }

    // For other errors, return empty array to allow graceful fallback
    // The caller can decide to use default colors or proceed without colors
    return [];
  }
}
