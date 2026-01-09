/**
 * Example: Schedule Single Instagram Story to Blotato API
 *
 * This example demonstrates the complete workflow for scheduling a single Instagram story:
 * 1. Load item from history.json
 * 2. Validate parameters
 * 3. Schedule via Blotato API with retry logic
 * 4. Update history.json with result (using file locking)
 * 5. Log all operations
 *
 * Usage:
 *   import { scheduleSingleStory } from './examples/schedule-single-story';
 *   await scheduleSingleStory('item-uuid-here');
 *
 * @module schedule-single-story
 */

import { readFileSync, writeFileSync } from 'fs';
import lockfile from 'proper-lockfile';
import { retryWithBackoff } from '../lib/retry-with-backoff';
import { validateScheduleParams, validateItemStatus } from '../lib/validate-schedule-params';

interface HistoryItem {
  id: string;
  date: string;
  asset_url: string;
  meta_description: string;
  status: string;
  scheduled_time: string;
  active_version: number;
  versions: Array<{
    version: number;
    file_path: string;
    created_at: string;
  }>;
  blotato_post_id?: string;
  scheduled_at?: string;
  error?: {
    message: string;
    details: string;
    failed_at: string;
    retry_count: number;
  };
}

interface BlotatoScheduleResponse {
  postId: string;
  status: string;
  scheduledTime: string;
  accountId: string;
}

const BLOTATO_API_BASE_URL = process.env.BLOTATO_API_BASE_URL || 'https://api.blotato.com';
const BLOTATO_API_KEY = process.env.BLOTATO_API_KEY!;
const BLOTATO_ACCOUNT_ID = process.env.BLOTATO_ACCOUNT_ID!;
const HISTORY_PATH = './history.json';

/**
 * Schedule a single Instagram story to Blotato
 *
 * @param itemId - UUID of the item in history.json
 * @returns Promise resolving to scheduling result
 * @throws Error if item not found, validation fails, or scheduling fails after all retries
 */
