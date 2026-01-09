/**
 * OpenRouter API client for generating Instagram Story backgrounds
 * Uses Google Gemini 2.0 Flash model via OpenRouter
 */

import { config } from './config';

/**
 * Generate background description using OpenRouter API
 *
 * @param systemPrompt - System prompt for background generation context
 * @param userPrompt - User prompt with specific background requirements
 * @returns Promise<string> - Generated background description
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
        temperature: 0.7,
        max_tokens: 1024
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

    // Validate response format
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error('Invalid response format: missing choices array');
    }

    if (!data.choices[0].message || !data.choices[0].message.content) {
      throw new Error('Invalid response format: missing message content');
    }

    // Extract and return generated content
    return data.choices[0].message.content;
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
