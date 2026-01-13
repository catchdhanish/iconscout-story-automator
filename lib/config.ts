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

  /**
   * Text overlay configuration for Instagram Stories
   */
  textOverlay: {
    enabled: process.env.TEXT_OVERLAY_ENABLED !== 'false',
    defaultContent: process.env.DEFAULT_TEXT_OVERLAY_CONTENT ||
      'Get this exclusive premium asset for free (today only!) - link in bio',
    concurrency: parseInt(process.env.TEXT_OVERLAY_CONCURRENCY || '3', 10),
    timeout: 10000,
    font: {
      family: 'DM Sans',
      path: 'public/fonts/DMSans-Variable.woff2',
      size: 42,
      weight: '700'
    },
    positioning: {
      tier1Y: 1560,
      tier2Y: 1520,
      tier3Y: 1480,
      maxWidth: 900,
      marginX: 90
    }
  },

  /**
   * Preview configuration
   */
  preview: {
    retentionDays: parseInt(process.env.PREVIEW_RETENTION_DAYS || '30', 10),
    bulkApprovalLimit: parseInt(process.env.BULK_APPROVAL_LIMIT || '50', 10),
  },
} as const;

/**
 * Export commonly used config values for convenience
 */
export const BULK_APPROVAL_LIMIT = config.preview.bulkApprovalLimit;

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
