# Blotato API Error Codes & Solutions

Comprehensive error handling guide for Blotato API integration.

## Error Response Format

All Blotato API errors follow this structure:
```json
{
  "error": "error_code",
  "message": "Human-readable description",
  "statusCode": 400
}
```

## Authentication Errors

### 401 Unauthorized

**Cause**: Invalid, missing, or expired API key

**Response**:
```json
{
  "error": "unauthorized",
  "message": "Invalid API key",
  "statusCode": 401
}
```

**Solutions**:
1. Verify `BLOTATO_API_KEY` environment variable is set
2. Check API key is correct: `blt_U8efNW8bxtJlTN/fGU1CW6LV2p90rIvr1rQjl2cBnlM=`
3. Ensure header format: `blotato-api-key: YOUR_KEY` (not `Authorization: Bearer ...`)
4. Check API key hasn't been regenerated in Blotato dashboard

**User Message**: "Blotato API authentication failed. Please verify API key configuration."

**Logging**:
```typescript
logger.error('Blotato authentication failed', {
  endpoint: '/v2/posts',
  hint: 'Check BLOTATO_API_KEY environment variable'
});
```

## Validation Errors

### 400 Bad Request - Invalid Parameters

**Causes**:
- `scheduledTime` is in the past
- `scheduledTime` malformed (not ISO 8601)
- Missing required fields
- Invalid `accountId`
- `mediaUrls` inaccessible

**Response Examples**:
```json
{
  "error": "invalid_request",
  "message": "scheduledTime must be in the future",
  "statusCode": 400,
  "field": "scheduledTime"
}
```

**Solutions**:
1. Run validation before API call (use `lib/validate-schedule-params.ts`)
2. Ensure timezone conversion is correct (user TZ → UTC)
3. Verify all required fields present
4. Test `mediaUrls` accessibility with HEAD request

**User Messages**:
- "Invalid scheduling parameters: {error.message}"
- "Scheduled time must be in the future"
- "Media URL is not accessible"

### 400 Bad Request - Invalid Account

**Cause**: `accountId` doesn't exist or isn't connected

**Response**:
```json
{
  "error": "invalid_account",
  "message": "Account not found or not connected",
  "statusCode": 400
}
```

**Solution**: Verify Instagram account connection in Blotato dashboard

**User Message**: "Instagram account not connected in Blotato. Please connect account first."

## Resource Errors

### 404 Not Found

**Causes**:
- Post ID doesn't exist
- Post has been deleted
- Using incorrect `postId`

**Response**:
```json
{
  "error": "post_not_found",
  "message": "Post not found",
  "statusCode": 404
}
```

**Solutions**:
- On `DELETE`: Handle gracefully, proceed with local cleanup
- On `GET`: Check if post was manually deleted via Blotato dashboard
- Verify `postId` stored correctly in `history.json`

**User Message**: "Post not found on Blotato (may have been deleted). Cleaning up local records."

**Handling**:
```typescript
if (response.status === 404) {
  logger.warn(`Post ${postId} not found on Blotato`);
  // Proceed with local cleanup
  await updateHistory(itemId, {
    status: 'Draft',
    blotato_post_id: null
  });
}
```

## Rate Limiting

### 429 Too Many Requests

**Cause**: Exceeded API rate limit for subscription tier

**Response**:
```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please retry after 30 seconds",
  "statusCode": 429
}
```

**Response Headers**:
```
Retry-After: 30
```

**Solutions**:
1. Read `Retry-After` header
2. Wait specified duration (in seconds)
3. Add delays between sequential requests (1 second minimum)
4. Process bulk operations sequentially

**User Message**: "Rate limit reached. Retrying in {retryAfter} seconds..."

**Implementation**:
```typescript
if (response.status === 429) {
  const retryAfter = parseInt(response.headers.get('Retry-After') || '30');
  logger.warn('Blotato rate limit hit', { retryAfter });
  await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
  return retry();
}
```

## Server Errors

### 500 Internal Server Error

**Cause**: Blotato server encountered an error

**Response**:
```json
{
  "error": "internal_server_error",
  "message": "An unexpected error occurred",
  "statusCode": 500
}
```

**Solutions**:
1. Implement retry with exponential backoff (5s, 15s, 45s per SPEC.md)
2. Log full error details
3. If retries fail, mark as "Schedule Failed"

**User Message**: "Blotato service encountered an error. Retrying... (Attempt {X}/3)"

### 503 Service Unavailable

**Cause**: Blotato API temporarily down for maintenance

