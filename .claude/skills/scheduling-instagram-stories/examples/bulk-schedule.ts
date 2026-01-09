/**
 * Example: Bulk Schedule Instagram Stories to Blotato API
 *
 * This example demonstrates bulk scheduling of multiple Instagram stories:
 * 1. Load multiple items from history.json
 * 2. Process sequentially to avoid rate limiting
 * 3. Track progress per item
 * 4. Provide summary results
 * 5. Handle partial success/failure gracefully
 *
 * Usage:
 *   import { bulkScheduleStories } from './examples/bulk-schedule';
 *   const result = await bulkScheduleStories(['id1', 'id2', 'id3']);
 *
 * @module bulk-schedule
 */

import { scheduleSingleStory } from './schedule-single-story';

export interface BulkScheduleItem {
  id: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  postId?: string;
  error?: string;
  processedAt?: string;
}

export interface BulkScheduleResult {
  total: number;
  success: number;
  failed: number;
  items: BulkScheduleItem[];
  startTime: string;
  endTime: string;
  duration: number; // milliseconds
}

/**
 * Bulk schedule multiple Instagram stories
 *
 * @param itemIds - Array of item UUIDs to schedule
 * @param options - Bulk scheduling options
 * @returns Promise resolving to bulk schedule result
 *
 * @example
 * ```typescript
 * const itemIds = ['item-uuid-1', 'item-uuid-2', 'item-uuid-3'];
 * const result = await bulkScheduleStories(itemIds, {
 *   delayBetweenRequests: 1000,
 *   onProgress: (current, total, item) => {
 *     console.log(`Scheduling ${current}/${total}: ${item.id} - ${item.status}`);
 *   }
 * });
 *
 * console.log(`\nSummary: ${result.success} succeeded, ${result.failed} failed`);
 * ```
 */
