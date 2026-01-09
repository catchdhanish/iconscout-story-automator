import { NextRequest, NextResponse } from 'next/server';
import { getAsset, deleteAsset } from '@/lib/history';

/**
 * GET /api/assets/[assetId]
 * Fetch a single asset by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await params;

    if (!assetId || typeof assetId !== 'string' || assetId.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Invalid assetId format' },
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

    return NextResponse.json(
      {
        success: true,
        asset
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to get asset:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to get asset: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/assets/[assetId]
 * Delete an asset by ID
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await params;

    if (!assetId || typeof assetId !== 'string' || assetId.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Invalid assetId format' },
        { status: 400 }
      );
    }

    // Check if asset exists
    const asset = await getAsset(assetId);
    if (!asset) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Delete the asset
    await deleteAsset(assetId);

    return NextResponse.json(
      {
        success: true,
        message: 'Asset deleted successfully'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to delete asset:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to delete asset: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    );
  }
}
