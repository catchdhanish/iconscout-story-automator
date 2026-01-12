/**
 * Vision Analysis Module
 *
 * Analyzes asset images using AI vision to generate descriptions
 * that inform background generation prompts.
 */

import { promises as fs } from 'fs';
import { config } from './config';

/**
 * Analyze an asset image using Gemini vision to generate a description
 *
 * @param assetPath - Full filesystem path to the asset image
 * @returns Promise<string> - 2-3 sentence description of the asset
 * @throws Error if file doesn't exist or API call fails
 */
export async function analyzeAsset(assetPath: string): Promise<string> {
  try {
    // Read image file
    const imageBuffer = await fs.readFile(assetPath);

    // Convert to base64
    const base64Image = imageBuffer.toString('base64');

    // Determine image type from file extension
    const extension = assetPath.split('.').pop()?.toLowerCase() || 'png';
    const mimeType = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
    const base64DataUrl = `data:${mimeType};base64,${base64Image}`;

    // Vision analysis prompt (from SPEC.md:154-162)
    const prompt = `Analyze this image and describe it in detail. Include:
- What the image depicts (icon, illustration, graphic, etc.)
- Visual style (minimalist, detailed, abstract, photorealistic, etc.)
- Key visual elements or subjects
- Mood or tone (professional, playful, serious, etc.)

Provide a concise description in 2-3 sentences.`;

    // Call OpenRouter API with Gemini vision model
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.openrouter.timeout);

    try {
      const response = await fetch(config.openrouter.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openrouter.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://iconscout.com',
          'X-Title': 'IconScout Story Automator - Vision Analysis'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-exp:free', // Model with vision capabilities
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: base64DataUrl
                  }
                },
                {
                  type: 'text',
                  text: prompt
                }
              ]
            }
          ],
          temperature: 0.7
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
      }

      const data = await response.json();

      // Extract description from response
      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        throw new Error('Invalid vision API response: missing choices array');
      }

      const description = data.choices[0].message?.content;

      if (!description || typeof description !== 'string') {
        throw new Error('Invalid vision API response: missing content');
      }

      return description.trim();

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Vision analysis timeout after ${config.openrouter.timeout}ms`);
      }

      throw error;
    }

  } catch (error) {
    // Log error for debugging
    console.error('Vision analysis failed:', error);

    // Return fallback description
    if (error instanceof Error && error.message.includes('ENOENT')) {
      throw new Error(`Asset file not found: ${assetPath}`);
    }

    // For API errors, throw to allow caller to handle
    throw error;
  }
}
