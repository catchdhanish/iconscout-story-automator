/**
 * Configuration utility for the Instagram Story automation system
 * Centralizes all environment variables and application settings
 */

/**
 * Application configuration object
 */
export const config = {
  /**
   * OpenRouter API configuration for AI background generation
   */
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'google/gemini-2.5-flash-image',
    maxCallsPerMinute: parseInt(process.env.OPENROUTER_MAX_CALLS_PER_MINUTE || '20', 10),
    timeout: 60000, // Increased timeout for image generation
  },

  /**
   * Blotato API configuration for Instagram story scheduling
   */
  blotato: {
    apiKey: process.env.BLOTATO_API_KEY || '',
    baseUrl: process.env.BLOTATO_API_BASE_URL || 'https://api.blotato.com',
    accountId: process.env.BLOTATO_ACCOUNT_ID || '',
    timeout: 15000,
  },

  /**
   * File system paths
   */
  paths: {
    uploads: './public/uploads',
    temp: './public/temp',
    history: './history.json',
    logs: './logs',
  },

  /**
   * Instagram story specifications and layout calculations
   */
  instagram: {
    width: 1080,
    height: 1920,
    safeZones: {
      top: 250,
      bottom: 180,
    },
    assetZone: {
      width: 756,
      height: 1344,
      xOffset: 162,
      yOffset: 288,
    },
  },
} as const;

/**
 * Validates that all required environment variables are set
 * @throws {Error} If any required environment variables are missing
 */
export function validateConfig(): void {
  const requiredVars = [
    { key: 'OPENROUTER_API_KEY', value: config.openrouter.apiKey },
    { key: 'BLOTATO_API_KEY', value: config.blotato.apiKey },
  ];

  const missingVars = requiredVars.filter(({ value }) => !value);

  if (missingVars.length > 0) {
    const missingKeys = missingVars.map(({ key }) => key).join(', ');
    throw new Error(`Missing required environment variables: ${missingKeys}`);
  }
}
