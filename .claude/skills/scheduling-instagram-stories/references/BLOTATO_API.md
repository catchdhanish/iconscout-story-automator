# Blotato API Complete Reference

Complete API documentation for the Blotato social media scheduling platform.

## Base Configuration

**Base URL**: `https://api.blotato.com`
**API Version**: v2
**Authentication**: Header-based API key
**Dashboard**: https://my.blotato.com/api-dashboard

## Authentication

### API Key Configuration

**Header Format**:
```
blotato-api-key: YOUR_API_KEY
```

**For ISA Project**:
```
blotato-api-key: blt_U8efNW8bxtJlTN/fGU1CW6LV2p90rIvr1rQjl2cBnlM=
```

**How to Obtain**:
1. Log in to Blotato dashboard
2. Navigate to Settings > API
3. Generate API key
4. ⚠️ Note: Generating an API key ends free trial and activates paid subscription

## Endpoint: POST /v2/posts

**Purpose**: Publish or schedule posts to connected social accounts

### Request

**URL**: `POST https://api.blotato.com/v2/posts`

**Headers**:
```
blotato-api-key: blt_U8efNW8bxtJlTN/fGU1CW6LV2p90rIvr1rQjl2cBnlM=
Content-Type: application/json
```

**Request Body**:
```json
{
  "accountId": "string",
  "content": {
    "text": "string",
    "platform": "instagram" | "twitter" | "facebook" | "linkedin"
  },
  "target": {
    "targetType": "story" | "post" | "reel"
  },
  "mediaUrls": ["https://..."],
  "scheduledTime": "2024-01-15T03:30:00Z"
}
```

**Field Descriptions**:

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `accountId` | Yes | string | Identifier of connected social account in Blotato |
| `content.text` | Yes | string | Post caption or description |
| `content.platform` | Yes | string | Target social platform (`instagram`, `twitter`, `facebook`, `linkedin`) |
| `target.targetType` | Yes | string | Type of post (`story`, `post`, `reel`) |
| `mediaUrls` | No | string[] | Array of publicly accessible media URLs |
| `scheduledTime` | No | string | ISO 8601 UTC timestamp; omit for immediate posting |

**Instagram Story Specific Requirements**:
- `content.platform`: Must be `"instagram"`
- `target.targetType`: Must be `"story"`
- `mediaUrls`: PNG or JPG, 1080x1920 pixels (9:16 aspect ratio)
- `mediaUrls`: Must be **publicly accessible** (no authentication required)
- `scheduledTime`: Must be in UTC, ISO 8601 format: `YYYY-MM-DDTHH:MM:SSZ`

**TypeScript Interface**:
```typescript
interface PostRequest {
  accountId: string;
  content: {
    text: string;
    platform: 'instagram' | 'twitter' | 'facebook' | 'linkedin';
  };
  target: {
    targetType: 'story' | 'post' | 'reel';
  };
  mediaUrls?: string[];
  scheduledTime?: string; // ISO 8601 UTC
}
```

### Response

**Success (200 OK)**:
```json
{
  "postId": "blot_abc123",
  "status": "scheduled" | "posted",
  "scheduledTime": "2024-01-15T03:30:00Z",
  "accountId": "account_xyz"
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `postId` | string | Unique identifier for the scheduled post |
| `status` | string | Current status: `scheduled` (future post) or `posted` (immediate) |
| `scheduledTime` | string | ISO 8601 UTC timestamp of scheduled publication |
| `accountId` | string | Account identifier |

**Error (4xx/5xx)**:
```json
{
  "error": "error_code",
  "message": "Human-readable error description",
  "statusCode": 400
}
```

**Common Error Codes**:
- `400`: Bad Request (invalid parameters, malformed data)
- `401`: Unauthorized (invalid API key)
- `404`: Not Found (account doesn't exist)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error
- `503`: Service Unavailable

### Example Request

```typescript
const response = await fetch('https://api.blotato.com/v2/posts', {
  method: 'POST',
  headers: {
    'blotato-api-key': 'blt_U8efNW8bxtJlTN/fGU1CW6LV2p90rIvr1rQjl2cBnlM=',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    accountId: process.env.BLOTATO_ACCOUNT_ID,
    content: {
      text: 'Freebie of the Day - Download now!',
      platform: 'instagram'
    },
    target: {
      targetType: 'story'
    },
    mediaUrls: ['https://yourdomain.com/uploads/story.png'],
    scheduledTime: '2024-01-15T03:30:00Z'
  })
});

