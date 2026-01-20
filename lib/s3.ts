/**
 * AWS S3 Storage Utilities
 *
 * Provides abstraction layer for S3 operations with fallback to local storage
 * during migration. Supports hybrid mode for gradual cutover.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import path from 'path';
import { config } from './config';
import { Readable } from 'stream';

// Storage mode type
export type StorageMode = 'local' | 's3' | 'hybrid';

/**
 * Lazily initialize S3 client only when needed
 */
let s3ClientInstance: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3ClientInstance) {
    if (!config.aws?.region || !config.aws?.accessKeyId || !config.aws?.secretAccessKey) {
      throw new Error('AWS credentials not configured. Set AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY environment variables.');
    }

    s3ClientInstance = new S3Client({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
    });
  }

  return s3ClientInstance;
}

/**
 * Retry utility for S3 operations
 */
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`[S3] Operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Convert local filesystem path to S3 key
 * Strips /public/ prefix and normalizes path
 *
 * @example
 * localPathToS3Key('/uploads/abc-123.png') → 'uploads/abc-123.png'
 * localPathToS3Key('/public/uploads/abc-123.png') → 'uploads/abc-123.png'
 */
export function localPathToS3Key(localPath: string): string {
  let normalized = localPath;

  // Remove leading slash
  if (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }

  // Remove 'public/' prefix if present
  if (normalized.startsWith('public/')) {
    normalized = normalized.slice(7);
  }

  // Remove any remaining leading slashes
  normalized = normalized.replace(/^\/+/, '');

  return normalized;
}

/**
 * Convert S3 key to local filesystem path
 * Adds /public/ prefix for compatibility
 *
 * @example
 * s3KeyToLocalPath('uploads/abc-123.png') → '/uploads/abc-123.png'
 */
export function s3KeyToLocalPath(s3Key: string): string {
  // Ensure leading slash
  return s3Key.startsWith('/') ? s3Key : `/${s3Key}`;
}

/**
 * Detect MIME type from file extension
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Get public URL for S3 object
 * @param s3Key - S3 key (without bucket name)
 * @param useCloudFront - Use CloudFront URL if configured (default: true)
 * @returns Public URL
 */
export function getPublicUrl(s3Key: string, useCloudFront = true): string {
  // Ensure s3Key doesn't start with slash
  const normalizedKey = s3Key.startsWith('/') ? s3Key.slice(1) : s3Key;

  // In local mode, return local URL
  if (config.storage?.mode === 'local') {
    return s3KeyToLocalPath(normalizedKey);
  }

  // Use CloudFront if enabled and requested
  if (useCloudFront && config.cloudFront?.enabled && config.cloudFront?.url) {
    return `${config.cloudFront.url}/${normalizedKey}`;
  }

  // Fallback to S3 direct URL
  const bucket = config.aws?.s3Bucket;
  const region = config.aws?.region || 'us-east-1';

  if (!bucket) {
    throw new Error('S3 bucket not configured');
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${normalizedKey}`;
}

/**
 * Upload file to S3
 * @param localPath - Local filesystem path to upload
 * @param s3Key - S3 key (path within bucket)
 * @param contentType - MIME type (default: auto-detect from extension)
 * @returns Public URL (CloudFront or S3)
 */
export async function uploadToS3(
  localPath: string,
  s3Key: string,
  contentType?: string
): Promise<string> {
  const client = getS3Client();
  const bucket = config.aws?.s3Bucket;

  if (!bucket) {
    throw new Error('S3 bucket not configured');
  }

  // Normalize S3 key
  const normalizedKey = localPathToS3Key(s3Key);

  // Read file
  const fileBuffer = await fs.readFile(localPath);

  // Auto-detect content type if not provided
  const finalContentType = contentType || getMimeType(localPath);

  // Upload with retry logic
  await retryOperation(async () => {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: normalizedKey,
      Body: fileBuffer,
      ContentType: finalContentType,
    });

    await client.send(command);
  });

  console.log(`[S3] Uploaded: ${localPath} → s3://${bucket}/${normalizedKey}`);

  return getPublicUrl(normalizedKey);
}

/**
 * Download file from S3 to local filesystem
 * @param s3Key - S3 key to download
 * @param localPath - Destination path on local filesystem
 * @returns Local path where file was saved
 */
