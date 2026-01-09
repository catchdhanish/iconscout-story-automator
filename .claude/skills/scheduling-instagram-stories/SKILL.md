---
name: scheduling-instagram-stories
description: Implements Instagram story scheduling via Blotato API with authentication, retry logic, status checking, and error handling. Use when working on Instagram story posting, scheduling posts to Blotato, implementing retry mechanisms, handling post status verification, or debugging Blotato API integration issues. Includes timezone conversion, validation, and best practices for the IconScout Story Automator project.
allowed-tools: Read, Bash, Edit, Write
---

# Scheduling Instagram Stories via Blotato API

This skill provides comprehensive guidance for implementing Instagram story scheduling using the Blotato API in the IconScout Story Automator (ISA) project.

## Quick Start

**Authentication**: Use header-based API key authentication
```typescript
headers: {
  'blotato-api-key': process.env.BLOTATO_API_KEY,
  'Content-Type': 'application/json'
}
```

**API Key**: `blt_U8efNW8bxtJlTN/fGU1CW6LV2p90rIvr1rQjl2cBnlM=`
**Base URL**: `https://api.blotato.com`
**Dashboard**: https://my.blotato.com/api-dashboard

**Basic Schedule Request**:
```typescript
POST /v2/posts
{
  accountId: string,
  content: { text: string, platform: 'instagram' },
  target: { targetType: 'story' },
  mediaUrls: ['https://...'],
  scheduledTime: '2024-01-15T03:30:00Z' // UTC ISO 8601
}
```

## Core Capabilities

1. **Authentication** - Configure Blotato API key in environment
2. **Scheduling** - Schedule Instagram stories with timezone handling
3. **Retry Logic** - Exponential backoff (5s, 15s, 45s per SPEC.md)
4. **Status Verification** - Poll and verify post publication
5. **Error Handling** - Comprehensive error responses with user-friendly messages
6. **Validation** - Pre-scheduling parameter and media URL validation
7. **Bulk Operations** - Queue multiple posts sequentially

## When This Skill Triggers

- Implementing `/api/schedule` endpoints
- Debugging Blotato API integration
- Adding retry logic to scheduling functions
- Building status verification polling jobs
- Handling authentication errors (401)
- Converting timezones for scheduled posts
- Implementing bulk scheduling features
- Working with Instagram story posting

## Environment Configuration

Add to `.env` file (ensure `.env` in `.gitignore`):
```bash
BLOTATO_API_KEY=blt_U8efNW8bxtJlTN/fGU1CW6LV2p90rIvr1rQjl2cBnlM=
BLOTATO_API_BASE_URL=https://api.blotato.com
BLOTATO_ACCOUNT_ID=<your-instagram-account-id>
```

⚠️ **Security**: Never commit `.env` to git. API key must only be in environment variables.

## Scheduling Single Story

### Request Structure

```typescript
interface ScheduleRequest {
  accountId: string;           // Blotato Instagram account ID
  content: {
    text: string;              // Post caption/description
    platform: 'instagram';
  };
  target: {
    targetType: 'story';       // Specifies Instagram Story
  };
  mediaUrls: string[];         // Public URLs (1080x1920 PNG/JPG)
  scheduledTime?: string;      // ISO 8601 UTC (optional for immediate post)
}
```

### Implementation Pattern

```typescript
const BLOTATO_API_BASE_URL = process.env.BLOTATO_API_BASE_URL || 'https://api.blotato.com';
const BLOTATO_API_KEY = process.env.BLOTATO_API_KEY!;

async function scheduleStory(item: HistoryItem): Promise<{ postId: string }> {
  const postData = {
    accountId: process.env.BLOTATO_ACCOUNT_ID!,
    content: {
      text: item.meta_description,
      platform: 'instagram' as const
    },
    target: {
      targetType: 'story' as const
    },
    mediaUrls: [`${process.env.NEXT_PUBLIC_BASE_URL}${item.versions[item.active_version - 1].file_path}`],
    scheduledTime: item.scheduled_time // UTC ISO 8601
  };

  const response = await fetch(`${BLOTATO_API_BASE_URL}/v2/posts`, {
    method: 'POST',
    headers: {
      'blotato-api-key': BLOTATO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(postData)
  });

  if (!response.ok) {
    throw new Error(`Blotato API error: ${response.status}`);
  }

  return await response.json(); // { postId, status, scheduledTime }
}
```

### Critical Requirements

- `mediaUrls` must be **publicly accessible** (no authentication)
- `scheduledTime` must be **UTC ISO 8601** format: `2024-01-15T03:30:00Z`
- `scheduledTime` must be **in the future**
- Media must be 1080x1920 pixels (Instagram Story format)

## Retry Logic with Exponential Backoff

**Pattern (SPEC.md requirement)**:
1. Initial attempt fails → Wait 5s → Retry #1
2. Retry #1 fails → Wait 15s → Retry #2
3. Retry #2 fails → Wait 45s → Retry #3
4. All retries failed → Mark as "Schedule Failed"

