/**
 * Blotato API Client for Instagram Story Scheduling
 *
 * Provides functionality to schedule Instagram stories via Blotato v2 API
 * using a two-step process:
 * 1. Upload image to /v2/media/upload to get media URL
 * 2. Schedule post to /v2/posts with JSON payload
 */

import * as fs from 'fs/promises';
import { config } from './config';

/**
 * Response from Blotato /v2/media/upload endpoint
 */
interface MediaUploadResponse {
  mediaUrl: string;
  mediaId: string;
}

/**
 * Response from Blotato /v2/posts endpoint
 */
interface BlotatoResponse {
  postId: string;
  status: string;
  scheduledTime: string;
}

/**
 * Upload an image to Blotato and get a media URL
 *
 * @param imagePath - Absolute path to the image file
 * @returns Promise resolving to the media URL
 * @throws Error if API key is missing
 * @throws Error if image file doesn't exist
 * @throws Error on network failures or timeout
 * @throws Error on non-200 responses
 * @throws Error if response format is invalid
 */
async function uploadImageToBlotato(imagePath: string): Promise<string> {
  // Validate API configuration
  if (!config.blotato.apiKey) {
    throw new Error('BLOTATO_API_KEY is not configured');
  }

  // Read image file as buffer (will throw if file doesn't exist)
  let imageBuffer: Buffer;
  try {
    imageBuffer = await fs.readFile(imagePath);
  } catch (error) {
    const errorMessage = `Image file not found: ${imagePath}`;
    console.error(`[Blotato Upload] ${errorMessage}`, error);
    throw new Error(errorMessage);
  }

  // Create FormData with image file
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' });
  const fileName = imagePath.split('/').pop() || 'image.png';
  formData.append('media', blob, fileName);

  // Set up timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.blotato.timeout);

  try {
    const uploadEndpoint = `${config.blotato.baseUrl}/v2/media/upload`;
    console.error(`[Blotato Upload] Uploading image to ${uploadEndpoint}`);

    // Make API request to upload media
    const response = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: {
        'blotato-api-key': config.blotato.apiKey,
      },
      body: formData,
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

      const errorMsg = `Media upload failed with HTTP ${response.status}: ${errorMessage}`;
      console.error(`[Blotato Upload] ${errorMsg}`, { endpoint: uploadEndpoint, status: response.status, details: errorDetails });
      throw new Error(errorMsg);
    }

    // Parse and validate response
    const data: MediaUploadResponse = await response.json();

    if (!data.mediaUrl) {
      const errorMsg = 'Media upload response missing required field: mediaUrl';
      console.error(`[Blotato Upload] ${errorMsg}`, data);
      throw new Error(errorMsg);
    }

    console.error(`[Blotato Upload] Successfully uploaded image, mediaUrl: ${data.mediaUrl}`);
    return data.mediaUrl;
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle timeout
    if (error instanceof Error && error.name === 'AbortError') {
      const errorMsg = `Media upload timeout after ${config.blotato.timeout / 1000} seconds`;
      console.error(`[Blotato Upload] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Schedule an Instagram story via Blotato v2 API
 *
 * This function performs a two-step process:
 * 1. Uploads the image to Blotato to get a media URL
 * 2. Schedules the post with the media URL
 *
 * @param imagePath - Absolute path to the image file
 * @param scheduledTime - When to publish the story (Date object)
 * @param text - Optional text caption for the story (defaults to 'Freebie of the Day')
 * @returns Promise resolving to the Blotato post ID
 * @throws Error if API key or account ID is missing
 * @throws Error if image file doesn't exist
 * @throws Error on media upload failures
 * @throws Error on network failures or timeout
 * @throws Error on non-200 responses from scheduling endpoint
 * @throws Error if response format is invalid
 *
 * @example
 * ```typescript
 * const postId = await scheduleStory(
 *   './public/uploads/story.png',
 *   new Date('2026-01-15T10:00:00Z'),
 *   'Check out this amazing freebie!'
 * );
 * console.log(`Scheduled story with post ID: ${postId}`);
 * ```
 */
export async function scheduleStory(
  imagePath: string,
  scheduledTime: Date,
  text: string = 'Freebie of the Day'
): Promise<string> {
  // Validate API configuration
  if (!config.blotato.apiKey) {
    throw new Error('BLOTATO_API_KEY is not configured');
  }

  if (!config.blotato.accountId) {
    throw new Error('BLOTATO_ACCOUNT_ID is not configured');
  }

  // Step 1: Upload image to get media URL
  console.error(`[Blotato Schedule] Step 1: Uploading image from ${imagePath}`);
  const mediaUrl = await uploadImageToBlotato(imagePath);

  // Step 2: Schedule post with media URL
  console.error(`[Blotato Schedule] Step 2: Scheduling post with mediaUrl: ${mediaUrl}`);

  // Build post data payload
  const postData = {
    accountId: config.blotato.accountId,
    content: {
      text: text,
      platform: 'instagram' as const,
    },
    target: {
      targetType: 'story' as const,
    },
    mediaUrls: [mediaUrl],
    scheduledTime: scheduledTime.toISOString(), // UTC ISO 8601
  };

  // Set up timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.blotato.timeout);

  try {
    const scheduleEndpoint = `${config.blotato.baseUrl}/v2/posts`;
    console.error(`[Blotato Schedule] Scheduling post to ${scheduleEndpoint}`, { postData });

    // Make API request to schedule post
    const response = await fetch(scheduleEndpoint, {
      method: 'POST',
      headers: {
        'blotato-api-key': config.blotato.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData),
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
      console.error(`[Blotato Schedule] ${errorMsg}`, { endpoint: scheduleEndpoint, status: response.status, details: errorDetails });
      throw new Error(errorMsg);
    }

    // Parse and validate response
    const data: BlotatoResponse = await response.json();

    if (!data.postId) {
      const errorMsg = 'Schedule response missing required field: postId';
      console.error(`[Blotato Schedule] ${errorMsg}`, data);
      throw new Error(errorMsg);
    }

    console.error(`[Blotato Schedule] Successfully scheduled post, postId: ${data.postId}`);
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