export async function downloadFromS3(
  s3Key: string,
  localPath: string
): Promise<string> {
  const client = getS3Client();
  const bucket = config.aws?.s3Bucket;

  if (!bucket) {
    throw new Error('S3 bucket not configured');
  }

  // Normalize S3 key
  const normalizedKey = localPathToS3Key(s3Key);

  // Ensure destination directory exists
  const dir = path.dirname(localPath);
  await fs.mkdir(dir, { recursive: true });

  // Download with retry logic
  const response = await retryOperation(async () => {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: normalizedKey,
    });

    return await client.send(command);
  });

  // Convert Body stream to buffer
  const body = response.Body;
  if (!body) {
    throw new Error(`Empty response body for S3 key: ${normalizedKey}`);
  }

  // Handle both Node.js streams and Web streams
  let buffer: Buffer;

  if (body instanceof Readable) {
    // Node.js stream
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.from(chunk));
    }
    buffer = Buffer.concat(chunks);
  } else {
    // Web stream or other
    const arrayBuffer = await body.transformToByteArray();
    buffer = Buffer.from(arrayBuffer);
  }

  // Write to local file
  await fs.writeFile(localPath, buffer);

  console.log(`[S3] Downloaded: s3://${bucket}/${normalizedKey} → ${localPath}`);

  return localPath;
}

/**
 * Delete file from S3
 * @param s3Key - S3 key to delete
 */
export async function deleteFromS3(s3Key: string): Promise<void> {
  const client = getS3Client();
  const bucket = config.aws?.s3Bucket;

  if (!bucket) {
    throw new Error('S3 bucket not configured');
  }

  // Normalize S3 key
  const normalizedKey = localPathToS3Key(s3Key);

  await retryOperation(async () => {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: normalizedKey,
    });

    await client.send(command);
  });

  console.log(`[S3] Deleted: s3://${bucket}/${normalizedKey}`);
}

/**
 * Check if file exists in S3
 * @param s3Key - S3 key to check
 * @returns True if file exists
 */
export async function existsInS3(s3Key: string): Promise<boolean> {
  const client = getS3Client();
  const bucket = config.aws?.s3Bucket;

  if (!bucket) {
    throw new Error('S3 bucket not configured');
  }

  // Normalize S3 key
  const normalizedKey = localPathToS3Key(s3Key);

  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: normalizedKey,
    });

    await client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Backup history.json to S3 with timestamp
 * @param historyPath - Path to history.json file
 * @returns S3 key of backup
 */
export async function backupHistoryToS3(historyPath: string): Promise<string> {
  const client = getS3Client();
  const bucket = config.aws?.s3Bucket;

  if (!bucket) {
    throw new Error('S3 bucket not configured');
  }

  // Generate timestamped key
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const date = new Date().toISOString().split('T')[0];
  const s3Key = `backups/history-${date}-${timestamp}.json`;

  // Read history file
  const historyContent = await fs.readFile(historyPath, 'utf8');

  // Upload with retry logic
  await retryOperation(async () => {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: historyContent,
      ContentType: 'application/json',
      Metadata: {
        'original-path': historyPath,
        'backup-timestamp': timestamp,
      },
    });

    await client.send(command);
  });

  console.log(`[S3] History backup created: s3://${bucket}/${s3Key}`);

  return s3Key;
}

/**
 * Hybrid storage: Upload to S3 and optionally keep local copy
 * @param localPath - Source file path
 * @param s3Key - Destination S3 key
 * @param keepLocal - Keep local copy after upload (default: false in production)
 * @returns Object with s3Url and optional localPath
 */
export async function hybridUpload(
  localPath: string,
  s3Key: string,
  keepLocal = false
): Promise<{ s3Url: string; localPath?: string }> {
  // Upload to S3
  const s3Url = await uploadToS3(localPath, s3Key);

  // Optionally remove local file
  if (!keepLocal && config.storage?.mode === 's3') {
    try {
      await fs.unlink(localPath);
      console.log(`[S3] Removed local file after S3 upload: ${localPath}`);
    } catch (error) {
      console.warn(`[S3] Failed to remove local file: ${localPath}`, error);
    }
  }

  return {
    s3Url,
    localPath: keepLocal ? localPath : undefined,
  };
}

/**
 * Hybrid storage: Download from S3 with local cache
 * Checks local cache first, downloads from S3 if missing
 * @param s3Key - S3 key to download
 * @param localPath - Local cache path
 * @returns Local path where file is available
 */
export async function hybridDownload(
  s3Key: string,
  localPath: string
): Promise<string> {
  // Check if file exists locally
  try {
    await fs.access(localPath);
    console.log(`[S3] Using local cache: ${localPath}`);
    return localPath;
  } catch {
    // File doesn't exist locally, download from S3
    console.log(`[S3] Local cache miss, downloading from S3: ${s3Key}`);
    return await downloadFromS3(s3Key, localPath);
  }
}