```typescript
async function scheduleWithRetry(postData: ScheduleRequest): Promise<{ postId: string }> {
  const delays = [5000, 15000, 45000]; // milliseconds
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${BLOTATO_API_BASE_URL}/v2/posts`, {
        method: 'POST',
        headers: {
          'blotato-api-key': process.env.BLOTATO_API_KEY!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData),
        signal: AbortSignal.timeout(15000) // 15s timeout
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();

    } catch (error) {
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        continue;
      }
      throw error; // All retries exhausted
    }
  }

  throw new Error('Unexpected retry loop exit');
}
```

**Utility Available**: See `lib/retry-with-backoff.ts` for reusable retry function.

## Error Handling

### Common Error Scenarios

**401 Unauthorized** - Invalid API key
```typescript
// User message: "Blotato API authentication failed. Check API key configuration."
// Solution: Verify BLOTATO_API_KEY environment variable
```

**400 Bad Request** - Invalid parameters
```typescript
// Causes: scheduledTime in past, malformed ISO 8601, missing required fields
// Solution: Run validation before API call (see lib/validate-schedule-params.ts)
// User message: "Invalid scheduling parameters: {specific error}"
```

**404 Not Found** - Post doesn't exist
```typescript
// Common on GET /v2/posts/{postId} or DELETE
// Action: Handle gracefully, proceed with local cleanup
// User message: "Post not found on Blotato (may have been deleted)"
```

**429 Too Many Requests** - Rate limit exceeded
```typescript
if (response.status === 429) {
  const retryAfter = parseInt(response.headers.get('Retry-After') || '30');
  await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
  // User message: "Rate limit reached. Retrying in {retryAfter}s..."
}
```

**500/503 Server Errors** - Blotato service issues
```typescript
// Action: Apply retry logic with exponential backoff
// User message: "Blotato service error. Retrying... (Attempt {X}/3)"
```

**Network Timeout** - Request exceeds 15 seconds
```typescript
// Use AbortSignal.timeout(15000) for all requests
// Action: Retry with exponential backoff
// User message: "Network timeout. Retrying... (Attempt {X}/3)"
```

**Error Storage Pattern**:
```typescript
// When all retries fail, store in history.json:
{
  status: 'Schedule Failed',
  error: {
    message: 'Network timeout',
    details: errorStack,
    failed_at: new Date().toISOString(),
    retry_count: 3
  }
}
```

**Reference**: See `references/ERROR_CODES.md` for comprehensive error catalog.

## Timezone Handling

**Always convert user timezone to UTC** before sending to Blotato:

```typescript
import { fromZonedTime } from 'date-fns-tz';

// User selects: "Jan 15, 2024 9:00 AM IST"
const userTimezone = 'Asia/Kolkata';
const userDateTime = new Date('2024-01-15T09:00:00');

// Convert to UTC for Blotato API
const utcDateTime = fromZonedTime(userDateTime, userTimezone);
const scheduledTime = utcDateTime.toISOString(); // "2024-01-15T03:30:00.000Z"
```

**Display Format**: Show both user TZ and UTC for clarity
```
"Jan 15, 2024 9:00 AM IST (3:30 AM UTC)"
```

## Status Verification

**Background Polling Job** (every 5 minutes):

```typescript
// Query items with status="Scheduled" and scheduledTime in past
async function verifyScheduledPosts() {
  const items = history.filter(item =>
    item.status === 'Scheduled' &&
    new Date(item.scheduled_time) < new Date()
  );

  for (const item of items) {
    const response = await fetch(
      `${BLOTATO_API_BASE_URL}/v2/posts/${item.blotato_post_id}`,
      { headers: { 'blotato-api-key': BLOTATO_API_KEY } }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'published' || data.status === 'live') {
        await updateHistory(item.id, {
          status: 'Published',
          published_at: data.publishedAt,
          verified_at: new Date().toISOString()
        });
      }
    } else if (response.status === 404) {
      // Post deleted externally, handle gracefully
      logger.warn(`Post ${item.blotato_post_id} not found on Blotato`);
    }
  }
}
```

**Status Mapping**:
- Blotato `"published"` or `"live"` → ISA `"Published"`
- Blotato `"scheduled"` → ISA `"Scheduled"`
- Blotato `"failed"` → ISA `"Schedule Failed"`

**Utility Available**: See `lib/check-blotato-status.ts` for reusable status checker.

## Bulk Scheduling

**Sequential Processing** (avoid rate limits):

```typescript
async function bulkSchedule(items: HistoryItem[]) {
  const results = { success: 0, failed: 0, errors: [] };

  for (const item of items) {
    try {
      await scheduleWithRetry(item.postData);
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({ itemId: item.id, error });
    }

    // Delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second
  }

  return results; // "8 scheduled successfully, 2 failed"
}
```

**Example Available**: See `examples/bulk-schedule.ts` for complete implementation.

## Validation Checklist

**Before scheduling**, validate:
- [ ] Item status is "Ready" (not Draft, Scheduled, or Published)
- [ ] `scheduledTime` is in the future (UTC comparison)
- [ ] `mediaUrls` are publicly accessible (HEAD request)
- [ ] Media files are correct format (PNG/JPG, 1080x1920)
- [ ] API key configured in environment
- [ ] Instagram account connected in Blotato

**Validation Utility**: See `lib/validate-schedule-params.ts` for automated validation.

## Unscheduling (Canceling Posts)

```typescript
async function unschedulePost(postId: string) {
  const response = await fetch(`${BLOTATO_API_BASE_URL}/v2/posts/${postId}`, {
    method: 'DELETE',
    headers: { 'blotato-api-key': process.env.BLOTATO_API_KEY! }
  });

  if (response.status === 404) {
    // Post already deleted, proceed with local cleanup
    logger.warn(`Post ${postId} not found, cleaning up locally`);
  } else if (!response.ok) {
    throw new Error(`Failed to unschedule: ${response.status}`);
  }

  // Update local status to "Draft"
  await updateHistory(itemId, {
    status: 'Draft',
    blotato_post_id: null,
    scheduled_time: null
  });
}
```

## Integration with ISA State Machine

**Status Transitions**:
```
Draft → Ready → Scheduled → Published
              ↓
        Schedule Failed
