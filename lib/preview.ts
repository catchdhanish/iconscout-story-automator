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
  previewPath?: string;
  error?: string;
  processingTime?: number;
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

  try {
    // 1. Read history and find asset
    const history = await readHistory();
    const asset = history.assets.find(a => a.id === assetId);

    if (!asset) {
      throw new Error('Asset not found');
    }

    // 2. Find the version
    const versionData = asset.versions.find(v => v.version === version);
    if (!versionData) {
      throw new Error(`Version ${version} not found for asset ${assetId}`);
    }

    // 3. Get file paths
    const backgroundPath = versionData.file_path;
    const assetPath = path.join(process.cwd(), 'public', asset.asset_url);
    const previewPath = getPreviewPath(assetId, version);

    // Ensure preview directory exists
    const previewDir = path.dirname(previewPath);
    await fs.mkdir(previewDir, { recursive: true });

    // 4. Attempt composition with retry logic
    let lastError: Error | null = null;
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Call composeStory with includeText: false
        const result = await composeStory(
          backgroundPath,
          assetPath,
          previewPath,
          { includeText: false }
        );

        if (!result.success) {
          throw new Error(result.analytics?.text_overlay?.error || 'Composition failed');
        }

        // 5. Update metadata on success
        const processingTime = Date.now() - startTime;
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
            preview_file_path: previewPath,
            preview_generated_at: new Date().toISOString(),
            preview_generation_time_ms: processingTime,
            preview_generation_failed: false
          };

          return hist;
        });

        return {
          success: true,
          previewUrl: getPreviewUrl(assetId, version),
          previewPath,
          processingTime
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

    // 6. Mark as failed after all retries exhausted
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
      error: lastError?.message || 'Unknown error'
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Preview generation failed:', errorMessage);

    return {
      success: false,
      error: errorMessage
    };
  }
}
