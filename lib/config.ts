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
   * AWS configuration for S3 storage
   */
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    s3Bucket: process.env.AWS_S3_BUCKET || '',
  },

  /**
   * CloudFront CDN configuration
   */
  cloudFront: {
    enabled: process.env.CLOUDFRONT_ENABLED !== 'false',
    url: process.env.CLOUDFRONT_URL || '',
    domain: process.env.CLOUDFRONT_DISTRIBUTION_DOMAIN || '',
  },

  /**
   * Storage mode configuration
   * - local: Use local filesystem only (legacy mode)
   * - hybrid: Write to both local and S3, read from S3 first with fallback
   * - s3: Use S3 only
   */
  storage: {
    mode: (process.env.STORAGE_MODE || 'local') as 'local' | 'hybrid' | 's3',
  },

  /**
   * Database configuration
   * PostgreSQL connection via Prisma
   */
  database: {
    url: process.env.DATABASE_URL || '',
    enabled: !!process.env.DATABASE_URL,
  },

  /**
   * Temporary directory for image processing
   */
  tempDir: process.env.TEMP_DIR || '/tmp/isa-processing',

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

  /**
   * S3 history backup configuration
   */
  s3: {
    historyBackupEnabled: process.env.S3_HISTORY_BACKUP_ENABLED === 'true',
    historyBackupSchedule: process.env.S3_HISTORY_BACKUP_SCHEDULE || '0 2 * * *',
    historyBackupRetentionDays: parseInt(process.env.S3_HISTORY_BACKUP_RETENTION_DAYS || '90', 10),
    uploadTimeoutMs: parseInt(process.env.S3_UPLOAD_TIMEOUT_MS || '30000', 10),
    uploadMaxRetries: parseInt(process.env.S3_UPLOAD_MAX_RETRIES || '3', 10),
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
