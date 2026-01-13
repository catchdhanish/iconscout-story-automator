import { NextRequest, NextResponse } from 'next/server';
import { readHistory, updateHistory } from '@/lib/history';
import { BULK_APPROVAL_LIMIT } from '@/lib/config';
import fs from 'fs';
import path from 'path';

/**
 * Sleep helper for backoff delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry helper with exponential backoff
 * @param fn Function to retry
 * @param maxRetries Maximum number of retry attempts (default 3)
 * @returns Result of the function
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // If this was the last attempt, throw the error
      if (attempt === maxRetries - 1) {
        throw lastError;
      }

      // Exponential backoff: 1s, 2s, 4s
      const backoffMs = Math.pow(2, attempt) * 1000;
      await sleep(backoffMs);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Retry failed');
}

/**
 * Validate if an asset can be approved
 */
function canApproveAsset(asset: any): { valid: boolean; reason?: string } {
  // Must be in Draft status
  if (asset.status !== 'Draft') {
    return { valid: false, reason: `Asset is in ${asset.status} status, not Draft` };
  }

  // Must have active_version > 0
  if (!asset.active_version || asset.active_version === 0) {
    return { valid: false, reason: 'Asset has no active version' };
  }

  // Find the active version
  const activeVersionData = asset.versions?.find(
    (v: any) => v.version === asset.active_version
  );

  if (!activeVersionData || !activeVersionData.file_path) {
    return { valid: false, reason: 'Active version has no file path' };
  }

  // Check if background file exists
  const backgroundPath = path.join(process.cwd(), 'public', activeVersionData.file_path);
  if (!fs.existsSync(backgroundPath)) {
    return { valid: false, reason: `Background file not found: ${activeVersionData.file_path}` };
  }

  // Check if asset file exists (for local files)
  // Note: asset_url might be a remote URL, so we only check if it's accessible
  if (!asset.asset_url) {
    return { valid: false, reason: 'Asset has no asset_url' };
  }

  return { valid: true };
}

/**
 * POST /api/assets/bulk-approve
 * Bulk approve multiple assets
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { assetIds } = body;

    // Validate request body
    if (!assetIds || !Array.isArray(assetIds)) {
      return NextResponse.json(
        { error: 'assetIds must be an array' },
        { status: 400 }
      );
    }

    // Enforce 50 asset limit
    if (assetIds.length > BULK_APPROVAL_LIMIT) {
      return NextResponse.json(
        { error: `Cannot approve more than ${BULK_APPROVAL_LIMIT} assets at once` },
        { status: 400 }
      );
    }

    // Read current history
    const history = await readHistory();

    // Filter to only Draft assets and validate
    const draftAssets = assetIds
      .map((id: string) => {
        const asset = history.assets.find((a: any) => a.id === id);
        if (!asset) return null;

        const validation = canApproveAsset(asset);
        return validation.valid ? asset : null;
      })
      .filter((asset: any) => asset !== null);

    const approved: string[] = [];
    const failed: Array<{ assetId: string; reason: string }> = [];

    // Process assets sequentially to avoid lock contention
    for (const asset of draftAssets) {
      try {
        // Update asset status with retry logic
        await retryWithBackoff(async () => {
          await updateHistory((history) => {
            const assetToUpdate = history.assets.find((a: any) => a.id === asset.id);
            if (assetToUpdate) {
              assetToUpdate.status = 'Ready';
              assetToUpdate.updated_at = new Date().toISOString();
            }
            return history;
          });
        });

        approved.push(asset.id);
      } catch (error) {
        failed.push({
          assetId: asset.id,
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Return success response (even if some failed)
    return NextResponse.json({
      approved,
      failed,
      summary: {
        total: draftAssets.length,
        approved: approved.length,
        failed: failed.length
      }
    });

  } catch (error) {
    console.error('Bulk approve error:', error);
    return NextResponse.json(
      { error: 'Failed to bulk approve assets' },
      { status: 500 }
    );
  }
}
