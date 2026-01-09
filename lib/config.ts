/**
 * Configuration utility for the Instagram Story automation system
 * Centralizes all environment variables and application settings
 */

import path from 'path';

/**
 * Application configuration object
 */
export const config = {
  /**
   * OpenRouter API configuration for AI background generation
   */
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'anthropic/claude-3.5-sonnet',
    maxCallsPerMinute: parseInt(process.env.OPENROUTER_MAX_CALLS_PER_MINUTE || '20', 10),
    timeout: 60000, // 60 seconds
  },

  /**
   * Blotato API configuration for Instagram story scheduling
   */
  blotato: {
    apiKey: process.env.BLOTATO_API_KEY || '',
    baseUrl: process.env.BLOTATO_API_BASE_URL || 'https://api.blotato.com',
    accountId: process.env.BLOTATO_ACCOUNT_ID || '',
    timeout: 30000, // 30 seconds
  },

  /**
   * File system paths
   */
  paths: {
    uploads: path.join(process.cwd(), 'public', 'uploads'),
    temp: path.join(process.cwd(), 'public', 'temp'),
    history: path.join(process.cwd(), 'data', 'history.json'),
    logs: path.join(process.cwd(), 'logs'),
  },

  /**
   * Instagram story specifications and layout calculations
   */
  instagram: {
    /**
     * Instagram story dimensions (1080x1920 pixels)
     */
    dimensions: {
      width: 1080,
      height: 1920,
    },

    /**
     * Safe zones to avoid content being cut off
     */
    safeZones: {
      top: 250,    // Account for profile info at top
      bottom: 250, // Account for CTA buttons at bottom
    },

    /**
     * Calculate the asset zone (icon placement area)
     * Returns the dimensions and position of the zone where icons should be placed
     */
    getAssetZone: () => {
      const { width, height } = config.instagram.dimensions;
      const { top, bottom } = config.instagram.safeZones;

      return {
        x: 0,
        y: top,
        width: width,
        height: height - top - bottom,
      };
    },
  },
};

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
