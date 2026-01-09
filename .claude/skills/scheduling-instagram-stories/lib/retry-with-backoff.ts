/**
 * Exponential Backoff Retry Utility for Blotato API
 *
 * Implements retry logic with exponential backoff delays as per SPEC.md:
 * - Attempt 1: Wait 5 seconds
 * - Attempt 2: Wait 15 seconds
 * - Attempt 3: Wait 45 seconds
 * - Total: 4 attempts (initial + 3 retries)
 *
 * @module retry-with-backoff
 */

export interface RetryConfig {
  maxRetries?: number;
  delays?: number[];
  onRetry?: (attempt: number, error: Error) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attemptCount: number;
}

/**
 * Default retry configuration per SPEC.md requirements
 */
const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  delays: [5000, 15000, 45000], // milliseconds
  onRetry: () => {}
};

/**
 * Execute an async function with exponential backoff retry logic
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @returns Promise resolving to function result
 * @throws Error after all retries exhausted
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   () => scheduleToBlotato(postData),
 *   {
 *     onRetry: (attempt, error) => {
 *       console.log(`Retry attempt ${attempt}: ${error.message}`);
 *     }
 *   }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const { maxRetries, delays, onRetry } = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = delays[attempt] || delays[delays.length - 1];
        onRetry(attempt + 1, lastError);
        await sleep(delay);
        continue;
      }

      // All retries exhausted
      break;
    }
  }

  throw lastError!;
}

/**
 * Execute an async function with retry and return structured result
 * (non-throwing version)
 *
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @returns Promise resolving to retry result object
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoffSafe(() => scheduleToBlotato(postData));
 * if (result.success) {
 *   console.log('Scheduled successfully:', result.data);
 * } else {
 *   console.error('Failed after retries:', result.error);
 * }
 * ```
 */
export async function retryWithBackoffSafe<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<RetryResult<T>> {
  const { maxRetries, delays, onRetry } = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error;
  let attemptCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attemptCount++;

    try {
      const result = await fn();
      return {
        success: true,
        data: result,
        attemptCount
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = delays[attempt] || delays[delays.length - 1];
        onRetry(attempt + 1, lastError);
        await sleep(delay);
        continue;
      }

      // All retries exhausted
      break;
    }
  }

  return {
    success: false,
    error: lastError!,
    attemptCount
  };
}

/**
 * Helper function to sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry with backoff for fetch requests specifically
 * Includes timeout handling and response validation
 *
 * @param url - Request URL
 * @param options - Fetch options
 * @param config - Retry configuration
 * @param timeout - Request timeout in milliseconds (default: 15000)
 * @returns Promise resolving to Response
 *
 * @example
 * ```typescript
 * const response = await retryFetch(
 *   'https://api.blotato.com/v2/posts',
 *   {
 *     method: 'POST',
 *     headers: { 'blotato-api-key': apiKey },
 *     body: JSON.stringify(postData)
 *   },
 *   { maxRetries: 3 },
 *   15000 // 15 second timeout
 * );
 * ```
 */
export async function retryFetch(
  url: string,
  options: RequestInit = {},
  config: RetryConfig = {},
  timeout: number = 15000
): Promise<Response> {
  return retryWithBackoff(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Throw on non-2xx responses to trigger retry
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }

      throw error;
    }
  }, config);
}

/**
 * Create a retry wrapper function with pre-configured settings
 *
 * @param config - Default retry configuration
 * @returns Retry function with pre-configured settings
 *
 * @example
 * ```typescript
 * const retryBlotato = createRetrier({
 *   maxRetries: 3,
 *   onRetry: (attempt, error) => {
 *     logger.warn(`Blotato API retry attempt ${attempt}`, { error: error.message });
 *   }
 * });
 *
 * // Use the configured retrier
 * const result = await retryBlotato(() => schedulePost(data));
 * ```
 */
export function createRetrier(config: RetryConfig = {}) {
  return <T>(fn: () => Promise<T>): Promise<T> => {
    return retryWithBackoff(fn, config);
  };
}
