/**
 * GET /api/assets/[assetId]/text-svg
 * Returns SVG markup for text overlay with positioning and shadow metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { readHistory } from '@/lib/history';
import { generateTextSVG } from '@/lib/text-overlay';
import { config } from '@/lib/config';

/**
 * Maps position tier to Y coordinate
 */
function getTierYPosition(tier: 1 | 2 | 3): number {
  const { tier1Y, tier2Y, tier3Y } = config.textOverlay.positioning;

  switch (tier) {
    case 1:
      return tier1Y;
    case 2:
      return tier2Y;
    case 3:
      return tier3Y;
    default:
      return tier2Y; // Default to tier 2
  }
}

/**
 * Maps shadow type to color
 */
function getShadowColor(shadowType: 'dark' | 'light'): string {
  return shadowType === 'dark' ? '#000000' : '#FFFFFF';
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await context.params;
    const { searchParams } = new URL(request.url);
    const customContent = searchParams.get('content');

    // Validate assetId
    if (!assetId || typeof assetId !== 'string' || assetId.trim() === '') {
      return NextResponse.json(
        { error: 'Invalid asset ID' },
        { status: 400 }
      );
    }

    // Validate customContent if provided
    if (customContent && customContent.length > 500) {
      return NextResponse.json(
        { error: 'Content too long (max 500 characters)' },
        { status: 400 }
      );
    }

    // Read asset from history
    const history = await readHistory();
    const asset = history.assets.find((a) => a.id === assetId);

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Determine text content (priority: query param > asset content > default)
    const textContent = customContent ||
                       asset.text_overlay_content ||
                       config.textOverlay.defaultContent;

    // Determine position tier and shadow type (use analytics or defaults)
    const positionTier = asset.text_overlay_analytics?.position_tier_used || 2;
    const shadowType = asset.text_overlay_analytics?.shadow_type || 'dark';

    // Calculate position and shadow color
    const positionY = getTierYPosition(positionTier as 1 | 2 | 3);
    const shadowColor = getShadowColor(shadowType);

    // Generate SVG
    const svg = generateTextSVG({
      text: textContent,
      x: 540, // Centered horizontally (1080 / 2)
      y: positionY,
      fontSize: config.textOverlay.font.size,
      fontWeight: config.textOverlay.font.weight,
      color: '#FFFFFF',
      shadowColor: shadowColor,
      maxWidth: config.textOverlay.positioning.maxWidth,
    });

    // Return SVG with metadata
    return NextResponse.json({
      svg,
      position_y: positionY,
      position_tier: positionTier,
      shadow_color: shadowColor,
    });

  } catch (error) {
    console.error('Error generating text SVG:', error);
    return NextResponse.json(
      { error: 'Failed to generate text SVG' },
      { status: 500 }
    );
  }
}
