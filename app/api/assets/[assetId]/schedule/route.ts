/**
 * POST /api/assets/[assetId]/schedule
 *
 * Schedule an Instagram story for a specific asset
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { getAsset, updateHistory } from '@/lib/history';
import { composeStory } from '@/lib/composition';
import { scheduleStory } from '@/lib/blotato';
import { config } from '@/lib/config';
import { uploadToS3, localPathToS3Key } from '@/lib/s3';

/**
 * POST handler for scheduling Instagram stories
 *
 * @param request - Next.js request object
 * @param params - Route parameters containing assetId
 * @returns JSON response with scheduling details or error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    // 1. Extract assetId from URL params
    const { assetId } = await params;

    // 2. Parse scheduledTime from request body
    let body: { scheduledTime?: string };
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body'
        },
        { status: 400 }
      );
    }

    const { scheduledTime } = body;

    // 3. Validate scheduledTime is present and non-empty
    if (!scheduledTime || typeof scheduledTime !== 'string' || scheduledTime.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'scheduledTime is required and must be a non-empty string'
        },
        { status: 400 }
      );
    }

    // 4. Validate scheduledTime is valid ISO 8601 format
    let scheduledDate: Date;
    try {
      scheduledDate = new Date(scheduledTime);
      if (isNaN(scheduledDate.getTime())) {
        throw new Error('Invalid date');
      }
      // Verify it's a valid ISO 8601 string by checking if it can be parsed back
      if (scheduledDate.toISOString() === 'Invalid Date') {
        throw new Error('Invalid ISO 8601 format');
      }
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'scheduledTime must be a valid ISO 8601 timestamp'
        },
        { status: 400 }
      );
    }

    // 5. Validate scheduledTime is in the future
    const now = new Date();
    if (scheduledDate <= now) {
      return NextResponse.json(
        {
          success: false,
          error: 'scheduledTime must be in the future'
        },
        { status: 400 }
      );
    }

    // 6. Get asset from history using getAsset(assetId)
    let asset;
    try {
      asset = await getAsset(assetId);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to retrieve asset from history'
        },
        { status: 500 }
      );
    }

    // 7. Verify asset exists (404 if not found)
    if (!asset) {
      return NextResponse.json(
        {
          success: false,
          error: 'Asset not found'
        },
        { status: 404 }
      );
    }

    // 8. Verify asset status is 'Ready' (400 if not)
    if (asset.status !== 'Ready') {
      return NextResponse.json(
        {
          success: false,
          error: `Asset status must be 'Ready', current status: '${asset.status}'`
        },
        { status: 400 }
      );
    }

    // 9. Generate final story image by composing background + asset
    // Get the latest background version (active_version)
    if (!asset.active_version || asset.active_version < 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Asset does not have an active version'
        },
        { status: 400 }
      );
    }

    const activeVersion = asset.versions[asset.active_version - 1];
    if (!activeVersion) {
      return NextResponse.json(
        {
          success: false,
          error: `Active version ${asset.active_version} not found in asset versions`
        },
        { status: 400 }
      );
    }

    // Construct file paths (strip leading slash to avoid path.join treating as absolute)
    const backgroundPath = path.join(process.cwd(), 'public', activeVersion.file_path.replace(/^\//, ''));
    const assetPath = path.join(process.cwd(), 'public', asset.asset_url.replace(/^\//, ''));
    const outputFileName = `story-${assetId}-v${asset.active_version}.png`;
    const outputPath = path.join(process.cwd(), 'public', 'uploads', outputFileName);
    const publicUrl = `/uploads/${outputFileName}`;

    // Call composeStory with text overlay options
    let composeResult;
    try {
      composeResult = await composeStory(backgroundPath, assetPath, outputPath, {
        includeText: config.textOverlay?.enabled !== false,
        textOverride: asset.text_overlay_content
      });

      // Log text overlay analytics if available
      if (composeResult.analytics?.text_overlay) {
        const textAnalytics = composeResult.analytics.text_overlay;
        console.log('[Schedule] Text overlay analytics:', {
          enabled: textAnalytics.enabled,
          tier: textAnalytics.position_tier_used,
          shadow: textAnalytics.shadow_type,
          lines: textAnalytics.lines_count,
          renderTime: textAnalytics.render_time_ms,
          failed: textAnalytics.failed,
          fallback: textAnalytics.fallback_applied
        });
      }

      // Check if composition failed
      if (!composeResult.success) {
        throw new Error('Composition failed');
      }
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: `Story composition failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        { status: 500 }
      );
    }

    // Upload to S3 if storage mode is hybrid or s3
    let finalPublicUrl = publicUrl;
    if (config.storage?.mode === 'hybrid' || config.storage?.mode === 's3') {
      try {
        const s3Key = localPathToS3Key(publicUrl);
        const s3Url = await uploadToS3(outputPath, s3Key, 'image/png');
        finalPublicUrl = s3Url;
        console.log(`[Schedule] Uploaded composed story to S3: ${s3Url}`);
      } catch (s3Error) {
        console.error('[Schedule] S3 upload failed:', s3Error);
        if (config.storage?.mode === 's3') {
          return NextResponse.json(
            {
              success: false,
              error: `Failed to upload to S3: ${s3Error instanceof Error ? s3Error.message : 'Unknown error'}`
            },
            { status: 500 }
          );
        }
        // In hybrid mode, fall back to local URL
      }
    }

    // 10. Upload composed story to Instagram via Blotato
    let postId: string;
    try {
      // In S3 mode, Blotato needs to fetch from S3 URL
      // For now, we still pass outputPath and let scheduleStory convert it to URL
      // The finalPublicUrl will be stored in metadata
      postId = await scheduleStory(outputPath, scheduledDate);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: `Blotato API scheduling failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        { status: 500 }
      );
    }

    // 11. Update asset in history
    try {
      await updateHistory((history) => {
        const assetIndex = history.assets.findIndex(a => a.id === assetId);
        if (assetIndex === -1) {
          throw new Error('Asset not found during update');
        }

        const updatedAsset = { ...history.assets[assetIndex] };

        // Set status to 'Scheduled'
        updatedAsset.status = 'Scheduled';

        // Set blotato_post_id
        updatedAsset.blotato_post_id = postId;

        // Set scheduled_time
        updatedAsset.scheduled_time = scheduledTime;

        // Set scheduled_at (current timestamp)
        updatedAsset.scheduled_at = new Date().toISOString();

        // Set updated_at
        updatedAsset.updated_at = new Date().toISOString();

        // Update active version's file_path with composed image path (S3 URL if uploaded)
        const versionIndex = updatedAsset.active_version! - 1;
        const versionUpdate: any = {
          ...updatedAsset.versions[versionIndex],
          file_path: finalPublicUrl
        };

        // Add text overlay analytics to version if available
        if (composeResult.analytics?.text_overlay) {
          const textAnalytics = composeResult.analytics.text_overlay;
          versionUpdate.text_overlay_applied = textAnalytics.enabled && !textAnalytics.failed;
          versionUpdate.text_overlay_content = asset.text_overlay_content || undefined;
          if (textAnalytics.position_tier_used && textAnalytics.position_y) {
            versionUpdate.text_overlay_position = {
              tier: textAnalytics.position_tier_used,
              y: textAnalytics.position_y
            };
          }
          versionUpdate.text_overlay_failed = textAnalytics.failed || false;
          versionUpdate.text_overlay_error = textAnalytics.error;
          versionUpdate.text_overlay_fallback_applied = textAnalytics.fallback_applied || false;
        }

        updatedAsset.versions[versionIndex] = versionUpdate;

        // Store text overlay analytics in asset metadata
        if (composeResult.analytics?.text_overlay) {
          const textAnalytics = composeResult.analytics.text_overlay;
          updatedAsset.text_overlay_analytics = {
            position_tier_used: textAnalytics.position_tier_used!,
            shadow_type: textAnalytics.shadow_type!,
            lines_count: textAnalytics.lines_count!,
            applied_at: new Date().toISOString(),
            render_time_ms: textAnalytics.render_time_ms,
            brightness_samples: textAnalytics.brightness_samples,
            avg_brightness: textAnalytics.avg_brightness
          };
        }

        const updatedAssets = [...history.assets];
        updatedAssets[assetIndex] = updatedAsset;

        return {
          ...history,
          assets: updatedAssets
        };
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to update asset in history: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        { status: 500 }
      );
    }

    // 12. Return success response with scheduling details
    return NextResponse.json(
      {
        success: true,
        data: {
          post_id: postId,
          scheduled_time: scheduledTime,
          asset_id: assetId,
          story_image_path: publicUrl
        }
      },
      { status: 200 }
    );
  } catch (error) {
    // Catch-all for unexpected errors
    return NextResponse.json(
      {
        success: false,
        error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    );
  }
}