const data = await response.json();
console.log(`Scheduled with post ID: ${data.postId}`);
```

## Endpoint: GET /v2/posts/{postId}

**Purpose**: Retrieve status and details of a specific post

### Request

**URL**: `GET https://api.blotato.com/v2/posts/{postId}`

**Headers**:
```
blotato-api-key: blt_U8efNW8bxtJlTN/fGU1CW6LV2p90rIvr1rQjl2cBnlM=
```

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `postId` | string | Blotato post ID (e.g., `blot_abc123`) |

### Response

**Success (200 OK)**:
```json
{
  "postId": "blot_abc123",
  "status": "published" | "scheduled" | "failed",
  "scheduledTime": "2024-01-15T03:30:00Z",
  "publishedAt": "2024-01-15T03:30:15Z",
  "accountId": "account_xyz",
  "mediaUrls": ["https://..."]
}
```

**Status Values**:
- `scheduled`: Post is queued for future publication
- `published` or `live`: Post has been successfully published
- `failed`: Publication attempt failed

**Error (404 Not Found)**:
```json
{
  "error": "post_not_found",
  "message": "Post with ID blot_abc123 not found",
  "statusCode": 404
}
```

**Handling 404**: Post may have been manually deleted via Blotato dashboard. Handle gracefully by cleaning up local records.

### Example Request

```typescript
const response = await fetch(
  `https://api.blotato.com/v2/posts/${postId}`,
  {
    headers: {
      'blotato-api-key': 'blt_U8efNW8bxtJlTN/fGU1CW6LV2p90rIvr1rQjl2cBnlM='
    }
  }
);

if (response.status === 404) {
  console.log('Post not found (may have been deleted)');
} else {
  const data = await response.json();
  console.log(`Post status: ${data.status}`);

  if (data.status === 'published') {
    console.log(`Published at: ${data.publishedAt}`);
  }
}
```

## Endpoint: DELETE /v2/posts/{postId}

**Purpose**: Cancel a scheduled post or delete a published post

### Request

**URL**: `DELETE https://api.blotato.com/v2/posts/{postId}`

**Headers**:
```
blotato-api-key: blt_U8efNW8bxtJlTN/fGU1CW6LV2p90rIvr1rQjl2cBnlM=
```

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `postId` | string | Blotato post ID to delete |

### Response

**Success (200 OK)**:
```json
{
  "success": true,
  "message": "Post deleted successfully"
}
```

**Error (404 Not Found)**:
Post not found or already deleted. **Handle gracefully** - proceed with local cleanup even if 404.

### Example Request

```typescript
const response = await fetch(
  `https://api.blotato.com/v2/posts/${postId}`,
  {
    method: 'DELETE',
    headers: {
      'blotato-api-key': 'blt_U8efNW8bxtJlTN/fGU1CW6LV2p90rIvr1rQjl2cBnlM='
    }
  }
);

