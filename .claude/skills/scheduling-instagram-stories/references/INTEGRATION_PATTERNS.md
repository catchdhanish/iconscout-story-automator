# Integration Patterns for ISA Project

Integration patterns specific to the IconScout Story Automator (ISA) project.

## ISA State Machine Integration

### Status Transitions

```
Draft → Ready → Scheduled → Published
              ↓
        Schedule Failed
```

**Valid Transitions**:
- `Draft` → `Ready`: User approves generated story
- `Ready` → `Scheduled`: Successfully scheduled via Blotato API
- `Scheduled` → `Published`: Verified published via background polling
- `Ready` → `Schedule Failed`: Scheduling failed after retries
- `Scheduled` → `Schedule Failed`: Publication failed (verified via API)
- `Scheduled` → `Draft`: User manually unschedules

**Invalid Transitions**:
- `Published` → (any): Published posts cannot change status
- Skip states (e.g., `Draft` → `Scheduled` directly)

### Metadata Updates by Status

**On Transition to `Scheduled`**:
```typescript
{
  status: 'Scheduled',
  blotato_post_id: response.postId,
  scheduled_time: item.scheduledTime, // UTC ISO 8601
  scheduled_at: new Date().toISOString(),
  error: undefined // Clear any previous errors
}
```

**On Transition to `Published`**:
```typescript
{
  status: 'Published',
  published_at: response.publishedAt,
  verified_at: new Date().toISOString()
}
```

**On Transition to `Schedule Failed`**:
```typescript
{
  status: 'Schedule Failed',
  error: {
    message: 'User-friendly error message',
    details: 'Technical details',
    failed_at: new Date().toISOString(),
    retry_count: 3,
    status_code: response?.status
  }
}
```

## File Locking Pattern

### Why File Locking is Critical

`history.json` can be accessed by multiple processes concurrently:
- API routes handling user actions
- Background polling job
- Concurrent user requests

Without locking, concurrent writes corrupt the JSON file.

### Implementation with `proper-lockfile`

```typescript
import lockfile from 'proper-lockfile';
import { readFileSync, writeFileSync } from 'fs';

async function updateHistory<T>(
  itemId: string,
  updates: T
): Promise<void> {
  const historyPath = './history.json';
  let release: (() => Promise<void>) | undefined;

  try {
    // Acquire lock with stale detection
    release = await lockfile.lock(historyPath, {
      retries: {
        retries: 10,        // Try up to 10 times
        minTimeout: 100,    // Start with 100ms wait
        maxTimeout: 2000    // Max wait 2 seconds
      },
      stale: 10000          // Lock is stale after 10 seconds
    });

    // Read current history
    const history = JSON.parse(readFileSync(historyPath, 'utf8'));

    // Find and update item
    const itemIndex = history.findIndex((item: any) => item.id === itemId);
    if (itemIndex === -1) {
      throw new Error(`Item ${itemId} not found`);
    }

    history[itemIndex] = {
      ...history[itemIndex],
      ...updates,
      updated_at: new Date().toISOString()
    };

    // Write atomically
    writeFileSync(historyPath, JSON.stringify(history, null, 2));

  } finally {
    // ALWAYS release lock
    if (release) {
      await release();
    }
  }
}
```

### Lock Configuration

**Retry Strategy**:
- Start with 100ms wait between retries
- Exponentially increase up to 2 seconds
- Try up to 10 times before failing

**Stale Detection**:
- Locks older than 10 seconds are considered stale
- Prevents deadlocks from crashed processes

### Error Handling

If lock acquisition fails after all retries:
```typescript
try {
  await updateHistory(itemId, updates);
} catch (error) {
  logger.error('Failed to acquire history.json lock', {
    itemId,
    error: error.message
  });
  throw new Error('Unable to update history due to lock contention');
}
```

## Next.js API Route Patterns

### Schedule Endpoint

**File**: `/app/api/schedule/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { scheduleSingleStory } from '@/.claude/skills/scheduling-instagram-stories/examples/schedule-single-story';

export async function POST(request: NextRequest) {
  try {
    const { itemId } = await request.json();

    // Validate request
    if (!itemId) {
      return NextResponse.json(
        { error: 'itemId is required' },
        { status: 400 }
      );
    }

    // Schedule story
    const result = await scheduleSingleStory(itemId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        postId: result.postId
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Schedule API error', { error });
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
```

### Bulk Schedule Endpoint

**File**: `/app/api/schedule/bulk/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { bulkScheduleStories } from '@/.claude/skills/scheduling-instagram-stories/examples/bulk-schedule';

export async function POST(request: NextRequest) {
  try {
    const { itemIds } = await request.json();

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { error: 'itemIds array is required' },
        { status: 400 }
      );
    }

    // Start bulk schedule (non-blocking)
    const result = await bulkScheduleStories(itemIds, {
      delayBetweenRequests: 1000
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Bulk schedule API error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Status Check Endpoint

**File**: `/app/api/status/verify/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyScheduledPosts } from '@/.claude/skills/scheduling-instagram-stories/examples/status-verification';

