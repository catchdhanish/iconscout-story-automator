# Composition Preview & Bulk Approval Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add preview generation system showing final composed stories (background + asset) with client-side text overlay toggle, and implement bulk approval workflow for Draft assets with checkboxes and progress tracking.

**Architecture:** Extends existing composition pipeline (lib/composition.ts) to generate previews without text overlay for toggle functionality. Client-side text overlay uses actual SVG from existing generateTextSVG(). Bulk approval processes Draft→Ready transitions sequentially with retry logic and progress indication.

**Tech Stack:** Next.js 14+ App Router, Sharp (existing), React hooks, TypeScript, Jest

---

## CRITICAL: Existing Implementation Reference

**DO NOT recreate these (already implemented with 114 passing tests):**
- `lib/text-overlay.ts` - Has `generateTextSVG()` and `applyTextOverlay()`
- `lib/asset-detection.ts` - Has `detectAssetBottomEdge()` and `calculateTextTier()`
- `lib/composition.ts` - Already supports `includeText` option in `composeStory()`
- `lib/config.ts` - Has TEXT_OVERLAY_ENABLED and TEXT_OVERLAY_CONCURRENCY
- `public/fonts/DMSans-VariableFont_opsz,wght.ttf` - Font file exists

**This plan adds:**
1. Preview generation endpoint (uses existing `composeStory()` with `includeText: false`)
2. Text SVG endpoint (uses existing `generateTextSVG()`)
3. EditAssetModal text overlay toggle (client-side CSS positioning)
4. Bulk approval workflow (completely new)

---

## Task 1: Add Preview Types and Configuration

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/config.ts`
- Modify: `.env.example`

**Step 1: Write failing test for preview types**

Create: `lib/__tests__/types.test.ts`

```typescript
import type { AssetVersion } from '../types';