**Response**:
```json
{
  "error": "service_unavailable",
  "message": "Service temporarily unavailable",
  "statusCode": 503
}
```

**Solutions**: Same as 500 - retry with exponential backoff

**User Message**: "Blotato service temporarily unavailable. Retrying..."

## Network Errors

### Request Timeout

**Cause**: Request exceeded 15-second timeout

**Error**: JavaScript `AbortError`

**Solutions**:
1. Check network connectivity
2. Retry with exponential backoff
3. If persistent, check Blotato status page

**User Message**: "Network timeout. Retrying... (Attempt {X}/3)"

**Implementation**:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000);

try {
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId);
} catch (error) {
  clearTimeout(timeoutId);
  if (error.name === 'AbortError') {
    throw new Error('Request timeout after 15 seconds');
  }
}
```

### Connection Refused / Network Unreachable

**Causes**:
- No internet connectivity
- Firewall blocking requests
- DNS resolution failure

**User Message**: "Unable to connect to Blotato. Please check your network connection."

## Media Errors

### 400 Bad Request - Invalid Media URL

**Cause**: `mediaUrls` pointing to inaccessible or invalid resources

**Response**:
```json
{
  "error": "invalid_media",
  "message": "Media URL is not accessible: https://...",
  "statusCode": 400
}
```

**Solutions**:
1. Verify media URLs are publicly accessible (no authentication)
2. Ensure URLs use HTTPS protocol
3. Test URL with HEAD request before submission
4. Check media file format is supported (PNG, JPG)

**Validation**:
```typescript
async function validateMediaUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentType = response.headers.get('Content-Type');
    return response.ok && contentType?.startsWith('image/');
  } catch {
    return false;
  }
}
```

## Comprehensive Error Handler

```typescript
async function handleBlotatoError(
  error: any,
  context: { itemId: string; attempt: number }
): Promise<{
  userMessage: string;
  shouldRetry: boolean;
  retryAfter?: number;
}> {
  const statusCode = error.response?.status || 0;

  switch (statusCode) {
    case 401:
      logger.error('Blotato authentication failed', context);
      return {
        userMessage: 'API authentication failed. Check configuration.',
        shouldRetry: false
      };

    case 400:
      logger.warn('Blotato validation error', {
        ...context,
        error: error.message
      });
      return {
        userMessage: `Invalid request: ${error.message}`,
        shouldRetry: false
      };

    case 404:
      logger.info('Blotato post not found', context);
      return {
        userMessage: 'Post not found (may have been deleted).',
        shouldRetry: false
      };

    case 429:
      const retryAfter = error.response?.headers?.['retry-after'] || 30;
      logger.warn('Blotato rate limit hit', { ...context, retryAfter });
      return {
        userMessage: `Rate limit reached. Retrying in ${retryAfter}s...`,
        shouldRetry: true,
        retryAfter: retryAfter * 1000
      };

    case 500:
    case 503:
      logger.error('Blotato server error', { ...context, statusCode });
      return {
        userMessage: 'Blotato service error. Retrying...',
        shouldRetry: true
      };

    default:
      logger.error('Unexpected Blotato error', { ...context, error });
      return {
        userMessage: 'Unexpected error occurred. Retrying...',
        shouldRetry: true
      };
  }
}
```

## Error Storage in history.json

When all retries fail, store detailed error information:

```json
{
  "status": "Schedule Failed",
  "error": {
    "message": "User-friendly error message",
    "details": "Technical details (stack trace, API response)",
    "failed_at": "2024-01-08T10:45:00Z",
    "retry_count": 3,
    "status_code": 500
  }
}
```

## Summary: Error → Action Matrix

| Status Code | Error Type | User Message | Retry? | Action |
|-------------|-----------|--------------|--------|--------|
| 401 | Auth Failed | "Authentication failed" | No | Check API key |
| 400 | Invalid Params | "Invalid parameters" | No | Fix validation |
| 404 | Not Found | "Post not found" | No | Clean up locally |
| 429 | Rate Limit | "Rate limit hit" | Yes | Wait + retry |
| 500 | Server Error | "Service error" | Yes | Exponential backoff |
| 503 | Unavailable | "Service unavailable" | Yes | Exponential backoff |
| Timeout | Network | "Request timeout" | Yes | Exponential backoff |
| Other | Unknown | "Unexpected error" | Yes | Exponential backoff |

---

**Last Updated**: January 2026
**Project**: IconScout Story Automator (ISA)