export async function POST(request: NextRequest) {
  try {
    const result = await verifyScheduledPosts();

    return NextResponse.json({
      success: true,
      checked: result.checked,
      updated: result.updated,
      errors: result.errors
    });
  } catch (error) {
    logger.error('Status verification API error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Winston Logging Configuration

### Logger Setup

**File**: `/lib/logger.ts`

```typescript
import winston from 'winston';
import path from 'path';

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Application log (info and above)
    new winston.transports.File({
      filename: path.join('logs', 'app.log'),
      level: 'info',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 14, // Keep 14 days
      tailable: true
    }),

    // Error log (errors only)
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 30, // Keep 30 days
      tailable: true
    })
  ]
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

export default logger;
```

### Logging Patterns

**Successful Operations**:
```typescript
logger.info('Story scheduled to Blotato', {
  assetId: item.id,
  scheduledTime: item.scheduled_time,
  blotatoPostId: response.postId,
  processingTime: `${duration}ms`
});
```

**Errors**:
```typescript
logger.error('Blotato scheduling failed', {
  assetId: item.id,
  error: error.message,
  stack: error.stack,
  statusCode: response?.status,
  retryCount: attempt
});
```

**Warnings**:
```typescript
logger.warn('Rate limit hit', {
  retryAfter: retryAfterHeader,
  queuedRequests: queue.length,
  endpoint: '/v2/posts'
});
```

## Environment Variable Setup

### Required Environment Variables

**File**: `.env`

```bash
# Blotato API Configuration
BLOTATO_API_KEY=blt_U8efNW8bxtJlTN/fGU1CW6LV2p90rIvr1rQjl2cBnlM=
BLOTATO_API_BASE_URL=https://api.blotato.com
BLOTATO_ACCOUNT_ID=<your-instagram-account-id>

# Application Configuration
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
NODE_ENV=production
PORT=3000

# OpenRouter API (for background generation)
OPENROUTER_API_KEY=<your-openrouter-key>
OPENROUTER_MAX_CALLS_PER_MINUTE=20
```

### Environment Validation

```typescript
function validateEnvironment(): void {
  const required = [
    'BLOTATO_API_KEY',
    'BLOTATO_ACCOUNT_ID',
    'NEXT_PUBLIC_BASE_URL'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

// Run on app startup
validateEnvironment();
```

## Background Polling Job Setup

### Recommended: Node Cron

**File**: `/app/api/cron/verify-status/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyScheduledPosts } from '@/.claude/skills/scheduling-instagram-stories/examples/status-verification';

// Vercel Cron Job endpoint
export async function GET(request: NextRequest) {
  // Verify cron secret (security)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await verifyScheduledPosts();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    logger.error('Cron job error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Vercel Cron Configuration** (`vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/cron/verify-status",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Alternative: PM2 with Node Script

```javascript
// scripts/status-verification-job.js
import { startStatusVerificationJob } from '../.claude/skills/scheduling-instagram-stories/examples/status-verification.js';

startStatusVerificationJob({
  intervalMinutes: 5,
  onComplete: (result) => {
    console.log(`Verified ${result.updated} items`);
  }
});
```

**PM2 Configuration**:
```bash
pm2 start scripts/status-verification-job.js --name "status-verification"
pm2 save
```

## Testing Strategy

### Unit Tests (Jest)

**Test File**: `__tests__/lib/validate-schedule-params.test.ts`

```typescript
import { validateScheduleParams } from '@/.claude/skills/scheduling-instagram-stories/lib/validate-schedule-params';

describe('validateScheduleParams', () => {
  it('should validate correct params', async () => {
    const result = await validateScheduleParams({
      accountId: 'acc_123',
      scheduledTime: new Date(Date.now() + 86400000).toISOString(),
      mediaUrls: ['https://example.com/image.png'],
      content: { text: 'Test', platform: 'instagram' },
      target: { targetType: 'story' }
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject past scheduled time', async () => {
    const result = await validateScheduleParams({
      accountId: 'acc_123',
      scheduledTime: '2020-01-01T00:00:00Z',
      mediaUrls: ['https://example.com/image.png'],
      content: { text: 'Test', platform: 'instagram' },
      target: { targetType: 'story' }
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'scheduledTime' })
    );
  });
});
```

### Integration Tests

Mock Blotato API responses:
```typescript
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.post('https://api.blotato.com/v2/posts', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        postId: 'blot_test123',
        status: 'scheduled',
        scheduledTime: '2024-01-15T03:30:00Z'
      })
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

**Last Updated**: January 2026
**Project**: IconScout Story Automator (ISA)
