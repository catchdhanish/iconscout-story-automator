/**
 * Example: Status Verification Background Job
 *
 * This example demonstrates a background polling job that verifies scheduled posts
 * have been published. This should run every 5 minutes (configurable) to check
 * items with status "Scheduled" where the scheduled time has passed.
 *
 * Usage:
 *   // Run once
 *   import { verifyScheduledPosts } from './examples/status-verification';
 *   await verifyScheduledPosts();
 *
 *   // Run continuously (polling)
 *   import { startStatusVerificationJob } from './examples/status-verification';
 *   startStatusVerificationJob({ intervalMinutes: 5 });
 *
 * @module status-verification
 */

import { readFileSync, writeFileSync } from 'fs';
import lockfile from 'proper-lockfile';
import {
  checkBlotatoStatus,
  checkBlotatoStatusBatch,
  isReadyForVerification,
  shouldUpdateStatus,
  formatStatusCheckForLog,
  getStatusCheckMessage,
  type StatusCheckResult
} from '../lib/check-blotato-status';

interface HistoryItem {
  id: string;
  status: string;
  scheduled_time: string;
  blotato_post_id?: string;
  published_at?: string;
  verified_at?: string;
  [key: string]: any;
}

const HISTORY_PATH = './history.json';

/**
 * Verify all scheduled posts that are past their scheduled time
 *
 * @returns Promise resolving to verification result
 */
export async function verifyScheduledPosts(): Promise<{
  checked: number;
  updated: number;
  errors: number;
}> {
  console.log(`[Verification] Starting status verification job...`);
  const startTime = Date.now();

  // Load history
  const history: HistoryItem[] = JSON.parse(readFileSync(HISTORY_PATH, 'utf8'));

  // Find items ready for verification
  const itemsToVerify = history.filter(item =>
    item.blotato_post_id &&
    isReadyForVerification(item.scheduled_time, item.status)
  );

  console.log(`[Verification] Found ${itemsToVerify.length} items to verify`);

  if (itemsToVerify.length === 0) {
    console.log(`[Verification] No items need verification`);
    return { checked: 0, updated: 0, errors: 0 };
  }

  let updatedCount = 0;
  let errorCount = 0;

  // Check status for each item
  const postIds = itemsToVerify.map(item => item.blotato_post_id!);
  const results = await checkBlotatoStatusBatch(postIds, 5); // 5 concurrent requests

  // Process results
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const item = itemsToVerify[i];

    console.log(`\n[Verification] Item ${item.id}:`);
    console.log(`  Blotato Status: ${result.blotatoStatus}`);
    console.log(`  ISA Status: ${result.isaStatus}`);
    console.log(`  Message: ${getStatusCheckMessage(result)}`);

    // Determine if status should be updated
    if (shouldUpdateStatus(item.status, result.isaStatus)) {
      try {
        await updateItemStatus(item.id, result);
        updatedCount++;
        console.log(`  ✅ Updated to: ${result.isaStatus}`);
      } catch (error) {
        errorCount++;
        console.error(`  ❌ Failed to update: ${error}`);
      }
    } else {
      console.log(`  ℹ️  No update needed (status unchanged)`);
    }
  }

  const duration = Date.now() - startTime;

  console.log(`\n[Verification] Job complete:`);
  console.log(`  Checked: ${itemsToVerify.length}`);
  console.log(`  Updated: ${updatedCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Duration: ${(duration / 1000).toFixed(1)}s`);

  return {
    checked: itemsToVerify.length,
    updated: updatedCount,
    errors: errorCount
  };
}

/**
 * Update item status in history.json with file locking
 */
async function updateItemStatus(
  itemId: string,
  result: StatusCheckResult
): Promise<void> {
  let release: (() => Promise<void>) | undefined;

  try {
    // Acquire lock
    release = await lockfile.lock(HISTORY_PATH, {
      retries: { retries: 10, minTimeout: 100, maxTimeout: 2000 },
      stale: 10000
    });

    // Read history
    const history: HistoryItem[] = JSON.parse(readFileSync(HISTORY_PATH, 'utf8'));

    // Find and update item
    const itemIndex = history.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new Error(`Item ${itemId} not found`);
    }

    const updates: Partial<HistoryItem> = {
      status: result.isaStatus,
      verified_at: result.verifiedAt,
      updated_at: new Date().toISOString()
    };

    if (result.publishedAt) {
      updates.published_at = result.publishedAt;
    }

    if (result.error) {
      updates.error = {
        message: result.error,
        failed_at: result.verifiedAt,
        details: 'Status verification error'
      };
    }

    history[itemIndex] = {
      ...history[itemIndex],
      ...updates
    };

    // Write atomically
    writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
  } finally {
    if (release) await release();
  }
}

/**
 * Start continuous status verification job
 *
 * @param options - Job configuration
 * @returns Stop function to cancel the job
 *
 * @example
 * ```typescript
 * // Start job running every 5 minutes
 * const stop = startStatusVerificationJob({ intervalMinutes: 5 });
 *
 * // Later, stop the job
 * stop();
 * ```
 */