```

**Metadata Updates**:
```typescript
// On successful scheduling
{
  status: 'Scheduled',
  blotato_post_id: response.postId,
  scheduled_time: item.scheduledTime, // UTC ISO 8601
  scheduled_at: new Date().toISOString()
}

// On verification (background job)
{
  status: 'Published',
  published_at: response.publishedAt,
  verified_at: new Date().toISOString()
}

// On failure
{
  status: 'Schedule Failed',
  error: {
    message: 'User-friendly error',
    details: technicalDetails,
    failed_at: new Date().toISOString(),
    retry_count: 3
  }
}
```

**File Locking** (prevent concurrent write corruption):
```typescript
import lockfile from 'proper-lockfile';

const release = await lockfile.lock('./history.json', {
  retries: { retries: 10, minTimeout: 100, maxTimeout: 2000 },
  stale: 10000
});

try {
  // Read, modify, write history.json
} finally {
  await release();
}
```

## Logging (Winston)

```typescript
logger.info('Scheduling story to Blotato', {
  assetId: item.id,
  scheduledTime: item.scheduled_time,
  blotato_post_id: response.postId
});

logger.error('Blotato scheduling failed', {
  assetId: item.id,
  error: error.message,
  statusCode: response?.status,
  retryCount: attempt
});

logger.warn('Rate limit hit', {
  retryAfter: retryAfterHeader,
  queuedRequests: queue.length
});
```

## API Dashboard Monitoring

Monitor all API requests at: **https://my.blotato.com/api-dashboard**

Features:
- View request history
- Inspect request/response payloads
- Check authentication status
- Verify account connections
- Debug failed requests

## Testing Checklist

- [ ] Successful scheduling with valid parameters
- [ ] Retry logic triggers on network failure
- [ ] 401 errors handled with user feedback
- [ ] 429 rate limiting respected with backoff
- [ ] Timezone conversion accurate (user TZ → UTC)
- [ ] Status verification updates local state correctly
- [ ] Unscheduling removes post from Blotato
- [ ] Bulk operations process sequentially
- [ ] Error details stored for failed items
- [ ] Logs capture all API interactions

## Common Pitfalls

1. **Public URL Requirement**: Ensure `mediaUrls` are publicly accessible (no authentication)
2. **UTC Conversion**: Always convert user timezone to UTC before API submission
3. **Status Check**: Verify item is "Ready" before scheduling
4. **Missing Retries**: Always implement retry logic; network failures are common
5. **Rate Limiting**: Process bulk operations sequentially with delays
6. **404 on Unschedule**: Handle gracefully (post may already be deleted)
7. **Stale Status**: Poll for publication confirmation; don't assume success

## Reference Files

- **Complete API Reference**: [BLOTATO_API.md](references/BLOTATO_API.md)
- **Error Codes Catalog**: [ERROR_CODES.md](references/ERROR_CODES.md)
- **Integration Patterns**: [INTEGRATION_PATTERNS.md](references/INTEGRATION_PATTERNS.md)

## Example Implementations

- **Single Schedule**: [schedule-single-story.ts](examples/schedule-single-story.ts)
- **Bulk Scheduling**: [bulk-schedule.ts](examples/bulk-schedule.ts)
- **Status Polling**: [status-verification.ts](examples/status-verification.ts)

## Utility Functions

- **Retry Logic**: [retry-with-backoff.ts](lib/retry-with-backoff.ts)
- **Validation**: [validate-schedule-params.ts](lib/validate-schedule-params.ts)
- **Status Check**: [check-blotato-status.ts](lib/check-blotato-status.ts)

---

**Skill Version**: 1.0.0
**Last Updated**: January 2026
**Project**: IconScout Story Automator (ISA)
