import { NextRequest, NextResponse } from 'next/server';
import { generatePreview } from '@/lib/preview';
import { readHistory } from '@/lib/history';

export async function POST(
  request: NextRequest,
  { params }: { params: { assetId: string } }
) {
  try {
    const { assetId } = params;
    const body = await request.json();
    // includeText is reserved for future use (spec section 2.4.2)
    let { version, includeText = false } = body;

    // If version not specified, use active version
    if (!version) {
      const history = await readHistory();
      const asset = history.assets.find(a => a.id === assetId);
      if (!asset) {
        return NextResponse.json(
          { success: false, error: 'Asset not found' },
          { status: 404 }
        );
      }
      version = asset.active_version;
    }

    // Generate preview
    const result = await generatePreview(assetId, version);

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Preview API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