if (response.status === 404) {
  // Post already deleted, proceed with local cleanup
  console.log('Post not found on Blotato, cleaning up locally');
} else if (response.ok) {
  console.log('Post deleted successfully');
} else {
  throw new Error(`Failed to delete: ${response.status}`);
}
```

## Rate Limiting

**Behavior**: Blotato enforces dynamic rate limits based on subscription tier.

**Response Code**: `429 Too Many Requests`

**Response Headers**:
```
Retry-After: 30
```

The `Retry-After` header indicates how many **seconds** to wait before retrying.

**Handling Rate Limits**:
```typescript
if (response.status === 429) {
  const retryAfter = parseInt(response.headers.get('Retry-After') || '30');
  console.log(`Rate limit hit. Retrying in ${retryAfter}s...`);
  await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
  // Retry request
}
```

**Best Practices**:
1. Add delays between sequential requests (1 second minimum)
2. Respect `Retry-After` header
3. Implement exponential backoff for general retries
4. Process bulk operations sequentially

## Timeouts

**Recommended Timeout**: 15 seconds (per SPEC.md)

**Implementation**:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000);

try {
  const response = await fetch(url, {
    signal: controller.signal,
    ...options
  });
  clearTimeout(timeoutId);
  return response;
} catch (error) {
  clearTimeout(timeoutId);
  if (error.name === 'AbortError') {
    throw new Error('Blotato API request timeout');
  }
  throw error;
}
```

## API Dashboard

**URL**: https://my.blotato.com/api-dashboard

**Features**:
- View all API requests in real-time
- Inspect request/response payloads
- Check authentication status
- Verify account connections
- Debug failed requests
- View full error messages

**Use Cases**:
- Debugging authentication errors
- Verifying request parameters
- Monitoring API usage
- Troubleshooting failed scheduling attempts

## Media URL Requirements

For `mediaUrls` field:

1. **Must be HTTPS**: HTTP URLs are rejected
2. **Publicly Accessible**: No authentication required
3. **Valid Content-Type**: Must return `Content-Type: image/*`
4. **File Size**: Max 30MB for Instagram Stories
5. **Format**: PNG or JPG recommended
6. **Resolution**: 1080x1920 pixels for Instagram Stories

**Testing Media URL**:
```typescript
const response = await fetch(mediaUrl, { method: 'HEAD' });
console.log('Status:', response.status); // Should be 200
console.log('Content-Type:', response.headers.get('Content-Type')); // Should start with 'image/'
```

## Best Practices

1. **Always use HTTPS** for media URLs
2. **Validate timezone conversion** before sending `scheduledTime`
3. **Implement retry logic** with exponential backoff
4. **Handle 404 gracefully** on DELETE (post may already be removed)
5. **Store `postId` immediately** upon successful response
6. **Poll for verification** after scheduled time passes (every 5 minutes)
7. **Log all API interactions** for debugging
8. **Use API Dashboard** for troubleshooting
9. **Add delays between bulk requests** (1 second minimum)
10. **Respect rate limits** (429 responses)

## Error Handling Patterns

See [ERROR_CODES.md](ERROR_CODES.md) for comprehensive error handling guide.

**General Pattern**:
```typescript
try {
  const response = await fetch(url, options);

  if (response.status === 401) {
    // Authentication error - check API key
  } else if (response.status === 400) {
    // Validation error - check parameters
  } else if (response.status === 404) {
    // Not found - handle gracefully
  } else if (response.status === 429) {
    // Rate limit - respect Retry-After
  } else if (response.status >= 500) {
    // Server error - retry with backoff
  } else if (!response.ok) {
    // Other error
  }

  return await response.json();
} catch (error) {
  // Network error - retry with backoff
}
```

## TypeScript Types

```typescript
// Request types
interface PostRequest {
  accountId: string;
  content: {
    text: string;
    platform: 'instagram' | 'twitter' | 'facebook' | 'linkedin';
  };
  target: {
    targetType: 'story' | 'post' | 'reel';
  };
  mediaUrls?: string[];
  scheduledTime?: string; // ISO 8601 UTC
}

// Response types
interface PostResponse {
  postId: string;
  status: 'scheduled' | 'posted';
  scheduledTime?: string;
  accountId: string;
}

interface PostStatusResponse {
  postId: string;
  status: 'published' | 'live' | 'scheduled' | 'failed';
  scheduledTime?: string;
  publishedAt?: string;
  accountId?: string;
  mediaUrls?: string[];
}

interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}
```

---

**Last Updated**: January 2026
**API Version**: v2
**Project**: IconScout Story Automator (ISA)