export function startStatusVerificationJob(options: {
  intervalMinutes?: number;
  onComplete?: (result: { checked: number; updated: number; errors: number }) => void;
} = {}): () => void {
  const { intervalMinutes = 5, onComplete } = options;
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`[Verification Job] Starting continuous job (interval: ${intervalMinutes} minutes)`);

  // Run immediately
  verifyScheduledPosts()
    .then(result => {
      if (onComplete) onComplete(result);
    })
    .catch(error => {
      console.error(`[Verification Job] Error:`, error);
    });

  // Schedule recurring job
  const intervalId = setInterval(() => {
    console.log(`\n[Verification Job] Running scheduled verification...`);

    verifyScheduledPosts()
      .then(result => {
        if (onComplete) onComplete(result);
      })
      .catch(error => {
        console.error(`[Verification Job] Error:`, error);
      });
  }, intervalMs);

  // Return stop function
  return () => {
    console.log(`[Verification Job] Stopping job`);
    clearInterval(intervalId);
  };
}

/**
 * Verify a single item by ID
 */
export async function verifyItemById(itemId: string): Promise<StatusCheckResult> {
  console.log(`[Verification] Checking status for item ${itemId}`);

  // Load item
  const history: HistoryItem[] = JSON.parse(readFileSync(HISTORY_PATH, 'utf8'));
  const item = history.find(i => i.id === itemId);

  if (!item) {
    throw new Error(`Item ${itemId} not found`);
  }

  if (!item.blotato_post_id) {
    throw new Error(`Item ${itemId} has no Blotato post ID`);
  }

  // Check status
  const result = await checkBlotatoStatus(item.blotato_post_id);

  console.log(`[Verification] Result:`, formatStatusCheckForLog(result));

  // Update if needed
  if (shouldUpdateStatus(item.status, result.isaStatus)) {
    await updateItemStatus(itemId, result);
    console.log(`[Verification] Updated item status to: ${result.isaStatus}`);
  }

  return result;
}

/**
 * Get verification statistics
 */
export async function getVerificationStats(): Promise<{
  totalScheduled: number;
  readyForVerification: number;
  recentlyVerified: number;
}> {
  const history: HistoryItem[] = JSON.parse(readFileSync(HISTORY_PATH, 'utf8'));

  const totalScheduled = history.filter(item => item.status === 'Scheduled').length;

  const readyForVerification = history.filter(item =>
    item.blotato_post_id &&
    isReadyForVerification(item.scheduled_time, item.status)
  ).length;

  // Recently verified (last hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentlyVerified = history.filter(item =>
    item.verified_at && new Date(item.verified_at) > oneHourAgo
  ).length;

  return {
    totalScheduled,
    readyForVerification,
    recentlyVerified
  };
}

/**
 * Manual verification trigger for specific items
 */
export async function manualVerification(itemIds: string[]): Promise<void> {
  console.log(`[Manual Verification] Checking ${itemIds.length} items...`);

  for (const itemId of itemIds) {
    try {
      await verifyItemById(itemId);
      console.log(`[Manual Verification] ✅ ${itemId}`);
    } catch (error) {
      console.error(`[Manual Verification] ❌ ${itemId}:`, error);
    }
  }
}

// CLI usage
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'run') {
    // Run once
    verifyScheduledPosts()
      .then(result => {
        console.log(`\nVerification complete: ${result.updated} items updated`);
        process.exit(result.errors > 0 ? 1 : 0);
      })
      .catch(error => {
        console.error('Error:', error);
        process.exit(1);
      });
  } else if (command === 'start') {
    // Start continuous job
    const intervalMinutes = parseInt(process.argv[3]) || 5;

    console.log(`Starting continuous verification job (${intervalMinutes} minute interval)`);
    console.log(`Press Ctrl+C to stop\n`);

    const stop = startStatusVerificationJob({
      intervalMinutes,
      onComplete: result => {
        const timestamp = new Date().toISOString();
        console.log(`\n[${timestamp}] Job complete: ${result.updated} updated, ${result.errors} errors`);
      }
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\nReceived SIGINT, stopping job...');
      stop();
      process.exit(0);
    });
  } else if (command === 'stats') {
    // Show statistics
    getVerificationStats()
      .then(stats => {
        console.log('\n========== Verification Statistics ==========');
        console.log(`Total Scheduled:         ${stats.totalScheduled}`);
        console.log(`Ready for Verification:  ${stats.readyForVerification}`);
        console.log(`Recently Verified:       ${stats.recentlyVerified} (last hour)`);
        console.log('==========================================\n');
        process.exit(0);
      })
      .catch(error => {
        console.error('Error:', error);
        process.exit(1);
      });
  } else if (command === 'verify') {
    // Verify specific items
    const itemIds = process.argv.slice(3);

    if (itemIds.length === 0) {
      console.error('Usage: ts-node status-verification.ts verify <item_id1> <item_id2> ...');
      process.exit(1);
    }

    manualVerification(itemIds)
      .then(() => {
        console.log('\nManual verification complete');
        process.exit(0);
      })
      .catch(error => {
        console.error('Error:', error);
        process.exit(1);
      });
  } else {
    console.error('Usage:');
    console.error('  ts-node status-verification.ts run              # Run verification once');
    console.error('  ts-node status-verification.ts start [interval] # Start continuous job (default: 5 min)');
    console.error('  ts-node status-verification.ts stats            # Show verification statistics');
    console.error('  ts-node status-verification.ts verify <ids...>  # Verify specific items');
    process.exit(1);
  }
}