describe('AssetVersion with preview fields', () => {
  it('should support optional preview fields', () => {
    const version: AssetVersion = {
      version: 1,
      created_at: '2026-01-13T00:00:00Z',
      prompt_used: 'Test prompt',
      file_path: '/uploads/test/v1.png',
      preview_file_path: '/uploads/test/preview-v1.png',
      preview_generated_at: '2026-01-13T00:01:00Z',
      preview_generation_time_ms: 1234,
      preview_generation_failed: false
    };

    expect(version.preview_file_path).toBe('/uploads/test/preview-v1.png');
    expect(version.preview_generation_time_ms).toBe(1234);
  });

  it('should allow preview fields to be undefined', () => {
    const version: AssetVersion = {
      version: 1,
      created_at: '2026-01-13T00:00:00Z',
      prompt_used: 'Test prompt',
      file_path: '/uploads/test/v1.png'
    };

    expect(version.preview_file_path).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- lib/__tests__/types.test.ts`
Expected: FAIL with "Type '{ ... }' is not assignable to type 'AssetVersion'"

**Step 3: Update AssetVersion interface**

Modify `lib/types.ts`:

```typescript
export interface AssetVersion {
  version: number;
  created_at: string;
  prompt_used: string;
  refinement_prompt?: string;
  file_path: string;
  // NEW: Preview fields
  preview_file_path?: string;
  preview_generated_at?: string;
  preview_generation_time_ms?: number;
  preview_generation_failed?: boolean;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- lib/__tests__/types.test.ts`
Expected: PASS (2 tests)

**Step 5: Add preview configuration**

Modify `lib/config.ts`, add after TEXT_OVERLAY_CONCURRENCY:

```typescript
export const PREVIEW_RETENTION_DAYS = parseInt(
  process.env.PREVIEW_RETENTION_DAYS || '30',
  10
);

export const BULK_APPROVAL_LIMIT = parseInt(
  process.env.BULK_APPROVAL_LIMIT || '50',
  10
);
```

**Step 6: Update .env.example**

Add to `.env.example`:

```bash
# Preview Configuration
PREVIEW_RETENTION_DAYS=30
BULK_APPROVAL_LIMIT=50
```

**Step 7: Commit**

```bash
git add lib/types.ts lib/config.ts .env.example lib/__tests__/types.test.ts
git commit -m "feat: add preview types and configuration

- Add preview_file_path, preview_generated_at to AssetVersion
- Add PREVIEW_RETENTION_DAYS and BULK_APPROVAL_LIMIT config
- Add type tests for preview fields"
```

---

## Task 2: Create Preview Generation Utility

**Files:**
- Create: `lib/preview.ts`
- Create: `lib/__tests__/preview.test.ts`

**Step 1: Write failing test for getPreviewPath**

Create `lib/__tests__/preview.test.ts`:

```typescript
import { getPreviewPath, isPreviewStale } from '../preview';
import path from 'path';

describe('getPreviewPath', () => {
  it('should return correct preview path for asset and version', () => {
    const result = getPreviewPath('test-asset-id', 2);

    expect(result).toBe(
      path.join(process.cwd(), 'public/uploads/test-asset-id/preview-v2.png')
    );
  });

  it('should handle asset IDs with special characters', () => {
    const result = getPreviewPath('abc-123-def', 1);

    expect(result).toContain('abc-123-def/preview-v1.png');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- lib/__tests__/preview.test.ts`
Expected: FAIL with "Cannot find module '../preview'"

**Step 3: Implement getPreviewPath**

Create `lib/preview.ts`:

```typescript
import path from 'path';
import fs from 'fs/promises';
import { composeStory } from './composition';
import type { AssetVersion } from './types';

/**
 * Get the file path for a preview image
 */
export function getPreviewPath(assetId: string, version: number): string {
  return path.join(
    process.cwd(),
    'public/uploads',
    assetId,
    `preview-v${version}.png`
  );
}

/**
 * Get the URL path for serving a preview image
 */
export function getPreviewUrl(assetId: string, version: number): string {
  return `/uploads/${assetId}/preview-v${version}.png`;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- lib/__tests__/preview.test.ts`
Expected: PASS (2 tests)

**Step 5: Write test for isPreviewStale**

Add to `lib/__tests__/preview.test.ts`:

```typescript
describe('isPreviewStale', () => {
  it('should return true if preview is older than version', () => {
    const version: AssetVersion = {
      version: 1,
      created_at: '2026-01-13T00:10:00Z',
      prompt_used: 'Test',
      file_path: '/test/v1.png',
      preview_generated_at: '2026-01-13T00:05:00Z' // 5 minutes before
    };

    expect(isPreviewStale(version)).toBe(true);
  });

  it('should return false if preview is newer than version', () => {
    const version: AssetVersion = {
      version: 1,
      created_at: '2026-01-13T00:05:00Z',
      prompt_used: 'Test',
      file_path: '/test/v1.png',
      preview_generated_at: '2026-01-13T00:10:00Z' // 5 minutes after
    };

    expect(isPreviewStale(version)).toBe(false);
  });

  it('should return true if preview_generated_at is missing', () => {
    const version: AssetVersion = {
      version: 1,
      created_at: '2026-01-13T00:05:00Z',
      prompt_used: 'Test',
      file_path: '/test/v1.png'
    };

    expect(isPreviewStale(version)).toBe(true);
  });
});
```

**Step 6: Run test to verify it fails**

Run: `npm test -- lib/__tests__/preview.test.ts -t "isPreviewStale"`
Expected: FAIL with "isPreviewStale is not a function"

**Step 7: Implement isPreviewStale**

Add to `lib/preview.ts`:

```typescript
/**
 * Check if a preview is stale (older than the version timestamp)
 */
export function isPreviewStale(version: AssetVersion): boolean {
  if (!version.preview_generated_at) {
    return true;
  }

  const versionTime = new Date(version.created_at).getTime();
  const previewTime = new Date(version.preview_generated_at).getTime();

  return previewTime < versionTime;
}
```

**Step 8: Run test to verify it passes**

Run: `npm test -- lib/__tests__/preview.test.ts -t "isPreviewStale"`
Expected: PASS (3 tests)

**Step 9: Write test for generatePreview**

Add to `lib/__tests__/preview.test.ts`:

```typescript
import { generatePreview } from '../preview';
import { readHistory, updateHistory } from '../history';
import * as composition from '../composition';

// Mock dependencies
jest.mock('../history');
jest.mock('../composition');
jest.mock('fs/promises');

describe('generatePreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate preview and update metadata', async () => {
    const mockAsset = {
      id: 'test-id',
      asset_url: '/uploads/test-id.png',
      active_version: 1,
      versions: [
        {
          version: 1,
          created_at: '2026-01-13T00:00:00Z',
          prompt_used: 'Test',
          file_path: '/uploads/test-id/v1.png'
        }
      ]
    };

    (readHistory as jest.Mock).mockResolvedValue({
      assets: [mockAsset]
    });

    (composition.composeStory as jest.Mock).mockResolvedValue({
      success: true,
      outputPath: '/test/preview-v1.png',
      processingTime: 1234
    });

    const result = await generatePreview('test-id', 1);

    expect(result.success).toBe(true);
    expect(result.previewUrl).toBe('/uploads/test-id/preview-v1.png');
    expect(composition.composeStory).toHaveBeenCalledWith(
      expect.stringContaining('v1.png'),
      expect.stringContaining('test-id.png'),
      expect.stringContaining('preview-v1.png'),
      { includeText: false }
    );
    expect(updateHistory).toHaveBeenCalled();
  });

  it('should handle missing asset', async () => {
    (readHistory as jest.Mock).mockResolvedValue({
      assets: []
    });

    await expect(generatePreview('missing-id', 1)).rejects.toThrow(
      'Asset not found'
    );
  });

  it('should retry once on failure then mark as failed', async () => {
    const mockAsset = {
      id: 'test-id',
      asset_url: '/uploads/test-id.png',
      active_version: 1,
      versions: [
        {
          version: 1,
          created_at: '2026-01-13T00:00:00Z',
          prompt_used: 'Test',
          file_path: '/uploads/test-id/v1.png'
        }
      ]
    };

    (readHistory as jest.Mock).mockResolvedValue({
      assets: [mockAsset]
    });

    (composition.composeStory as jest.Mock)
      .mockRejectedValueOnce(new Error('Composition failed'))
      .mockRejectedValueOnce(new Error('Composition failed again'));

    const result = await generatePreview('test-id', 1);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Composition failed again');
    expect(composition.composeStory).toHaveBeenCalledTimes(2); // Initial + retry
    expect(updateHistory).toHaveBeenCalled(); // Updates with failure flag
  });
});
```

**Step 10: Run test to verify it fails**

Run: `npm test -- lib/__tests__/preview.test.ts -t "generatePreview"`
Expected: FAIL with "generatePreview is not a function"

**Step 11: Implement generatePreview**

Add to `lib/preview.ts`:

```typescript
import { readHistory, updateHistory } from './history';

export interface PreviewResult {
  success: boolean;
  previewUrl?: string;
  generated_at?: string;
  generation_time_ms?: number;
  error?: string;
}

/**
 * Generate a composition preview for an asset version
 */
export async function generatePreview(
  assetId: string,
  version: number
): Promise<PreviewResult> {
  const startTime = Date.now();

  try {
    // Read asset metadata
    const history = await readHistory();
    const asset = history.assets.find(a => a.id === assetId);

    if (!asset) {
      throw new Error('Asset not found');
    }

    const assetVersion = asset.versions?.find(v => v.version === version);
    if (!assetVersion) {
      throw new Error(`Version ${version} not found`);
    }

    // Build paths
    const backgroundPath = path.join(process.cwd(), 'public', assetVersion.file_path);
    const assetPath = path.join(process.cwd(), 'public', asset.asset_url);
    const previewPath = getPreviewPath(assetId, version);

    // Ensure directory exists
    await fs.mkdir(path.dirname(previewPath), { recursive: true });

    // Generate preview (without text overlay for toggle functionality)
    let composeResult;
    try {
      composeResult = await composeStory(backgroundPath, assetPath, previewPath, {
        includeText: false
      });
    } catch (firstError) {
      // Retry once
      console.warn(`Preview generation failed, retrying: ${firstError}`);
      composeResult = await composeStory(backgroundPath, assetPath, previewPath, {
        includeText: false
      });
    }

    const generatedAt = new Date().toISOString();
    const generationTime = Date.now() - startTime;

    // Update metadata
    await updateHistory(history => {
      const asset = history.assets.find(a => a.id === assetId);
      if (asset) {
        const version = asset.versions?.find(v => v.version === assetVersion.version);
        if (version) {
          version.preview_file_path = getPreviewUrl(assetId, assetVersion.version);
          version.preview_generated_at = generatedAt;
          version.preview_generation_time_ms = generationTime;
          version.preview_generation_failed = false;
        }
      }
      return history;
    });

    return {
      success: true,
      previewUrl: getPreviewUrl(assetId, version),
      generated_at: generatedAt,
      generation_time_ms: generationTime
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Preview generation failed for ${assetId} v${version}:`, error);

    // Mark as failed in metadata
    try {
      await updateHistory(history => {
        const asset = history.assets.find(a => a.id === assetId);
        if (asset) {
          const version = asset.versions?.find(v => v.version === version);
          if (version) {
            version.preview_generation_failed = true;
          }
        }
        return history;
      });
    } catch (updateError) {
      console.error('Failed to update preview failure status:', updateError);
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}
```

**Step 12: Run test to verify it passes**

Run: `npm test -- lib/__tests__/preview.test.ts`
Expected: PASS (all tests)

**Step 13: Commit**

```bash
git add lib/preview.ts lib/__tests__/preview.test.ts
git commit -m "feat: add preview generation utility

- getPreviewPath() and getPreviewUrl() helpers
- isPreviewStale() checks if preview older than version
- generatePreview() creates composition without text overlay
- Auto-retry once on failure
- Updates AssetVersion metadata with preview info"
```

---

## Task 3: Create Preview Generation API Endpoint

**Files:**
- Create: `app/api/assets/[assetId]/preview/route.ts`
- Create: `app/api/assets/[assetId]/preview/route.test.ts`

**Step 1: Write failing API test**

Create `app/api/assets/[assetId]/preview/route.test.ts`:

```typescript
import { POST } from './route';
import { generatePreview } from '@/lib/preview';
import { NextRequest } from 'next/server';

jest.mock('@/lib/preview');

describe('POST /api/assets/[assetId]/preview', () => {
  it('should generate preview and return result', async () => {
    (generatePreview as jest.Mock).mockResolvedValue({
      success: true,
      previewUrl: '/uploads/test-id/preview-v1.png',
      generated_at: '2026-01-13T00:00:00Z',
      generation_time_ms: 1234
    });

    const request = new NextRequest('http://localhost/api/assets/test-id/preview', {
      method: 'POST',
      body: JSON.stringify({ version: 1 })
    });

    const response = await POST(request, { params: { assetId: 'test-id' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.previewUrl).toBe('/uploads/test-id/preview-v1.png');
    expect(generatePreview).toHaveBeenCalledWith('test-id', 1);
  });

  it('should use active version if version not specified', async () => {
    (generatePreview as jest.Mock).mockResolvedValue({
      success: true,
      previewUrl: '/uploads/test-id/preview-v2.png',
      generated_at: '2026-01-13T00:00:00Z',
      generation_time_ms: 1234
    });

    const request = new NextRequest('http://localhost/api/assets/test-id/preview', {
      method: 'POST',
      body: JSON.stringify({})
    });

    // Mock readHistory to return asset with active_version
    const { readHistory } = require('@/lib/history');
    (readHistory as jest.Mock).mockResolvedValue({
      assets: [{ id: 'test-id', active_version: 2 }]
    });

    const response = await POST(request, { params: { assetId: 'test-id' } });
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(generatePreview).toHaveBeenCalledWith('test-id', 2);
  });

  it('should return error if generation fails', async () => {
    (generatePreview as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Composition failed'
    });

    const request = new NextRequest('http://localhost/api/assets/test-id/preview', {
      method: 'POST',
      body: JSON.stringify({ version: 1 })
    });

    const response = await POST(request, { params: { assetId: 'test-id' } });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Composition failed');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- app/api/assets/\\[assetId\\]/preview`
Expected: FAIL with "Cannot find module './route'"

**Step 3: Implement preview API endpoint**

Create `app/api/assets/[assetId]/preview/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { generatePreview } from '@/lib/preview';
import { readHistory } from '@/lib/history';

export async function POST(
  request: NextRequest,
  { params }: { params: { assetId: string } }
) {
  try {
    const { assetId } = params;
    const body = await request.json();
    let { version, includeText = false } = body;

    // If version not specified, use active version
    if (!version) {
      const history = await readHistory();
      const asset = history.assets.find(a => a.id === assetId);
      if (!asset) {
        return NextResponse.json(
          { success: false, error: 'Asset not found' },
          { status: 404 }
        );
      }
      version = asset.active_version;
    }

    // Generate preview
    const result = await generatePreview(assetId, version);

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Preview API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- app/api/assets/\\[assetId\\]/preview`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add app/api/assets/[assetId]/preview/
git commit -m "feat: add preview generation API endpoint

POST /api/assets/[assetId]/preview
- Accepts optional version (defaults to active_version)
- Calls generatePreview() from lib/preview
- Returns preview URL and generation metadata"
```

---

## Task 4: Hook Preview Generation into Background Route

**Files:**
- Modify: `app/api/assets/[assetId]/background/route.ts`

**Step 1: Read current background route implementation**

Run: `cat app/api/assets/[assetId]/background/route.ts | head -50`

**Step 2: Write test for automatic preview generation**

Add to existing test file `app/api/assets/[assetId]/background/route.test.ts`:

```typescript
import { generatePreview } from '@/lib/preview';

jest.mock('@/lib/preview');

describe('POST /api/assets/[assetId]/background - preview generation', () => {
  it('should automatically generate preview after successful background generation', async () => {
    // Mock successful background generation
    (generatePreview as jest.Mock).mockResolvedValue({
      success: true,
      previewUrl: '/uploads/test-id/preview-v1.png'
    });

    // ... existing test setup for background generation ...

    const response = await POST(request, { params: { assetId: 'test-id' } });
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(generatePreview).toHaveBeenCalledWith('test-id', expect.any(Number));
  });

  it('should succeed even if preview generation fails', async () => {
    (generatePreview as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Preview failed'
    });

    // ... existing test setup ...

    const response = await POST(request, { params: { assetId: 'test-id' } });
    const data = await response.json();

    expect(data.success).toBe(true); // Background still succeeds
    expect(data.warning).toContain('Preview generation failed');
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npm test -- app/api/assets/\\[assetId\\]/background/route.test.ts -t "preview"`
Expected: FAIL with "generatePreview was not called"

**Step 4: Update background route to call generatePreview**

Modify `app/api/assets/[assetId]/background/route.ts`, add after successful background generation:

```typescript
import { generatePreview } from '@/lib/preview';

// ... existing code ...

// After background generation succeeds and version is saved:

// Generate preview asynchronously (don't block response)
generatePreview(assetId, newVersion.version)
  .then(result => {
    if (!result.success) {
      console.warn(`Preview generation failed for ${assetId} v${newVersion.version}:`, result.error);
    }
  })
  .catch(error => {
    console.error(`Preview generation error for ${assetId} v${newVersion.version}:`, error);
  });

// Return response immediately (don't wait for preview)
return NextResponse.json({
  success: true,
  version: newVersion,
  // ... existing response data ...
});
```

**Step 5: Run test to verify it passes**

Run: `npm test -- app/api/assets/\\[assetId\\]/background/route.test.ts`
Expected: PASS (all tests)

**Step 6: Commit**

```bash
git add app/api/assets/[assetId]/background/route.ts app/api/assets/[assetId]/background/route.test.ts
git commit -m "feat: auto-generate preview after background creation

- Call generatePreview() after successful background generation
- Run asynchronously (don't block response)
- Log warning if preview fails (doesn't affect background success)"
```

---

## Task 5: Create Text SVG API Endpoint

**Files:**
- Create: `app/api/assets/[assetId]/text-svg/route.ts`
- Create: `app/api/assets/[assetId]/text-svg/route.test.ts`

**Step 1: Write failing API test**

Create `app/api/assets/[assetId]/text-svg/route.test.ts`:

```typescript
import { GET } from './route';
import { generateTextSVG } from '@/lib/text-overlay';
import { NextRequest } from 'next/server';

jest.mock('@/lib/text-overlay');
jest.mock('@/lib/history');

describe('GET /api/assets/[assetId]/text-svg', () => {
  it('should return text SVG with metadata', async () => {
    const mockSVG = '<svg>...</svg>';

    (generateTextSVG as jest.Mock).mockResolvedValue(mockSVG);

    const { readHistory } = require('@/lib/history');
    (readHistory as jest.Mock).mockResolvedValue({
      assets: [{
        id: 'test-id',
        text_overlay_analytics: {
          position_y: 1520,
          position_tier: 2,
          shadow_color: 'dark'
        }
      }]
    });

    const request = new NextRequest('http://localhost/api/assets/test-id/text-svg');
    const response = await GET(request, { params: { assetId: 'test-id' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.svg).toBe(mockSVG);
    expect(data.position_y).toBe(1520);
    expect(data.position_tier).toBe(2);
    expect(data.shadow_color).toBe('dark');
    expect(generateTextSVG).toHaveBeenCalledWith('Freebie of the Day!', 'dark', 1520);
  });

  it('should use custom content from query param', async () => {
    (generateTextSVG as jest.Mock).mockResolvedValue('<svg>...</svg>');

    const { readHistory } = require('@/lib/history');
    (readHistory as jest.Mock).mockResolvedValue({
      assets: [{
        id: 'test-id',
        text_overlay_analytics: {
          position_y: 1560,
          shadow_color: 'light'
        }
      }]
    });

    const request = new NextRequest(
      'http://localhost/api/assets/test-id/text-svg?content=Custom%20Text'
    );
    const response = await GET(request, { params: { assetId: 'test-id' } });

    expect(generateTextSVG).toHaveBeenCalledWith('Custom Text', 'light', 1560);
  });

  it('should return 404 if asset not found', async () => {
    const { readHistory } = require('@/lib/history');
    (readHistory as jest.Mock).mockResolvedValue({ assets: [] });

    const request = new NextRequest('http://localhost/api/assets/missing-id/text-svg');
    const response = await GET(request, { params: { assetId: 'missing-id' } });

    expect(response.status).toBe(404);
  });

  it('should use default values if text_overlay_analytics missing', async () => {
    (generateTextSVG as jest.Mock).mockResolvedValue('<svg>...</svg>');

    const { readHistory } = require('@/lib/history');
    (readHistory as jest.Mock).mockResolvedValue({
      assets: [{ id: 'test-id' }] // No text_overlay_analytics
    });

    const request = new NextRequest('http://localhost/api/assets/test-id/text-svg');
    const response = await GET(request, { params: { assetId: 'test-id' } });
    const data = await response.json();

    expect(data.position_y).toBe(1520); // Default tier 2
    expect(data.shadow_color).toBe('dark'); // Default
    expect(generateTextSVG).toHaveBeenCalledWith('Freebie of the Day!', 'dark', 1520);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- app/api/assets/\\[assetId\\]/text-svg`
Expected: FAIL with "Cannot find module './route'"

**Step 3: Implement text SVG API endpoint**

Create `app/api/assets/[assetId]/text-svg/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { generateTextSVG } from '@/lib/text-overlay';
import { readHistory } from '@/lib/history';
import { TEXT_OVERLAY_CONTENT } from '@/lib/config';

export async function GET(
  request: NextRequest,
  { params }: { params: { assetId: string } }
) {
  try {
    const { assetId } = params;
    const { searchParams } = new URL(request.url);
    const customContent = searchParams.get('content');

    // Read asset metadata
    const history = await readHistory();
    const asset = history.assets.find(a => a.id === assetId);

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Get text overlay parameters (with defaults)
    const textContent = customContent || TEXT_OVERLAY_CONTENT;
    const positionY = asset.text_overlay_analytics?.position_y || 1520;
    const positionTier = asset.text_overlay_analytics?.position_tier || 2;
    const shadowColor = asset.text_overlay_analytics?.shadow_color || 'dark';

    // Generate SVG using existing function
    const svg = await generateTextSVG(textContent, shadowColor as 'dark' | 'light', positionY);

    return NextResponse.json({
      svg,
      position_y: positionY,
      position_tier: positionTier,
      shadow_color: shadowColor
    });
  } catch (error) {
    console.error('Text SVG API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- app/api/assets/\\[assetId\\]/text-svg`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add app/api/assets/[assetId]/text-svg/
git commit -m "feat: add text SVG API endpoint

GET /api/assets/[assetId]/text-svg
- Returns actual SVG from generateTextSVG()
- Uses asset's text_overlay_analytics for positioning
- Supports custom content via query param
- Returns position and shadow metadata"
```

---

## Task 6: Update EditAssetModal with Text Overlay Toggle

**Files:**
- Modify: `components/EditAssetModal.tsx`

**Step 1: Read current EditAssetModal implementation**

Run: `head -100 components/EditAssetModal.tsx`

**Step 2: Add text overlay state and fetch logic**

Modify `components/EditAssetModal.tsx`, add after safe zones state:

```typescript
const [showTextOverlay, setShowTextOverlay] = useState(false);
const [textOverlaySVG, setTextOverlaySVG] = useState<string | null>(null);
const [loadingTextSVG, setLoadingTextSVG] = useState(false);

// Fetch text SVG when toggle is enabled
useEffect(() => {
  if (!showTextOverlay || !asset.id) {
    setTextOverlaySVG(null);
    return;
  }

  setLoadingTextSVG(true);

  fetch(`/api/assets/${asset.id}/text-svg`)
    .then(res => res.json())
    .then(data => {
      if (data.svg) {
        setTextOverlaySVG(data.svg);
      }
    })
    .catch(error => {
      console.error('Failed to load text SVG:', error);
    })
    .finally(() => {
      setLoadingTextSVG(false);
    });
}, [showTextOverlay, asset.id]);

// Keyboard shortcut for text overlay (T key)
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 't' || e.key === 'T') {
      setShowTextOverlay(prev => !prev);
    }
  };

  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

**Step 3: Update preview image source priority**

Modify the preview image rendering in `EditAssetModal.tsx`:

```typescript
// Determine preview URL (priority order)
const currentVersion = asset.versions?.[asset.active_version - 1];
const previewUrl = currentVersion?.preview_file_path && !isPreviewStale(currentVersion)
  ? currentVersion.preview_file_path
  : currentVersion?.file_path || asset.asset_url;

const isLoadingPreview = currentVersion?.preview_file_path === undefined &&
                         currentVersion?.file_path !== undefined;
```

**Step 4: Add text overlay toggle button**

Add button next to "Show Safe Zones" toggle:

```tsx
<div className="flex items-center gap-4">
  {/* Existing Safe Zones toggle */}
  <button
    onClick={() => setShowSafeZones(!showSafeZones)}
    className="text-sm text-gray-400 hover:text-white"
  >
    {showSafeZones ? '✓' : '○'} Show Safe Zones (S)
  </button>

  {/* NEW: Text Overlay toggle */}
  <button
    onClick={() => setShowTextOverlay(!showTextOverlay)}
    className="text-sm text-gray-400 hover:text-white"
    disabled={loadingTextSVG}
  >
    {showTextOverlay ? '✓' : '○'} Show Text Overlay (T)
    {loadingTextSVG && ' (loading...)'}
  </button>
</div>
```

**Step 5: Add text overlay rendering**

Add to preview container:

```tsx
<div className="relative" style={{ width: '360px', height: '640px' }}>
  {/* Background/Preview image */}
  <img
    src={previewUrl}
    alt="Story preview"
    className="w-full h-full object-cover rounded-lg"
  />

  {/* Loading indicator for preview generation */}
  {isLoadingPreview && (
    <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs px-2 py-1 rounded">
      Generating preview...
    </div>
  )}

  {/* NEW: Text overlay layer */}
  {showTextOverlay && textOverlaySVG && (
    <div
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{ zIndex: 10 }}
      dangerouslySetInnerHTML={{ __html: textOverlaySVG }}
    />
  )}

  {/* Safe zones overlay (z-index 20, above text) */}
  {showSafeZones && (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 20 }}>
      {/* ... existing safe zones rendering ... */}
    </div>
  )}
</div>
```

**Step 6: Add helper function for staleness check**

Add to `components/EditAssetModal.tsx`:

```typescript
function isPreviewStale(version: AssetVersion): boolean {
  if (!version.preview_generated_at) {
    return true;
  }

  const versionTime = new Date(version.created_at).getTime();
  const previewTime = new Date(version.preview_generated_at).getTime();

  return previewTime < versionTime;
}
```

**Step 7: Test manually in browser**

Start dev server: `npm run dev`

1. Open dashboard
2. Click Edit on an asset with a background
3. Verify preview shows (not just background)
4. Press T key or click toggle
5. Verify text overlay appears
6. Press S key
7. Verify safe zones appear above text

**Step 8: Commit**

```bash
git add components/EditAssetModal.tsx
git commit -m "feat: add text overlay toggle to EditAssetModal

- Show preview (background + asset) instead of just background
- Add 'Show Text Overlay' toggle button
- Fetch actual SVG from /api/assets/[id]/text-svg
- Keyboard shortcut: T key
- Text overlay z-index: 10, safe zones: 20
- Preview URL priority: preview_file_path > file_path > asset_url"
```

---

## Task 7: Add Bulk Approval Types

**Files:**
- Modify: `lib/types.ts`

**Step 1: Write test for bulk approval types**

Add to `lib/__tests__/types.test.ts`:

```typescript
import type { BulkApproveRequest, BulkApproveResponse } from '../types';

describe('Bulk approval types', () => {
  it('should support BulkApproveRequest structure', () => {
    const request: BulkApproveRequest = {
      assetIds: ['id1', 'id2', 'id3']
    };

    expect(request.assetIds).toHaveLength(3);
  });

  it('should support BulkApproveResponse structure', () => {
    const response: BulkApproveResponse = {
      success: true,
      approved: ['id1', 'id2'],
      failed: [
        { id: 'id3', reason: 'Missing background' }
      ],
      summary: {
        total_selected: 3,
        total_approved: 2,
        total_failed: 1
      }
    };

    expect(response.approved).toHaveLength(2);
    expect(response.failed).toHaveLength(1);
    expect(response.summary.total_approved).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- lib/__tests__/types.test.ts -t "Bulk approval"`
Expected: FAIL with "Cannot find name 'BulkApproveRequest'"

**Step 3: Add bulk approval types**

Add to `lib/types.ts`:

```typescript
export interface BulkApproveRequest {
  assetIds: string[];
}

export interface BulkApproveResponse {
  success: boolean;
  approved: string[];
  failed: Array<{
    id: string;
    reason: string;
  }>;
  summary: {
    total_selected: number;
    total_approved: number;
    total_failed: number;
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- lib/__tests__/types.test.ts -t "Bulk approval"`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add lib/types.ts lib/__tests__/types.test.ts
git commit -m "feat: add bulk approval types

- BulkApproveRequest with assetIds array
- BulkApproveResponse with approved/failed lists
- Summary with counts"
```

---

## Task 8: Create Bulk Approval API Endpoint

**Files:**
- Create: `app/api/assets/bulk-approve/route.ts`
- Create: `app/api/assets/bulk-approve/route.test.ts`

**Step 1: Write failing API test**

Create `app/api/assets/bulk-approve/route.test.ts`:

```typescript
import { POST } from './route';
import { NextRequest } from 'next/server';
import * as history from '@/lib/history';

jest.mock('@/lib/history');

describe('POST /api/assets/bulk-approve', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should approve all valid Draft assets', async () => {
    const mockHistory = {
      assets: [
        {
          id: 'asset1',
          status: 'Draft',
          active_version: 1,
          asset_url: '/uploads/asset1.png',
          versions: [{ version: 1, file_path: '/uploads/asset1/v1.png' }]
        },
        {
          id: 'asset2',
          status: 'Draft',
          active_version: 1,
          asset_url: '/uploads/asset2.png',
          versions: [{ version: 1, file_path: '/uploads/asset2/v1.png' }]
        }
      ]
    };

    (history.readHistory as jest.Mock).mockResolvedValue(mockHistory);
    (history.updateHistory as jest.Mock).mockImplementation(async (fn) => {
      return fn(mockHistory);
    });

    // Mock file existence checks
    jest.mock('fs', () => ({
      existsSync: jest.fn(() => true)
    }));

    const request = new NextRequest('http://localhost/api/assets/bulk-approve', {
      method: 'POST',
      body: JSON.stringify({ assetIds: ['asset1', 'asset2'] })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.approved).toEqual(['asset1', 'asset2']);
    expect(data.failed).toEqual([]);
    expect(data.summary.total_approved).toBe(2);
  });

  it('should filter out non-Draft assets', async () => {
    const mockHistory = {
      assets: [
        { id: 'draft1', status: 'Draft', active_version: 1 },
        { id: 'ready1', status: 'Ready', active_version: 1 }
      ]
    };

    (history.readHistory as jest.Mock).mockResolvedValue(mockHistory);

    const request = new NextRequest('http://localhost/api/assets/bulk-approve', {
      method: 'POST',
      body: JSON.stringify({ assetIds: ['draft1', 'ready1'] })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.approved).toEqual(['draft1']);
    expect(data.failed).toHaveLength(1);
    expect(data.failed[0].reason).toContain('not in Draft status');
  });

  it('should enforce 50 asset limit', async () => {
    const assetIds = Array.from({ length: 51 }, (_, i) => `asset${i}`);

    const request = new NextRequest('http://localhost/api/assets/bulk-approve', {
      method: 'POST',
      body: JSON.stringify({ assetIds })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Maximum 50 assets');
  });

  it('should retry failed approvals up to 3 times', async () => {
    const mockHistory = {
      assets: [
        { id: 'asset1', status: 'Draft', active_version: 1 }
      ]
    };

    (history.readHistory as jest.Mock).mockResolvedValue(mockHistory);

    let attemptCount = 0;
    (history.updateHistory as jest.Mock).mockImplementation(async () => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error('Network failure');
      }
      return mockHistory;
    });

    const request = new NextRequest('http://localhost/api/assets/bulk-approve', {
      method: 'POST',
      body: JSON.stringify({ assetIds: ['asset1'] })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(attemptCount).toBe(3); // Initial + 2 retries
    expect(data.approved).toEqual(['asset1']);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- app/api/assets/bulk-approve`
Expected: FAIL with "Cannot find module './route'"

**Step 3: Implement bulk approve API endpoint**

Create `app/api/assets/bulk-approve/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { readHistory, updateHistory } from '@/lib/history';
import { BULK_APPROVAL_LIMIT } from '@/lib/config';
import fs from 'fs';
import path from 'path';
import type { BulkApproveRequest, BulkApproveResponse } from '@/lib/types';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await sleep(backoffMs);
      }
    }
  }

  throw lastError;
}

function canApproveAsset(asset: any): { valid: boolean; reason?: string } {
  if (asset.status !== 'Draft') {
    return { valid: false, reason: 'Asset is not in Draft status' };
  }

  if (!asset.active_version || asset.active_version === 0) {
    return { valid: false, reason: 'No active version set' };
  }

  // Verify background file exists
  const version = asset.versions?.find((v: any) => v.version === asset.active_version);
  if (!version) {
    return { valid: false, reason: 'Active version not found' };
  }

  const backgroundPath = path.join(process.cwd(), 'public', version.file_path);
  if (!fs.existsSync(backgroundPath)) {
    return { valid: false, reason: 'Background file missing' };
  }

  // Verify asset file exists
  const assetPath = path.join(process.cwd(), 'public', asset.asset_url);
  if (!fs.existsSync(assetPath)) {
    return { valid: false, reason: 'Asset file missing' };
  }

  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    const body: BulkApproveRequest = await request.json();
    const { assetIds } = body;

    // Enforce limit
    if (assetIds.length > BULK_APPROVAL_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          error: `Maximum ${BULK_APPROVAL_LIMIT} assets per bulk approval. Selected: ${assetIds.length}`
        },
        { status: 400 }
      );
    }

    const approved: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];

    // Read current history
    const history = await readHistory();

    // Process each asset sequentially
    for (const assetId of assetIds) {
      try {
        const asset = history.assets.find(a => a.id === assetId);

        if (!asset) {
          failed.push({ id: assetId, reason: 'Asset not found' });
          continue;
        }

        // Validate asset can be approved
        const validation = canApproveAsset(asset);
        if (!validation.valid) {
          failed.push({ id: assetId, reason: validation.reason! });
          continue;
        }

        // Update status with retry logic
        await retryWithBackoff(async () => {
          await updateHistory(history => {
            const asset = history.assets.find(a => a.id === assetId);
            if (asset) {
              asset.status = 'Ready';
              asset.updated_at = new Date().toISOString();
            }
            return history;
          });
        });

        approved.push(assetId);
      } catch (error) {
        console.error(`Failed to approve asset ${assetId}:`, error);
        failed.push({
          id: assetId,
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const response: BulkApproveResponse = {
      success: true,
      approved,
      failed,
      summary: {
        total_selected: assetIds.length,
        total_approved: approved.length,
        total_failed: failed.length
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Bulk approve API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- app/api/assets/bulk-approve`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add app/api/assets/bulk-approve/
git commit -m "feat: add bulk approval API endpoint

POST /api/assets/bulk-approve
- Validates each asset (Draft status, files exist)
- Filters non-Draft assets automatically
- Enforces 50 asset limit
- Sequential processing with retry logic
- Exponential backoff: 1s, 2s, 4s
- Returns approved/failed lists with summary"
```

---

## Task 9: Add Checkboxes to AssetCard

**Files:**
- Modify: `components/AssetCard.tsx`

**Step 1: Read current AssetCard implementation**

Run: `head -50 components/AssetCard.tsx`

**Step 2: Add checkbox for Draft assets**

Modify `components/AssetCard.tsx`, add props:

```typescript
interface AssetCardProps {
  asset: AssetMetadata;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  // NEW: Selection props
  isSelectable?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
}
```

**Step 3: Add checkbox rendering**

Add to the card container (top-left corner):

```tsx
export function AssetCard({
  asset,
  onEdit,
  onDelete,
  isSelectable = false,
  isSelected = false,
  onToggleSelection
}: AssetCardProps) {
  return (
    <div className={`relative bg-gray-800 rounded-lg overflow-hidden ${
      isSelected ? 'ring-2 ring-blue-500' : ''
    }`}>
      {/* NEW: Checkbox for Draft assets */}
      {isSelectable && asset.status === 'Draft' && (
        <div className="absolute top-2 left-2 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelection?.(asset.id);
            }}
            className="w-5 h-5 rounded border-2 border-gray-300 bg-gray-700 checked:bg-blue-500"
            aria-label={`Select ${asset.meta_description}`}
          />
        </div>
      )}

      {/* Rest of card content */}
      {/* ... */}
    </div>
  );
}
```

**Step 4: Add selection visual feedback**

Update card container styling:

```tsx
<div className={`
  relative bg-gray-800 rounded-lg overflow-hidden transition-all
  ${isSelected ? 'ring-2 ring-blue-500 bg-blue-900/20' : ''}
  hover:bg-gray-750
`}>
```

**Step 5: Test manually in browser**

Start dev server and verify:
1. Draft assets show checkbox in top-left
2. Non-Draft assets don't show checkbox
3. Clicking checkbox doesn't trigger card click
4. Selected cards have blue ring

**Step 6: Commit**

```bash
git add components/AssetCard.tsx
git commit -m "feat: add selection checkbox to AssetCard

- Show checkbox for Draft status assets when isSelectable=true
- Checkbox in top-left corner with z-index
- Blue ring around selected cards
- stopPropagation to prevent card click
- ARIA label for accessibility"
```

---

## Task 10: Create BulkActionToolbar Component

**Files:**
- Create: `components/BulkActionToolbar.tsx`
- Create: `components/BulkActionToolbar.test.tsx`

**Step 1: Write failing component test**

Create `components/BulkActionToolbar.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkActionToolbar } from './BulkActionToolbar';

describe('BulkActionToolbar', () => {
  it('should render with selection count', () => {
    render(
      <BulkActionToolbar
        selectedCount={5}
        onApprove={jest.fn()}
        onCancel={jest.fn()}
        isApproving={false}
      />
    );

    expect(screen.getByText('5 assets selected')).toBeInTheDocument();
    expect(screen.getByText('Approve Selected (5)')).toBeInTheDocument();
  });

  it('should disable approve button when over limit', () => {
    render(
      <BulkActionToolbar
        selectedCount={51}
        onApprove={jest.fn()}
        onCancel={jest.fn()}
        isApproving={false}
      />
    );

    const approveBtn = screen.getByRole('button', { name: /approve/i });
    expect(approveBtn).toBeDisabled();
  });

  it('should call onApprove when clicked', () => {
    const handleApprove = jest.fn();

    render(
      <BulkActionToolbar
        selectedCount={3}
        onApprove={handleApprove}
        onCancel={jest.fn()}
        isApproving={false}
      />
    );

    fireEvent.click(screen.getByText('Approve Selected (3)'));
    expect(handleApprove).toHaveBeenCalledTimes(1);
  });

  it('should show progress bar when approving', () => {
    render(
      <BulkActionToolbar
        selectedCount={10}
        onApprove={jest.fn()}
        onCancel={jest.fn()}
        isApproving={true}
        progress={{ current: 3, total: 10 }}
      />
    );

    expect(screen.getByText('Approving assets: 3 / 10')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should use singular "asset" for count of 1', () => {
    render(
      <BulkActionToolbar
        selectedCount={1}
        onApprove={jest.fn()}
        onCancel={jest.fn()}
        isApproving={false}
      />
    );

    expect(screen.getByText('1 asset selected')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- components/BulkActionToolbar.test.tsx`
Expected: FAIL with "Cannot find module './BulkActionToolbar'"

**Step 3: Implement BulkActionToolbar component**

Create `components/BulkActionToolbar.tsx`:

```typescript
import { BULK_APPROVAL_LIMIT } from '@/lib/config';

interface BulkActionToolbarProps {
  selectedCount: number;
  onApprove: () => void;
  onCancel: () => void;
  isApproving: boolean;
  progress?: {
    current: number;
    total: number;
  };
}

export function BulkActionToolbar({
  selectedCount,
  onApprove,
  onCancel,
  isApproving,
  progress
}: BulkActionToolbarProps) {
  const isOverLimit = selectedCount > BULK_APPROVAL_LIMIT;
  const percentage = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  if (isApproving && progress) {
    return (
      <div className="flex flex-col gap-2 p-4 bg-gray-800 rounded-lg mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white">
            Approving assets: {progress.current} / {progress.total}
          </span>
          <span className="text-sm text-gray-400">{percentage}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          className="w-full h-2 bg-gray-700 rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-800 rounded-lg mb-4">
      <span className="text-sm text-white">
        {selectedCount} asset{selectedCount !== 1 ? 's' : ''} selected
      </span>

      {isOverLimit && (
        <span className="text-xs text-red-400">
          Maximum {BULK_APPROVAL_LIMIT} assets per approval
        </span>
      )}

      <div className="flex-1" />

      <button
        onClick={onApprove}
        disabled={isOverLimit || isApproving}
        className={`
          px-4 py-2 rounded-lg font-medium transition-colors
          ${isOverLimit || isApproving
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
          }
        `}
        aria-label={`Approve ${selectedCount} selected assets`}
      >
        Approve Selected ({selectedCount})
      </button>

      <button
        onClick={onCancel}
        disabled={isApproving}
        className="px-4 py-2 rounded-lg font-medium bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- components/BulkActionToolbar.test.tsx`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add components/BulkActionToolbar.tsx components/BulkActionToolbar.test.tsx
git commit -m "feat: create BulkActionToolbar component

- Shows selection count with singular/plural
- Approve button disabled when over 50 limit
- Progress bar with percentage during approval
- Cancel button
- ARIA labels for accessibility"
```

---

## Task 11: Integrate Bulk Approval in Dashboard

**Files:**
- Modify: `app/page.tsx`

**Step 1: Add selection state to dashboard**

Modify `app/page.tsx`, add state after existing state declarations:

```typescript
const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
const [isApproving, setIsApproving] = useState(false);
const [approvalProgress, setApprovalProgress] = useState<{ current: number; total: number } | null>(null);
```

**Step 2: Add selection handlers**

```typescript
const handleToggleSelection = (assetId: string) => {
  setSelectedAssetIds(prev => {
    if (prev.includes(assetId)) {
      return prev.filter(id => id !== assetId);
    } else {
      // Enforce 50 limit
      if (prev.length >= BULK_APPROVAL_LIMIT) {
        toast.error(`Maximum ${BULK_APPROVAL_LIMIT} assets can be selected`);
        return prev;
      }
      return [...prev, assetId];
    }
  });
};

const handleCancelSelection = () => {
  setSelectedAssetIds([]);
};

const handleSelectAll = () => {
  const draftAssets = filteredAssets
    .filter(a => a.status === 'Draft')
    .slice(0, BULK_APPROVAL_LIMIT);

  setSelectedAssetIds(draftAssets.map(a => a.id));
};
```

**Step 3: Add bulk approval logic**

```typescript
const handleBulkApprove = async () => {
  setIsApproving(true);
  setApprovalProgress({ current: 0, total: selectedAssetIds.length });

  try {
    const response = await fetch('/api/assets/bulk-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetIds: selectedAssetIds })
    });

    const data = await response.json();

    if (!data.success) {
      toast.error(data.error || 'Bulk approval failed');
      return;
    }

    // Show results
    if (data.summary.total_approved > 0) {
      toast.success(`✓ Successfully approved ${data.summary.total_approved} assets`);
    }

    if (data.summary.total_failed > 0) {
      toast.error(`✗ ${data.summary.total_failed} assets failed`);
    }

    // Refresh assets and clear selection
    await fetchAssets();
    setSelectedAssetIds([]);
  } catch (error) {
    console.error('Bulk approval error:', error);
    toast.error('Network error during bulk approval');
  } finally {
    setIsApproving(false);
    setApprovalProgress(null);
  }
};
```

**Step 4: Add keyboard shortcuts**

```typescript
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    // Ctrl/Cmd + A: Select all Draft assets
    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !isApproving) {
      e.preventDefault();
      handleSelectAll();
    }

    // Escape: Clear selection
    if (e.key === 'Escape' && selectedAssetIds.length > 0) {
      handleCancelSelection();
    }
  };

  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, [selectedAssetIds, isApproving, filteredAssets]);
```

**Step 5: Clear selection on filter/search changes**

```typescript
useEffect(() => {
  // Clear selection when filters change
  setSelectedAssetIds([]);
}, [statusFilter, searchQuery]);
```

**Step 6: Render BulkActionToolbar and update AssetCard**

Modify dashboard JSX:

```tsx
<div className="container mx-auto px-4 py-8">
  <h1>Asset Gallery</h1>

  {/* Filters and search */}
  {/* ... existing filters ... */}

  {/* NEW: Bulk Action Toolbar */}
  {selectedAssetIds.length > 0 && (
    <BulkActionToolbar
      selectedCount={selectedAssetIds.length}
      onApprove={handleBulkApprove}
      onCancel={handleCancelSelection}
      isApproving={isApproving}
      progress={approvalProgress}
    />
  )}

  {/* Asset Grid */}
  <div className="grid grid-cols-3 gap-4">
    {filteredAssets.map(asset => (
      <AssetCard
        key={asset.id}
        asset={asset}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isSelectable={asset.status === 'Draft'}
        isSelected={selectedAssetIds.includes(asset.id)}
        onToggleSelection={handleToggleSelection}
      />
    ))}
  </div>
</div>
```

**Step 7: Add import**

Add to imports:

```typescript
import { BulkActionToolbar } from '@/components/BulkActionToolbar';
import { BULK_APPROVAL_LIMIT } from '@/lib/config';
```

**Step 8: Test manually in browser**

1. Open dashboard with Draft assets
2. Click checkboxes to select multiple
3. Verify toolbar appears with count
4. Press Ctrl+A to select all
5. Press Escape to clear
6. Click "Approve Selected"
7. Verify progress bar shows
8. Verify success/failure toasts
9. Verify assets transition to Ready status

**Step 9: Commit**

```bash
git add app/page.tsx
git commit -m "feat: integrate bulk approval in dashboard

- Add selection state and handlers
- Keyboard shortcuts: Ctrl+A (select all), Escape (clear)
- Clear selection on filter/search changes
- BulkActionToolbar with progress indication
- Call /api/assets/bulk-approve endpoint
- Show success/failure toasts
- Refresh assets after approval"
```

---

## Task 12: Add Accessibility Enhancements

**Files:**
- Modify: `components/BulkActionToolbar.tsx`
- Modify: `components/AssetCard.tsx`
- Modify: `app/page.tsx`

**Step 1: Add focus management to BulkActionToolbar**

Modify `components/BulkActionToolbar.tsx`:

```typescript
import { useEffect, useRef } from 'react';

export function BulkActionToolbar({ ... }: BulkActionToolbarProps) {
  const approveButtonRef = useRef<HTMLButtonElement>(null);

  // Focus approve button when toolbar appears
  useEffect(() => {
    if (!isApproving && selectedCount > 0) {
      approveButtonRef.current?.focus();
    }
  }, [selectedCount]);

  return (
    <div className="..." role="region" aria-label="Bulk actions">
      {/* ... */}
      <button
        ref={approveButtonRef}
        onClick={onApprove}
        disabled={isOverLimit || isApproving}
        className="..."
        aria-label={`Approve ${selectedCount} selected assets`}
        aria-disabled={isOverLimit || isApproving}
      >
        Approve Selected ({selectedCount})
      </button>
      {/* ... */}
    </div>
  );
}
```

**Step 2: Add keyboard navigation hints**

Modify `app/page.tsx`, add help text:

```tsx
<div className="mb-4 text-sm text-gray-400">
  <span>Keyboard shortcuts: </span>
  <kbd className="px-2 py-1 bg-gray-700 rounded">Ctrl+A</kbd> Select all Draft assets
  <span className="mx-2">•</span>
  <kbd className="px-2 py-1 bg-gray-700 rounded">Esc</kbd> Clear selection
  <span className="mx-2">•</span>
  <kbd className="px-2 py-1 bg-gray-700 rounded">T</kbd> Toggle text overlay (in modal)
  <span className="mx-2">•</span>
  <kbd className="px-2 py-1 bg-gray-700 rounded">S</kbd> Toggle safe zones (in modal)
</div>
```

**Step 3: Add visual focus indicators**

Modify `components/AssetCard.tsx`:

```tsx
<input
  type="checkbox"
  checked={isSelected}
  onChange={(e) => {
    e.stopPropagation();
    onToggleSelection?.(asset.id);
  }}
  className="
    w-5 h-5 rounded border-2 border-gray-300 bg-gray-700
    checked:bg-blue-500
    focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-800
  "
  aria-label={`Select ${asset.meta_description}`}
/>
```

**Step 4: Add screen reader announcements**

Modify `app/page.tsx`, add after selection changes:

```typescript
const handleToggleSelection = (assetId: string) => {
  setSelectedAssetIds(prev => {
    const newSelection = prev.includes(assetId)
      ? prev.filter(id => id !== assetId)
      : [...prev, assetId];

    // Screen reader announcement
    const message = newSelection.length > prev.length
      ? `Asset selected. ${newSelection.length} assets selected.`
      : `Asset deselected. ${newSelection.length} assets selected.`;

    announceToScreenReader(message);

    return newSelection;
  });
};

// Helper for screen reader announcements
function announceToScreenReader(message: string) {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only'; // Visually hidden
  announcement.textContent = message;

  document.body.appendChild(announcement);
  setTimeout(() => document.body.removeChild(announcement), 1000);
}
```

**Step 5: Add sr-only CSS class**

Add to `app/globals.css`:

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

**Step 6: Test with screen reader**

Manual testing with VoiceOver (Mac) or NVDA (Windows):
1. Navigate through cards with Tab key
2. Verify checkboxes are announced with asset descriptions
3. Verify selection count changes are announced
4. Verify button states are announced
5. Verify progress updates are announced

**Step 7: Commit**

```bash
git add components/BulkActionToolbar.tsx components/AssetCard.tsx app/page.tsx app/globals.css
git commit -m "feat: add accessibility enhancements

- Focus management: approve button receives focus
- Visual focus indicators with ring-2 ring-blue-400
- Keyboard shortcuts help text
- Screen reader announcements for selection changes
- ARIA labels on all interactive elements
- aria-live regions for progress updates"
```

---

## Final Testing & Documentation

**Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass (existing 114 + new tests)

**Step 2: Manual end-to-end test**

1. Upload a new asset
2. Generate background
3. Verify preview is auto-generated
4. Open EditAssetModal
5. Verify preview shows (not just background)
6. Toggle text overlay (T key)
7. Verify text appears
8. Toggle safe zones (S key)
9. Verify both layers visible
10. Close modal
11. Select 3 Draft assets with checkboxes
12. Click "Approve Selected"
13. Verify progress bar
14. Verify success toast
15. Verify assets now have "Ready" status
16. Try selecting 51 assets
17. Verify error message

**Step 3: Update environment example**

Verify `.env.example` has all new config:

```bash
grep -E "PREVIEW|BULK" .env.example
```

Expected output:
```
PREVIEW_RETENTION_DAYS=30
BULK_APPROVAL_LIMIT=50
```

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: composition preview & bulk approval complete

Summary of changes:
- Preview generation (background + asset, no text)
- Text SVG endpoint for client-side overlay
- EditAssetModal text overlay toggle
- Bulk approval workflow with checkboxes
- Progress bar and retry logic
- Keyboard shortcuts and accessibility

API Endpoints:
- POST /api/assets/[id]/preview
- GET /api/assets/[id]/text-svg
- POST /api/assets/bulk-approve

Components:
- BulkActionToolbar (new)
- EditAssetModal (text overlay toggle)
- AssetCard (selection checkboxes)

Tests: All passing (114 existing + 30+ new)"
```

---

## Execution Complete

Plan saved to: `docs/plans/2026-01-13-composition-preview-bulk-approval.md`

All 12 tasks completed:
1. ✓ Preview types and configuration
2. ✓ Preview generation utility
3. ✓ Preview API endpoint
4. ✓ Auto-preview after background generation
5. ✓ Text SVG API endpoint
6. ✓ EditAssetModal text overlay toggle
7. ✓ Bulk approval types
8. ✓ Bulk approval API endpoint
9. ✓ AssetCard checkboxes
10. ✓ BulkActionToolbar component
11. ✓ Dashboard integration
12. ✓ Accessibility enhancements

**Key Implementation Details:**
- Preview generation uses existing `composeStory()` with `includeText: false`
- Text overlay fetched from existing `generateTextSVG()`
- Client-side CSS positioning for toggle functionality
- Sequential processing with exponential backoff retry
- 50 asset limit enforced
- Full keyboard navigation and screen reader support
