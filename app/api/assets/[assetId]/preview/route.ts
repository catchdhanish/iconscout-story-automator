/**
 * POST /api/assets/[assetId]/preview
 * Manually trigger preview generation for an asset version
 */

import { NextRequest, NextResponse } from 'next/server';
import { generatePreview } from '@/lib/preview';
import { getAsset } from '@/lib/history';

/**
 * POST handler for manual preview generation
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await context.params;

    // Validate assetId
    if (!assetId || typeof assetId !== 'string' || assetId.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Invalid asset ID' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { version } = body;

    // Get asset to validate and determine version
    const asset = await getAsset(assetId);

    if (!asset) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Determine which version to generate preview for
    const targetVersion = version || asset.active_version;

    // Verify version exists
    const versionData = asset.versions.find(v => v.version === targetVersion);
    if (!versionData) {
      return NextResponse.json(
        { success: false, error: `Version ${targetVersion} not found` },
        { status: 404 }
      );
    }

    // Generate preview
    const result = await generatePreview(assetId, targetVersion);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Preview generation failed'
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        previewUrl: result.previewUrl,
        generated_at: result.generated_at,
        generation_time_ms: result.generation_time_ms
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Preview generation API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler - check preview status
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await context.params;

    if (!assetId || typeof assetId !== 'string' || assetId.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Invalid asset ID' },
        { status: 400 }
      );
    }

    const asset = await getAsset(assetId);

    if (!asset) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    const currentVersion = asset.versions.find(
      v => v.version === asset.active_version
    );

    if (!currentVersion) {
      return NextResponse.json(
        { success: false, error: 'Active version not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      preview_file_path: currentVersion.preview_file_path,
      preview_generated_at: currentVersion.preview_generated_at,
      preview_generation_failed: currentVersion.preview_generation_failed,
      is_stale: currentVersion.preview_generated_at
        ? new Date(currentVersion.preview_generated_at) < new Date(currentVersion.created_at)
        : true
    });

  } catch (error) {
    console.error('Preview status check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
