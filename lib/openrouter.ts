/**
 * OpenRouter API client for generating Instagram Story backgrounds
 * Uses Google Gemini image generation models via OpenRouter
 */

import { config } from './config';

/**
 * Generate background image using OpenRouter API
 *
 * @param systemPrompt - System prompt for background generation context
 * @param userPrompt - User prompt with specific background requirements
 * @returns Promise<string> - Generated image as base64 data URL or image URL
 * @throws Error if API key is missing, network fails, timeout occurs, or response is invalid
 */
export async function generateBackground(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  // Validate API key exists
  if (!config.openrouter.apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is required');
  }

  // Create abort controller for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.openrouter.timeout);

  try {
    // Make request to OpenRouter API
    const response = await fetch(config.openrouter.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openrouter.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://iconscout.com',
        'X-Title': 'IconScout Story Automator'
      },
      body: JSON.stringify({
        model: config.openrouter.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7
      }),
      signal: controller.signal
    });

    // Clear timeout since request completed
    clearTimeout(timeoutId);

    // Handle non-200 responses
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    // Parse response
    const data = await response.json();

    // Log response for debugging
    console.log('OpenRouter API Response:', JSON.stringify(data, null, 2));

    // Validate response format
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error(`Invalid response format: missing choices array. Response: ${JSON.stringify(data)}`);
    }

    const choice = data.choices[0];

    // For image generation, check for different possible response structures
    // Priority 1: Check for images array (Gemini 2.5 Flash Image format)
    if (choice.message?.images && Array.isArray(choice.message.images) && choice.message.images.length > 0) {
      const imageData = choice.message.images[0];
      if (imageData.image_url?.url) {
        return imageData.image_url.url;
      }
    }

    // Priority 2: Standard text content
    if (choice.message?.content) {
      return choice.message.content;
    }

    // Priority 3: Image URL format
    if (choice.message?.image_url) {
      return choice.message.image_url;
    }

    // Priority 4: Tool calls format
    if (choice.message?.tool_calls) {
      const toolCall = choice.message.tool_calls.find((tc: any) => tc.type === 'image');
      if (toolCall?.image) {
        return toolCall.image;
      }
    }

    // Priority 5: Direct image field
    if (choice.image) {
      return choice.image;
    }

    throw new Error(`Invalid response format: no content found. Response: ${JSON.stringify(choice)}`);
  } catch (error) {
    // Clear timeout in case of error
    clearTimeout(timeoutId);

    // Handle abort error (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${config.openrouter.timeout}ms`);
    }

    // Handle network errors
    if (error instanceof TypeError) {
      throw new Error(`Network error: ${error.message}`);
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Save a base64-encoded image to the filesystem
 *
 * @param base64Data - Base64 data URL (e.g., "data:image/png;base64,...")
 * @param outputPath - Full filesystem path where image should be saved
 * @returns Promise<void>
 * @throws Error if data URL format is invalid or file write fails
 */
export async function saveBase64Image(
  base64Data: string,
  outputPath: string
): Promise<void> {
  try {
    // Parse base64 data URL format: data:image/png;base64,<data>
    const matches = base64Data.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);

    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 data URL format. Expected: data:image/<type>;base64,<data>');
    }

    const base64Content = matches[2];

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Content, 'base64');

    // Ensure directory exists
    const { promises: fs } = await import('fs');
    const path = await import('path');
    const dir = path.dirname(outputPath);

    await fs.mkdir(dir, { recursive: true });

    // Write buffer to file
    await fs.writeFile(outputPath, buffer);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to save base64 image: ${error.message}`);
    }
    throw new Error('Failed to save base64 image: Unknown error');
  }
}