export async function bulkScheduleStories(
  itemIds: string[],
  options: {
    delayBetweenRequests?: number; // milliseconds
    onProgress?: (current: number, total: number, item: BulkScheduleItem) => void;
    stopOnFirstFailure?: boolean;
  } = {}
): Promise<BulkScheduleResult> {
  const {
    delayBetweenRequests = 1000, // 1 second delay by default
    onProgress,
    stopOnFirstFailure = false
  } = options;

  const startTime = new Date().toISOString();
  const startTimestamp = Date.now();

  // Initialize items
  const items: BulkScheduleItem[] = itemIds.map(id => ({
    id,
    status: 'pending'
  }));

  let successCount = 0;
  let failedCount = 0;

  console.log(`[Bulk Schedule] Starting bulk schedule for ${itemIds.length} items`);
  console.log(`[Bulk Schedule] Delay between requests: ${delayBetweenRequests}ms\n`);

  // Process items sequentially
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const current = i + 1;

    console.log(`\n[${current}/${items.length}] Processing item: ${item.id}`);

    // Update status to processing
    item.status = 'processing';
    if (onProgress) {
      onProgress(current, items.length, item);
    }

    try {
      // Schedule item
      const result = await scheduleSingleStory(item.id);

      if (result.success) {
        item.status = 'success';
        item.postId = result.postId;
        item.processedAt = new Date().toISOString();
        successCount++;

        console.log(`[${current}/${items.length}] ✅ Success: ${result.postId}`);
      } else {
        item.status = 'failed';
        item.error = result.error;
        item.processedAt = new Date().toISOString();
        failedCount++;

        console.error(`[${current}/${items.length}] ❌ Failed: ${result.error}`);

        if (stopOnFirstFailure) {
          console.log(`[Bulk Schedule] Stopping due to failure (stopOnFirstFailure=true)`);
          break;
        }
      }
    } catch (error) {
      item.status = 'failed';
      item.error = error instanceof Error ? error.message : 'Unknown error';
      item.processedAt = new Date().toISOString();
      failedCount++;

      console.error(
        `[${current}/${items.length}] ❌ Error: ${item.error}`
      );

      if (stopOnFirstFailure) {
        console.log(`[Bulk Schedule] Stopping due to error (stopOnFirstFailure=true)`);
        break;
      }
    }

    // Update progress callback
    if (onProgress) {
      onProgress(current, items.length, item);
    }

    // Delay before next request (except for last item)
    if (i < items.length - 1) {
      console.log(`[Bulk Schedule] Waiting ${delayBetweenRequests}ms before next request...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
    }
  }

  const endTime = new Date().toISOString();
  const duration = Date.now() - startTimestamp;

  const result: BulkScheduleResult = {
    total: itemIds.length,
    success: successCount,
    failed: failedCount,
    items,
    startTime,
    endTime,
    duration
  };

  console.log(`\n========== Bulk Schedule Summary ==========`);
  console.log(`Total items: ${result.total}`);
  console.log(`✅ Successful: ${result.success}`);
  console.log(`❌ Failed: ${result.failed}`);
  console.log(`⏱️  Duration: ${(result.duration / 1000).toFixed(1)}s`);
  console.log(`==========================================\n`);

  return result;
}

/**
 * Bulk schedule with progress indicator
 * (Example integration with UI progress bar)
 */
export async function bulkScheduleWithProgressBar(
  itemIds: string[]
): Promise<BulkScheduleResult> {
  console.log(`Starting bulk schedule with progress tracking...\n`);

  return bulkScheduleStories(itemIds, {
    delayBetweenRequests: 1000,
    onProgress: (current, total, item) => {
      const percent = Math.round((current / total) * 100);
      const progressBar = generateProgressBar(percent, 30);

      process.stdout.write(
        `\r[${progressBar}] ${percent}% (${current}/${total}) - ${item.id}: ${item.status}          `
      );

      // Add newline when complete
      if (current === total) {
        process.stdout.write('\n');
      }
    }
  });
}

/**
 * Generate ASCII progress bar
 */
function generateProgressBar(percent: number, length: number): string {
  const filled = Math.round((percent / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Filter and prepare items for bulk scheduling
 * (Only items with status "Ready")
 */
export async function scheduleReadyItems(
  filterStatus: string = 'Ready'
): Promise<BulkScheduleResult> {
  const { readFileSync } = await import('fs');

  // Load history
  const history = JSON.parse(readFileSync('./history.json', 'utf8'));

  // Filter items by status
  const readyItems = history.filter((item: any) => item.status === filterStatus);

  console.log(`Found ${readyItems.length} items with status "${filterStatus}"`);

  if (readyItems.length === 0) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      items: [],
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: 0
    };
  }

  const itemIds = readyItems.map((item: any) => item.id);
  return bulkScheduleWithProgressBar(itemIds);
}

/**
 * Retry failed items from a previous bulk schedule
 */
export async function retryFailedItems(
  previousResult: BulkScheduleResult
): Promise<BulkScheduleResult> {
  const failedItemIds = previousResult.items
    .filter(item => item.status === 'failed')
    .map(item => item.id);

  console.log(`Retrying ${failedItemIds.length} failed items...`);

  if (failedItemIds.length === 0) {
    console.log('No failed items to retry');
    return {
      total: 0,
      success: 0,
      failed: 0,
      items: [],
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: 0
    };
  }

  return bulkScheduleWithProgressBar(failedItemIds);
}

/**
 * Generate summary report for bulk schedule
 */
export function generateBulkScheduleReport(result: BulkScheduleResult): string {
  const lines: string[] = [];

  lines.push('============================================');
  lines.push('   BULK SCHEDULE REPORT');
  lines.push('============================================');
  lines.push('');
  lines.push(`Start Time: ${result.startTime}`);
  lines.push(`End Time:   ${result.endTime}`);
  lines.push(`Duration:   ${(result.duration / 1000).toFixed(2)}s`);
  lines.push('');
  lines.push(`Total Items:     ${result.total}`);
  lines.push(`✅ Successful:   ${result.success} (${Math.round((result.success / result.total) * 100)}%)`);
  lines.push(`❌ Failed:       ${result.failed} (${Math.round((result.failed / result.total) * 100)}%)`);
  lines.push('');

  if (result.success > 0) {
    lines.push('Successful Items:');
    result.items
      .filter(item => item.status === 'success')
      .forEach(item => {
        lines.push(`  ✅ ${item.id} → ${item.postId}`);
      });
    lines.push('');
  }

  if (result.failed > 0) {
    lines.push('Failed Items:');
    result.items
      .filter(item => item.status === 'failed')
      .forEach(item => {
        lines.push(`  ❌ ${item.id}: ${item.error}`);
      });
    lines.push('');
  }

  lines.push('============================================');

  return lines.join('\n');
}

// CLI usage
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'ready') {
    // Schedule all items with status "Ready"
    scheduleReadyItems()
      .then(result => {
        console.log(generateBulkScheduleReport(result));
        process.exit(result.failed > 0 ? 1 : 0);
      })
      .catch(error => {
        console.error('Error:', error);
        process.exit(1);
      });
  } else {
    // Schedule specific items
    const itemIds = process.argv.slice(2);

    if (itemIds.length === 0) {
      console.error('Usage:');
      console.error('  ts-node bulk-schedule.ts <item_id1> <item_id2> ...');
      console.error('  ts-node bulk-schedule.ts ready');
      process.exit(1);
    }

    bulkScheduleWithProgressBar(itemIds)
      .then(result => {
        console.log(generateBulkScheduleReport(result));
        process.exit(result.failed > 0 ? 1 : 0);
      })
      .catch(error => {
        console.error('Error:', error);
        process.exit(1);
      });
  }
}
