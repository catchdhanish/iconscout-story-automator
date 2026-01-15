/**
 * Blotato API Client for Instagram Story Scheduling
 *
 * Provides functionality to schedule Instagram stories via Blotato v2 API.
 * Blotato accepts publicly accessible URLs - no separate upload endpoint is needed.
 */

import * as fs from 'fs/promises';
import { config } from './config';

/**
 * Response from Blotato /v2/posts endpoint
 */
interface BlotatoResponse {
  postId: string;
  status: string;
  scheduledTime: string;
}

/**
 * Schedule an Instagram story via Blotato v2 API
 *
 * This function:
 * 1. Converts filesystem path to public URL
 * 2. Sends URL to Blotato (no upload step - Blotato fetches from public URL)
 *
 * @param imagePath - Absolute or relative path to the image file
 * @param scheduledTime - When to publish the story (Date object)
 * @returns Promise resolving to the Blotato post ID
 * @throws Error if API key or account ID is missing
 * @throws Error if image file doesn't exist
 * @throws Error on network failures or timeout
 * @throws Error on non-200 responses from scheduling endpoint
 * @throws Error if response format is invalid
 *
 * @example
 * ```typescript
 * const postId = await scheduleStory(
 *   './public/uploads/story.png',
 *   new Date('2026-01-15T10:00:00Z')
 * );
 * console.log(`Scheduled story with post ID: ${postId}`);
 * ```
 */
export async function scheduleStory(
  imagePath: string,
  scheduledTime: Date
): Promise<string> {
  // Validate API configuration
  if (!config.blotato.apiKey) {
    throw new Error('BLOTATO_API_KEY is not configured');
  }

  if (!config.blotato.accountId) {
    throw new Error('BLOTATO_ACCOUNT_ID is not configured');
  }

  // Verify image file exists
  try {
    await fs.access(imagePath);
  } catch (error) {
    const errorMessage = `Image file not found: ${imagePath}`;
    console.error(`[Blotato Schedule] ${errorMessage}`, error);
    throw new Error(errorMessage);
  }

  // Convert filesystem path to public URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const relativePath = imagePath
    .replace(/^\.\/public/, '')
    .replace(/^public/, '');
  const publicUrl = `${baseUrl}${relativePath}`;

  console.error(`[Blotato Schedule] Converting filesystem path to public URL`);
  console.error(`[Blotato Schedule] - Filesystem path: ${imagePath}`);
  console.error(`[Blotato Schedule] - Public URL: ${publicUrl}`);

  // Warn if using localhost (Blotato cannot access localhost from the internet)
  if (publicUrl.includes('localhost') || publicUrl.includes('127.0.0.1')) {
    console.warn('[Blotato] WARNING: Using localhost URL - Blotato cannot access this from the internet!');
    console.warn('[Blotato] Use ngrok (https://ngrok.com) or deploy to production for actual scheduling.');
  }

  // Build request payload with "post" wrapper (REQUIRED by Blotato API)
  const requestBody = {
    post: {
      accountId: config.blotato.accountId,
      content: {
        text: '',
        mediaUrls: [publicUrl],
        platform: 'instagram' as const,
      },
      target: {
        targetType: 'instagram' as const,
      },
      scheduledTime: scheduledTime.toISOString(), // UTC ISO 8601
    },
  };

  // Set up timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.blotato.timeout);

  try {
    const scheduleEndpoint = `${config.blotato.baseUrl}/v2/posts`;
    console.error(`[Blotato Schedule] Scheduling post to ${scheduleEndpoint}`);
    console.error(`[Blotato Schedule] Request body:`, JSON.stringify(requestBody, null, 2));

    // Make API request to schedule post
    const response = await fetch(scheduleEndpoint, {
      method: 'POST',
      headers: {
        'blotato-api-key': config.blotato.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle non-200 responses
    if (!response.ok) {
      let errorMessage: string;
      let errorDetails: any;

      try {
        const errorBody = await response.text();
        try {
          errorDetails = JSON.parse(errorBody);
          errorMessage = errorDetails.message || errorBody;
        } catch {
          errorMessage = errorBody || response.statusText;
        }
      } catch {
        errorMessage = response.statusText;
      }

      const errorMsg = `Schedule post failed with HTTP ${response.status}: ${errorMessage}`;
      console.error(`[Blotato Schedule] ${errorMsg}`, {
        endpoint: scheduleEndpoint,
        status: response.status,
        details: errorDetails,
        publicUrl,
      });
      throw new Error(errorMsg);
    }

    // Parse and validate response
    const data: BlotatoResponse = await response.json();

    if (!data.postId) {
      const errorMsg = 'Schedule response missing required field: postId';
      console.error(`[Blotato Schedule] ${errorMsg}`, data);
      throw new Error(errorMsg);
    }

    console.error(`[Blotato Schedule] Successfully scheduled post using public URL approach`);
    console.error(`[Blotato Schedule] - Post ID: ${data.postId}`);
    console.error(`[Blotato Schedule] - Media URL: ${publicUrl}`);
    console.error(`[Blotato Schedule] - Scheduled time: ${scheduledTime.toISOString()}`);
    return data.postId;
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle timeout
    if (error instanceof Error && error.name === 'AbortError') {
      const errorMsg = `Schedule post timeout after ${config.blotato.timeout / 1000} seconds`;
      console.error(`[Blotato Schedule] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // Re-throw other errors
    throw error;
  }
}
