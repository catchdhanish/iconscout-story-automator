/**
 * Blotato API Status Check Utility
 *
 * Polls Blotato API to verify post status and maps Blotato status to ISA status.
 * Used for background verification jobs after scheduled time passes.
 *
 * @module check-blotato-status
 */

import { retryWithBackoff } from './retry-with-backoff';

export type BlotatoStatus = 'scheduled' | 'published' | 'live' | 'failed';
export type ISAStatus = 'Scheduled' | 'Published' | 'Schedule Failed';

export interface BlotatoPostResponse {
  postId: string;
  status: BlotatoStatus;
  scheduledTime?: string;
  publishedAt?: string;
  accountId?: string;
  mediaUrls?: string[];
}

export interface StatusCheckResult {
  postId: string;
  blotatoStatus: BlotatoStatus | 'not_found' | 'error';
  isaStatus: ISAStatus;
  scheduledTime?: string;
  publishedAt?: string;
  verifiedAt: string;
  error?: string;
}

/**
 * Check post status on Blotato API
 *
 * @param postId - Blotato post ID
 * @param withRetry - Whether to retry on network errors (default: true)
 * @returns Status check result
 *
 * @example
 * ```typescript
 * const result = await checkBlotatoStatus('blot_abc123');
 * if (result.isaStatus === 'Published') {
 *   await updateHistory(itemId, {
 *     status: 'Published',
 *     published_at: result.publishedAt,
 *     verified_at: result.verifiedAt
 *   });
 * }
 * ```
 */
export async function checkBlotatoStatus(
  postId: string,
  withRetry: boolean = true
): Promise<StatusCheckResult> {
  const BLOTATO_API_BASE_URL =
    process.env.BLOTATO_API_BASE_URL || 'https://api.blotato.com';
  const BLOTATO_API_KEY = process.env.BLOTATO_API_KEY;

  if (!BLOTATO_API_KEY) {
    throw new Error('BLOTATO_API_KEY environment variable not set');
  }

  const fetchStatus = async (): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
      const response = await fetch(
        `${BLOTATO_API_BASE_URL}/v2/posts/${postId}`,
        {
          method: 'GET',
          headers: {
            'blotato-api-key': BLOTATO_API_KEY
          },
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  try {
    let response: Response;

    if (withRetry) {
      // Use retry logic for network errors
      response = await retryWithBackoff(fetchStatus, {
        maxRetries: 2, // Fewer retries for status checks
        delays: [3000, 10000] // Shorter delays
      });
    } else {
      response = await fetchStatus();
    }

    // Handle 404 - post not found
    if (response.status === 404) {
      return {
        postId,
        blotatoStatus: 'not_found',
        isaStatus: 'Schedule Failed',
        verifiedAt: new Date().toISOString(),
        error: 'Post not found on Blotato (may have been deleted)'
      };
    }

    // Handle other non-2xx responses
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Parse response
    const data: BlotatoPostResponse = await response.json();

    // Map Blotato status to ISA status
    const isaStatus = mapBlotatoStatusToISA(data.status);

    return {
      postId,
      blotatoStatus: data.status,
      isaStatus,
      scheduledTime: data.scheduledTime,
      publishedAt: data.publishedAt,
      verifiedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      postId,
      blotatoStatus: 'error',
      isaStatus: 'Schedule Failed',
      verifiedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Map Blotato status to ISA status
 */
function mapBlotatoStatusToISA(blotatoStatus: BlotatoStatus): ISAStatus {
  switch (blotatoStatus) {
    case 'published':
    case 'live':
      return 'Published';
    case 'scheduled':
      return 'Scheduled';
    case 'failed':
      return 'Schedule Failed';
    default:
      return 'Schedule Failed';
  }
}

/**
 * Check status for multiple posts in parallel
 *
 * @param postIds - Array of Blotato post IDs
 * @param concurrency - Number of concurrent requests (default: 5)
 * @returns Array of status check results
 *
 * @example
 * ```typescript
 * const postIds = ['blot_abc123', 'blot_def456', 'blot_ghi789'];
 * const results = await checkBlotatoStatusBatch(postIds);
 * results.forEach(result => {
 *   console.log(`${result.postId}: ${result.isaStatus}`);
 * });
 * ```
 */
export async function checkBlotatoStatusBatch(
  postIds: string[],
  concurrency: number = 5
): Promise<StatusCheckResult[]> {
  const results: StatusCheckResult[] = [];

  // Process in batches to respect rate limits
  for (let i = 0; i < postIds.length; i += concurrency) {
    const batch = postIds.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(postId => checkBlotatoStatus(postId))
    );
    results.push(...batchResults);

    // Small delay between batches to avoid rate limiting
    if (i + concurrency < postIds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Check if a post is ready for verification
 * (Scheduled time has passed)
 */
export function isReadyForVerification(
  scheduledTime: string,
  currentStatus: string
): boolean {
  if (currentStatus !== 'Scheduled') {
    return false;
  }

  const scheduled = new Date(scheduledTime);
  const now = new Date();

  return now > scheduled;
}

/**
 * Determine if status check should trigger status update
 */
export function shouldUpdateStatus(
  currentISAStatus: string,
  newISAStatus: ISAStatus
): boolean {
  // Only update if status changed to Published or Schedule Failed
  if (currentISAStatus === newISAStatus) {
    return false;
  }

  // Allow transitions: Scheduled → Published
  if (currentISAStatus === 'Scheduled' && newISAStatus === 'Published') {
    return true;
  }

  // Allow transitions: Scheduled → Schedule Failed
  if (currentISAStatus === 'Scheduled' && newISAStatus === 'Schedule Failed') {
    return true;
  }

  return false;
}

/**
 * Format status check result for logging
 */
export function formatStatusCheckForLog(result: StatusCheckResult): object {
  return {
    postId: result.postId,
    blotatoStatus: result.blotatoStatus,
    isaStatus: result.isaStatus,
    publishedAt: result.publishedAt,
    verifiedAt: result.verifiedAt,
    error: result.error
  };
}

/**
 * Generate user-friendly message for status check result
 */
export function getStatusCheckMessage(result: StatusCheckResult): string {
  switch (result.isaStatus) {
    case 'Published':
      return `Story successfully published at ${result.publishedAt}`;
    case 'Scheduled':
      return `Story still scheduled for ${result.scheduledTime}`;
    case 'Schedule Failed':
      if (result.blotatoStatus === 'not_found') {
        return 'Story not found on Blotato (may have been deleted)';
      } else if (result.error) {
        return `Status check failed: ${result.error}`;
      } else {
        return 'Story publication failed on Blotato';
      }
    default:
      return 'Unknown status';
  }
}
