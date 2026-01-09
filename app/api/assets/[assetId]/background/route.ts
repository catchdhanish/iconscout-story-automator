/**
 * Background Generation Endpoint
 * POST /api/assets/[assetId]/background
 *
 * Generates AI-powered Instagram Story backgrounds for assets
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAsset, updateHistory } from '@/lib/history';
import { generateBackground } from '@/lib/openrouter';
import type { AssetVersion } from '@/lib/types';

/**
 * Default system prompt for background generation
 * From iconscout-brand skill
 */
const DEFAULT_SYSTEM_PROMPT = `You are an expert background designer for Instagram Stories specializing in the IconScout brand aesthetic.

BRAND STYLE:
- Modern, clean, vibrant yet professional
- Abstract, gradient-based, or organic shapes
- Bold colors that complement (not compete with) the main asset
- Geometric patterns, smooth gradients, subtle textures

CRITICAL RULES:
- Generate ONLY the background - DO NOT draw the asset, logo, or text
- Respect Instagram Story safe zones: top 250px and bottom 180px should avoid critical visual elements
- The center 70% of the canvas (756x1344 pixels out of 1080x1920) is reserved for the asset overlay
- Design the background to enhance, not compete with, the asset that will be placed on top
- Output resolution: 1080x1920 pixels (9:16 aspect ratio)

VISUAL APPROACH:
- Use abstract shapes and gradients rather than literal objects
- Create depth with layered shapes or gradient transitions
- Balance vibrant colors with clean, uncluttered composition
- Ensure the center area has visual interest but remains suitable for overlay`;

/**
 * Generate default user prompt using asset description
 */
function generateDefaultUserPrompt(metaDescription: string): string {
  return `Create an Instagram Story background with the following characteristics:

ASSET DESCRIPTION: ${metaDescription}
STYLE REQUIREMENTS:
- Abstract and gradient-based design
- Vibrant colors that enhance without competing
- Clean center area for asset overlay

CONSTRAINTS:
- 1080x1920 pixels (9:16 aspect ratio)
- Keep center 70% relatively clean for asset overlay
- Avoid critical elements in top 250px and bottom 180px`;
}

/**
 * POST handler for background generation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    // Extract assetId from route params
    const { assetId } = await params;

    // Validate assetId format
    if (!assetId || typeof assetId !== 'string' || assetId.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Invalid assetId format' },
        { status: 400 }
      );
    }

    // Get asset from history
    const asset = await getAsset(assetId);

    // Verify asset exists
    if (!asset) {
      return NextResponse.json(
        { success: false, error: `Asset with id ${assetId} not found` },
        { status: 404 }
      );
    }

    // Parse request body
    let body: { systemPrompt?: string; userPrompt?: string } = {};
    try {
      body = await request.json();
    } catch (error) {
      // Body is optional, so empty body is acceptable
      body = {};
    }

    // Extract or use default prompts
    const systemPrompt = body.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const userPrompt = body.userPrompt || generateDefaultUserPrompt(asset.meta_description);

    // Combine prompts for storage
    const fullPromptUsed = `SYSTEM:\n${systemPrompt}\n\nUSER:\n${userPrompt}`;

    // Call generateBackground from lib/openrouter.ts
    let backgroundDescription: string;
    try {
      backgroundDescription = await generateBackground(systemPrompt, userPrompt);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: `Background generation failed: ${error instanceof Error ? error.message : String(error)}`
        },
        { status: 500 }
      );
    }

    // Create new AssetVersion
    const newVersion: AssetVersion = {
      version: asset.versions.length + 1,
      created_at: new Date().toISOString(),
      prompt_used: backgroundDescription, // AI-generated description, not input prompts
      file_path: '' // Empty for now, will be populated when image is generated
    };

    // Update asset with new version
    try {
      await updateHistory((history) => {
        const assetIndex = history.assets.findIndex(a => a.id === assetId);
        if (assetIndex === -1) {
          throw new Error(`Asset with id ${assetId} not found`);
        }

        const updatedAssets = [...history.assets];
        updatedAssets[assetIndex] = {
          ...updatedAssets[assetIndex],
          versions: [...updatedAssets[assetIndex].versions, newVersion],
          active_version: newVersion.version,
          updated_at: new Date().toISOString()
        };

        return {
          ...history,
          assets: updatedAssets
        };
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to update asset history: ${error instanceof Error ? error.message : String(error)}`
        },
        { status: 500 }
      );
    }

    // Return success response
    return NextResponse.json({
      success: true,
      version: newVersion
    });

  } catch (error) {
    // Handle any unexpected errors
    return NextResponse.json(
      {
        success: false,
        error: `Internal server error: ${error instanceof Error ? error.message : String(error)}`
      },
      { status: 500 }
    );
  }
}
