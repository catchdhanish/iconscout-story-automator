import { useEffect, useRef } from 'react';

interface UseAutoPollingOptions {
  /**
   * Function to call on each poll
   */
  onPoll: () => Promise<void> | void;

  /**
   * Interval in milliseconds (default: 5000ms = 5 seconds)
   */
  interval?: number;

  /**
   * Whether polling is enabled (default: true)
   */
  enabled?: boolean;

  /**
   * Condition function to determine if polling should continue
   * If provided and returns false, polling will stop
   */
  shouldContinue?: () => boolean;
}

/**
 * Custom hook for automatic polling at regular intervals
 *
 * @example
 * ```typescript
 * useAutoPolling({
 *   onPoll: fetchAssets,
 *   interval: 5000,
 *   enabled: hasProcessingAssets,
 *   shouldContinue: () => assets.some(a => a.status === 'Draft' || a.status === 'Scheduled')
 * });
 * ```
 */
export function useAutoPolling({
  onPoll,
  interval = 5000,
  enabled = true,
  shouldContinue,
}: UseAutoPollingOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onPollRef = useRef(onPoll);

  // Keep onPoll reference up to date
  useEffect(() => {
    onPollRef.current = onPoll;
  }, [onPoll]);

  useEffect(() => {
    // Don't start polling if not enabled
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Check if we should continue polling
    if (shouldContinue && !shouldContinue()) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Start polling
    intervalRef.current = setInterval(async () => {
      // Check again before each poll
      if (shouldContinue && !shouldContinue()) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      try {
        await onPollRef.current();
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, interval);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, interval, shouldContinue]);
}
