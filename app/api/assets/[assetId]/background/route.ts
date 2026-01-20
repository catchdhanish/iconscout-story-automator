/**
 * Background Generation Endpoint
 * POST /api/assets/[assetId]/background
 *
 * Generates AI-powered Instagram Story backgrounds for assets
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAsset, updateHistory } from '@/lib/history';
import { generateBackground, saveBase64Image } from '@/lib/openrouter';
import { analyzeAsset } from '@/lib/vision';
import { extractDominantColors } from '@/lib/colors';
import { generatePreview } from '@/lib/preview';
import type { AssetVersion } from '@/lib/types';
import { promises as fs } from 'fs';
import path from 'path';
import { config } from '@/lib/config';
import { uploadToS3, localPathToS3Key } from '@/lib/s3';

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
 * Generate default user prompt using asset description, vision analysis, and colors
 */
function generateDefaultUserPrompt(
  metaDescription: string,
  visionDescription?: string,
  dominantColors?: string[]
): string {
  const colorPalette = dominantColors && dominantColors.length > 0
    ? dominantColors.join(', ')
    : 'vibrant and bold colors';

  const assetDesc = visionDescription || metaDescription;

  return `Create an Instagram Story background with the following characteristics:

ASSET DESCRIPTION: ${assetDesc}
META DESCRIPTION: ${metaDescription}
SUGGESTED COLOR PALETTE (use as guidance, not strict requirement): ${colorPalette}

Design a complementary background that enhances this asset while allowing it to remain the focal point.

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

    // Get local asset path (assets are already saved during upload)
    const localAssetPath = path.join(
      process.cwd(),
      'public',
      asset.asset_url.replace(/^\//, '')
    );

    // Run vision analysis if not already done
    if (!asset.asset_vision_description) {
      try {
        const description = await analyzeAsset(localAssetPath);
        await updateHistory((history) => {
          const idx = history.assets.findIndex(a => a.id === assetId);
          if (idx !== -1) {
            history.assets[idx].asset_vision_description = description;
          }
          return history;
        });
        asset.asset_vision_description = description;
      } catch (error) {
        console.error('Vision analysis failed:', error);
        // Use meta_description as fallback
      }
    }

    // Run color extraction if not already done
    if (!asset.dominant_colors || asset.dominant_colors.length === 0) {
      try {
        const colors = await extractDominantColors(localAssetPath);
        await updateHistory((history) => {
          const idx = history.assets.findIndex(a => a.id === assetId);
          if (idx !== -1) {
            history.assets[idx].dominant_colors = colors;
          }
          return history;
        });
        asset.dominant_colors = colors;
      } catch (error) {
        console.error('Color extraction failed:', error);
        // Continue without colors (prompt will use fallback)
      }
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
    const userPrompt = body.userPrompt || generateDefaultUserPrompt(
      asset.meta_description,
      asset.asset_vision_description,
      asset.dominant_colors
    );

    // Combine prompts for storage
    const fullPromptUsed = `SYSTEM:\n${systemPrompt}\n\nUSER:\n${userPrompt}`;

    // Call generateBackground from lib/openrouter.ts
    let backgroundImageData: string;
    try {
      backgroundImageData = await generateBackground(systemPrompt, userPrompt);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: `Background generation failed: ${error instanceof Error ? error.message : String(error)}`
        },
        { status: 500 }
      );
    }

    // Save generated background image to disk
    const assetDir = path.join(process.cwd(), 'public', 'uploads', assetId);
    await fs.mkdir(assetDir, { recursive: true });

    const versionNumber = asset.versions.length + 1;
    const backgroundFileName = `background_v${versionNumber}.png`;
    const backgroundPath = path.join(assetDir, backgroundFileName);
    const publicPath = `/uploads/${assetId}/${backgroundFileName}`;

    // Save base64 image to disk
    try {
      await saveBase64Image(backgroundImageData, backgroundPath);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to save background image: ${error instanceof Error ? error.message : String(error)}`
        },
        { status: 500 }
      );
    }

    // Upload to S3 if storage mode is hybrid or s3
    let finalPublicPath = publicPath;
    if (config.storage?.mode === 'hybrid' || config.storage?.mode === 's3') {
      try {
        const s3Key = localPathToS3Key(publicPath);
        const s3Url = await uploadToS3(backgroundPath, s3Key, 'image/png');
        finalPublicPath = s3Url;
        console.log(`[Background] Uploaded to S3: ${s3Url}`);
      } catch (s3Error) {
        console.error('[Background] S3 upload failed:', s3Error);
        if (config.storage?.mode === 's3') {
          return NextResponse.json(
            {
              success: false,
              error: `Failed to upload to S3: ${s3Error instanceof Error ? s3Error.message : 'Unknown error'}`
            },
            { status: 500 }
          );
        }
      }
    }

    // Create new AssetVersion
    const newVersion: AssetVersion = {
      version: versionNumber,
      created_at: new Date().toISOString(),
      prompt_used: fullPromptUsed, // Store full prompt (system + user)
      file_path: finalPublicPath // Use S3 URL if uploaded, otherwise local path
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

    // Generate preview asynchronously (don't block response)
    void generatePreview(assetId, newVersion.version)
      .then(result => {
        if (!result.success) {
          console.warn(`Preview generation failed for ${assetId} v${newVersion.version}:`, result.error);
        }
      })
      .catch(error => {
        console.error(`Preview generation error for ${assetId} v${newVersion.version}:`, error);
      });

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
