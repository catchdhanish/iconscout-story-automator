import { NextResponse } from 'next/server';
import { readHistory } from '@/lib/history';

/**
 * GET /api/assets
 * Fetch all assets from history.json
 *
 * Response:
 * - success: true
 * - assets: AssetMetadata[] (on success)
 * - error: Error message (on failure)
 */
export async function GET() {
  try {
    // Read history using readHistory() from lib/history.ts
    const history = await readHistory();

    // Return assets array
    return NextResponse.json(
      {
        success: true,
        assets: history.assets
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to fetch assets:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch assets: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    );
  }
}
