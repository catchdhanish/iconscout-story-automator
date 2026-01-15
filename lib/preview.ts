import path from 'path';
import fs from 'fs/promises';
import { composeStory } from './composition';
import type { AssetVersion } from './types';
import { readHistory, updateHistory } from './history';

/**
 * Get the file path for a preview image
 */
export function getPreviewPath(assetId: string, version: number): string {
  return path.join(
    process.cwd(),
    'public/uploads',
    assetId,
    `preview-v${version}.png`
  );
}

/**
 * Get the URL path for serving a preview image
 */
export function getPreviewUrl(assetId: string, version: number): string {
  return `/uploads/${assetId}/preview-v${version}.png`;
}

/**
 * Check if a preview is stale (older than the version timestamp)
 */
export function isPreviewStale(version: AssetVersion): boolean {
  if (!version.preview_generated_at) {
    return true;
  }

  const versionTime = new Date(version.created_at).getTime();
  const previewTime = new Date(version.preview_generated_at).getTime();

  return previewTime < versionTime;
}

/**
 * Result of preview generation
 */
export interface PreviewResult {
  success: boolean;
  previewUrl?: string;
  generated_at?: string;
  generation_time_ms?: number;
  error?: string;
}

/**
 * Generate a preview for an asset version (composition without text overlay)
 *
 * This function:
 * 1. Reads the asset and version data from history
 * 2. Calls composeStory with includeText: false
 * 3. Updates metadata with preview info
 * 4. Retries once on failure
 *
 * @param assetId - Asset ID
 * @param version - Version number
 * @returns Promise resolving to preview result
 */
export async function generatePreview(
  assetId: string,
  version: number
): Promise<PreviewResult> {
  const startTime = Date.now();

  // Helper function to mark preview generation as failed
  // This does validation inside updateHistory for atomic operation
  const markAsFailed = async (errorMessage: string): Promise<PreviewResult> => {
    await updateHistory((hist) => {
      const assetIndex = hist.assets.findIndex(a => a.id === assetId);
      if (assetIndex === -1) return hist;

      const versionIndex = hist.assets[assetIndex].versions.findIndex(
        v => v.version === version
      );
      if (versionIndex === -1) return hist;

      // Update version metadata with failure
      hist.assets[assetIndex].versions[versionIndex] = {
        ...hist.assets[assetIndex].versions[versionIndex],
        preview_generation_failed: true,
        preview_generated_at: new Date().toISOString()
      };

      return hist;
    });

    return {
      success: false,
      error: errorMessage
    };
  };

  try {
    // 1. Get paths inside updateHistory for atomic read (Issue #2 fix)
    // Store paths outside callback, validate inside
    let backgroundPath: string | undefined;
    let assetPath: string | undefined;

    // This updateHistory call does validation and path extraction atomically
    // It doesn't modify history (returns unchanged), but ensures consistent read
    await updateHistory((hist) => {
      const asset = hist.assets.find(a => a.id === assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      const versionData = asset.versions.find(v => v.version === version);
      if (!versionData) {
        throw new Error(`Version ${version} not found for asset ${assetId}`);
      }

      // Store paths for use outside callback
      // Convert web-relative paths to absolute filesystem paths
      backgroundPath = versionData.file_path
        ? path.join(process.cwd(), 'public', versionData.file_path.replace(/^\//, ''))
        : undefined;
      assetPath = path.join(process.cwd(), 'public', asset.asset_url.replace(/^\//, ''));

      // No changes - return history unchanged
      return hist;
    });

    // Validate paths are set
    if (!backgroundPath) {
      return await markAsFailed('Background file path not found in version data');
    }

    const previewPath = getPreviewPath(assetId, version);

    // 2. Ensure preview directory exists
    const previewDir = path.dirname(previewPath);
    await fs.mkdir(previewDir, { recursive: true });

    // 3. Attempt composition with retry logic
    let lastError: Error | null = null;
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Call composeStory with includeText: false
        const result = await composeStory(
          backgroundPath!,
          assetPath!,
          previewPath,
          { includeText: false }
        );

        if (!result.success) {
          throw new Error(result.analytics?.text_overlay?.error || 'Composition failed');
        }

        // 4. Update metadata on success
        // Validation happens inside callback for atomic operation (Issue #2 fix)
        const processingTime = Date.now() - startTime;
        const generatedAt = new Date().toISOString();
        await updateHistory((hist) => {
          const assetIndex = hist.assets.findIndex(a => a.id === assetId);
          if (assetIndex === -1) return hist;

          const versionIndex = hist.assets[assetIndex].versions.findIndex(
            v => v.version === version
          );
          if (versionIndex === -1) return hist;

          // Update version metadata
          hist.assets[assetIndex].versions[versionIndex] = {
            ...hist.assets[assetIndex].versions[versionIndex],
            preview_file_path: getPreviewUrl(assetId, version),
            preview_generated_at: generatedAt,
            preview_generation_time_ms: processingTime,
            preview_generation_failed: false
          };

          return hist;
        });

        return {
          success: true,
          previewUrl: getPreviewUrl(assetId, version),
          generated_at: generatedAt,
          generation_time_ms: processingTime
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Preview generation attempt ${attempt} failed:`, lastError.message);

        // Don't retry on the last attempt
        if (attempt === maxAttempts) {
          break;
        }
      }
    }

    // 5. Mark as failed after all retries exhausted (Issue #1 fix - consistent metadata update)
    return await markAsFailed(lastError?.message || 'Unknown error');

  } catch (error) {
    // 6. Mark as failed for early failures (Issue #1 fix - consistent metadata update)
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Preview generation failed:', errorMessage);
    return await markAsFailed(errorMessage);
  }
}
