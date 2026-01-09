/**
 * Blotato API Client for Instagram Story Scheduling
 *
 * Provides functionality to schedule Instagram stories via Blotato API
 * using multipart/form-data file uploads.
 */

import * as fs from 'fs/promises';
import { config } from './config';

/**
 * Blotato API response format
 */
interface BlotatoResponse {
  success: boolean;
  data: {
    post_id: string;
    scheduled_time: string;
    status: string;
  };
}

/**
 * Schedule an Instagram story via Blotato API
 *
 * @param imagePath - Absolute path to the image file
 * @param scheduledTime - When to publish the story
 * @returns Promise resolving to the Blotato post ID
 * @throws Error if API key or account ID is missing
 * @throws Error if image file doesn't exist
 * @throws Error on network failures or timeout
 * @throws Error on non-200 responses
 * @throws Error if response format is invalid
 *
 * @example
 * ```typescript
 * const postId = await scheduleStory('./public/uploads/story.png', new Date('2026-01-15T10:00:00Z'));
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

  // Read image file as buffer (will throw if file doesn't exist)
  let imageBuffer: Buffer;
  try {
    imageBuffer = await fs.readFile(imagePath);
  } catch (error) {
    throw new Error(`Image file not found: ${imagePath}`);
  }

  // Create FormData with required fields
  const formData = new FormData();
  formData.append('account_id', config.blotato.accountId);

  // Create a Blob from the buffer and append as file
  const blob = new Blob([imageBuffer], { type: 'image/png' });
  const fileName = imagePath.split('/').pop() || 'image.png';
  formData.append('image', blob, fileName);

  formData.append('scheduled_time', scheduledTime.toISOString());

  // Set up timeout controller
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.blotato.timeout);

  try {
    // Make API request
    const response = await fetch(
      `${config.blotato.baseUrl}/v1/instagram/stories/schedule`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.blotato.apiKey}`,
        },
        body: formData,
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    // Handle non-200 responses
    if (!response.ok) {
      let errorMessage: string;
      try {
        const errorBody = await response.text();
        errorMessage = errorBody || response.statusText;
      } catch {
        errorMessage = response.statusText;
      }
      throw new Error(`HTTP ${response.status}: ${errorMessage}`);
    }

    // Parse and validate response
    const data: BlotatoResponse = await response.json();

    if (!data.success) {
      throw new Error('API returned success: false');
    }

    if (!data.data?.post_id) {
      throw new Error('Response missing required field: data.post_id');
    }

    return data.data.post_id;
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle timeout
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout after 15 seconds');
    }

    // Re-throw other errors
    throw error;
  }
}