export async function scheduleSingleStory(itemId: string): Promise<{
  success: boolean;
  postId?: string;
  error?: string;
}> {
  console.log(`[Schedule] Starting schedule process for item ${itemId}`);

  // Step 1: Load item from history
  const item = await loadItemFromHistory(itemId);
  if (!item) {
    throw new Error(`Item ${itemId} not found in history.json`);
  }

  console.log(`[Schedule] Loaded item:`, {
    id: item.id,
    status: item.status,
    scheduled_time: item.scheduled_time
  });

  // Step 2: Validate item status
  const statusValidation = validateItemStatus(item.status);
  if (!statusValidation.valid) {
    throw new Error(statusValidation.error);
  }

  // Step 3: Validate scheduled time is in future
  const scheduledTime = new Date(item.scheduled_time);
  if (scheduledTime <= new Date()) {
    throw new Error(
      `Scheduled time must be in the future (got: ${item.scheduled_time})`
    );
  }

  // Step 4: Build media URL
  const activeVersion = item.versions[item.active_version - 1];
  if (!activeVersion) {
    throw new Error(`Active version ${item.active_version} not found`);
  }

  const mediaUrl = `${process.env.NEXT_PUBLIC_BASE_URL}${activeVersion.file_path}`;
  console.log(`[Schedule] Media URL: ${mediaUrl}`);

  // Step 5: Build post data
  const postData = {
    accountId: BLOTATO_ACCOUNT_ID,
    content: {
      text: item.meta_description || 'Freebie of the Day',
      platform: 'instagram' as const
    },
    target: {
      targetType: 'story' as const
    },
    mediaUrls: [mediaUrl],
    scheduledTime: item.scheduled_time // UTC ISO 8601
  };

  // Step 6: Validate post data
  console.log(`[Schedule] Validating parameters...`);
  const validation = await validateScheduleParams(postData);

  if (!validation.valid) {
    const errorMessage = validation.errors
      .map(e => `${e.field}: ${e.message}`)
      .join('; ');
    throw new Error(`Validation failed: ${errorMessage}`);
  }

  if (validation.warnings.length > 0) {
    console.warn(`[Schedule] Warnings:`, validation.warnings);
  }

  // Step 7: Schedule with retry logic
  console.log(`[Schedule] Scheduling to Blotato...`);
  try {
    const response = await scheduleWithRetry(postData);
    console.log(`[Schedule] Success! Post ID: ${response.postId}`);

    // Step 8: Update history with success
    await updateHistoryWithLock(itemId, {
      status: 'Scheduled',
      blotato_post_id: response.postId,
      scheduled_at: new Date().toISOString(),
      error: undefined // Clear any previous errors
    });

    console.log(`[Schedule] Updated history.json successfully`);

    return {
      success: true,
      postId: response.postId
    };
  } catch (error) {
    console.error(`[Schedule] Failed after all retries:`, error);

    // Step 9: Update history with failure
    await updateHistoryWithLock(itemId, {
      status: 'Schedule Failed',
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack || '' : String(error),
        failed_at: new Date().toISOString(),
        retry_count: 3
      }
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Schedule post with exponential backoff retry logic
 */
async function scheduleWithRetry(
  postData: any
): Promise<BlotatoScheduleResponse> {
  return retryWithBackoff(
    async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      try {
        const response = await fetch(`${BLOTATO_API_BASE_URL}/v2/posts`, {
          method: 'POST',
          headers: {
            'blotato-api-key': BLOTATO_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(postData),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorBody}`);
        }

        return await response.json();
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Request timeout after 15 seconds');
        }

        throw error;
      }
    },
    {
      maxRetries: 3,
      delays: [5000, 15000, 45000], // 5s, 15s, 45s per SPEC.md
      onRetry: (attempt, error) => {
        console.log(`[Retry] Attempt ${attempt} failed: ${error.message}`);
        console.log(`[Retry] Waiting before next attempt...`);
      }
    }
  );
}

/**
 * Load item from history.json
 */
function loadItemFromHistory(itemId: string): HistoryItem | null {
  try {
    const history: HistoryItem[] = JSON.parse(
      readFileSync(HISTORY_PATH, 'utf8')
    );
    return history.find(item => item.id === itemId) || null;
  } catch (error) {
    console.error(`[History] Failed to load history.json:`, error);
    throw new Error('Failed to load history file');
  }
}

/**
 * Update history.json with file locking to prevent concurrent write corruption
 */
async function updateHistoryWithLock(
  itemId: string,
  updates: Partial<HistoryItem>
): Promise<void> {
  let release: (() => Promise<void>) | undefined;

  try {
    // Acquire lock with stale detection
    release = await lockfile.lock(HISTORY_PATH, {
      retries: {
        retries: 10,
        minTimeout: 100,
        maxTimeout: 2000
      },
      stale: 10000 // 10 seconds
    });

    console.log(`[History] Acquired lock on ${HISTORY_PATH}`);

    // Read current history
    const history: HistoryItem[] = JSON.parse(readFileSync(HISTORY_PATH, 'utf8'));

    // Find and update item
    const itemIndex = history.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new Error(`Item ${itemId} not found in history`);
    }

    history[itemIndex] = {
      ...history[itemIndex],
      ...updates,
      updated_at: new Date().toISOString()
    };

    // Write atomically
    writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));

    console.log(`[History] Updated item ${itemId}:`, updates);
  } catch (error) {
    console.error(`[History] Failed to update history:`, error);
    throw error;
  } finally {
    // Always release lock
    if (release) {
      await release();
      console.log(`[History] Released lock on ${HISTORY_PATH}`);
    }
  }
}

/**
 * Example usage with error handling
 */
export async function scheduleStoryWithLogging(itemId: string): Promise<void> {
  console.log(`\n========== Scheduling Story ${itemId} ==========\n`);

  try {
    const result = await scheduleSingleStory(itemId);

    if (result.success) {
      console.log(`\n✅ SUCCESS: Story scheduled with post ID: ${result.postId}\n`);
    } else {
      console.error(`\n❌ FAILED: ${result.error}\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exit(1);
  }
}

// CLI usage
if (require.main === module) {
  const itemId = process.argv[2];

  if (!itemId) {
    console.error('Usage: ts-node schedule-single-story.ts <item_id>');
    process.exit(1);
  }

  scheduleStoryWithLogging(itemId);
}
