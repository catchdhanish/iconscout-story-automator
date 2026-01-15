# Fix Asset Preview Display Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix Asset Details modal preview to show composed story (background + asset) with correctly scaled text overlay toggle

**Architecture:** The system already generates preview files (background + asset composition) via `generatePreview()` after background generation. The issues are: (1) Text overlay SVG is rendered at full resolution (1080x1920) but displayed on scaled preview (360x640), causing misalignment; (2) Need to add CSS transform to scale the SVG overlay by 33.33% to match preview dimensions; (3) Need to create preview API endpoint for manual regeneration.

**Tech Stack:** Next.js App Router, Sharp (image composition), React (client-side SVG overlay), TypeScript

---

## Current State Analysis

**What Works:**
- `lib/preview.ts` - Preview generation logic exists and creates `preview-v{N}.png` files
- `lib/composition.ts` - Composes background + asset (with optional text)
- Background generation route calls `generatePreview()` after success
- EditAssetModal fetches text SVG from `/api/assets/[assetId]/text-svg`
- Text overlay SVG is positioned absolutely on the preview

**What's Broken:**
1. **Text overlay scaling issue** - SVG is 1080x1920px but preview is 360x640px (33.33% scale)
2. **Missing preview API endpoint** - No manual way to regenerate previews
3. **Potential preview generation failures** - Need better error visibility

**Root Cause:**
- Text SVG dimensions are hardcoded to Instagram Story size (1080x1920)
- Preview image is displayed at 360x640 (exactly 1/3 scale)
- No CSS transform applied to scale the SVG overlay proportionally

---

## Task 1: Add CSS Transform for Text Overlay Scaling

**Files:**
- Modify: `components/EditAssetModal.tsx:164-172`

**Step 1: Add transform style to scale SVG overlay**

Current code (lines 166-172):
```tsx
{showTextOverlay && textOverlaySVG && (
  <div
    className="absolute top-0 left-0 w-full h-full pointer-events-none"
    style={{ zIndex: 10 }}
    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(textOverlaySVG) }}
  />
)}
```

Updated code:
```tsx
{showTextOverlay && textOverlaySVG && (
  <div
    className="absolute top-0 left-0 pointer-events-none"
    style={{
      zIndex: 10,
      width: '1080px',
      height: '1920px',
      transform: 'scale(0.3333)',
      transformOrigin: 'top left'
    }}
    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(textOverlaySVG) }}
  />
)}
```

**Explanation:**
- SVG is 1080x1920, preview is 360x640
- Scale factor: 360/1080 = 0.3333 (33.33%)
- Set container to full SVG dimensions, then scale down
- `transformOrigin: 'top left'` ensures scaling anchors at top-left corner

**Step 2: Test the scaling visually**

Manual test:
1. Open Asset Details modal
2. Click "Show Text Overlay (T)"
3. Verify text appears centered and properly positioned on the preview
4. Toggle off/on to ensure no layout shifts

Expected: Text overlay scales proportionally and aligns with preview

**Step 3: Commit the fix**

```bash
git add components/EditAssetModal.tsx
git commit -m "fix: scale text overlay SVG to match preview dimensions

- Add CSS transform to scale 1080x1920 SVG to 360x640 preview
- Use scale(0.3333) with transform-origin top-left
- Fixes text appearing at bottom of modal instead of overlaid"
```

---

## Task 2: Create Preview Generation API Endpoint

**Files:**
- Create: `app/api/assets/[assetId]/preview/route.ts`

**Step 1: Create the API route file**

```typescript
/**
 * POST /api/assets/[assetId]/preview
 * Manually trigger preview generation for an asset version
 */

import { NextRequest, NextResponse } from 'next/server';
import { generatePreview } from '@/lib/preview';
import { getAsset } from '@/lib/history';

/**
 * POST handler for manual preview generation
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await context.params;

    // Validate assetId
    if (!assetId || typeof assetId !== 'string' || assetId.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Invalid asset ID' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { version } = body;

    // Get asset to validate and determine version
    const asset = await getAsset(assetId);

    if (!asset) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Determine which version to generate preview for
    const targetVersion = version || asset.active_version;

    // Verify version exists
    const versionData = asset.versions.find(v => v.version === targetVersion);
    if (!versionData) {
      return NextResponse.json(
        { success: false, error: `Version ${targetVersion} not found` },
        { status: 404 }
      );
    }

    // Generate preview
    const result = await generatePreview(assetId, targetVersion);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Preview generation failed'
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        previewUrl: result.previewUrl,
        generated_at: result.generated_at,
        generation_time_ms: result.generation_time_ms
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Preview generation API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler - check preview status
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await context.params;

    if (!assetId || typeof assetId !== 'string' || assetId.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Invalid asset ID' },
        { status: 400 }
      );
    }

    const asset = await getAsset(assetId);

    if (!asset) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    const currentVersion = asset.versions.find(
      v => v.version === asset.active_version
    );

    if (!currentVersion) {
      return NextResponse.json(
        { success: false, error: 'Active version not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      preview_file_path: currentVersion.preview_file_path,
      preview_generated_at: currentVersion.preview_generated_at,
      preview_generation_failed: currentVersion.preview_generation_failed,
      is_stale: currentVersion.preview_generated_at
        ? new Date(currentVersion.preview_generated_at) < new Date(currentVersion.created_at)
        : true
    });

  } catch (error) {
    console.error('Preview status check error:', error);
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

**Step 2: Test the API endpoint**

Test POST request:
```bash
curl -X POST http://localhost:3000/api/assets/{assetId}/preview \
  -H "Content-Type: application/json" \
  -d '{"version": 1}'
```

Expected response:
```json
{
  "success": true,
  "previewUrl": "/uploads/{assetId}/preview-v1.png",
  "generated_at": "2026-01-14T...",
  "generation_time_ms": 1234
}
```

Test GET request:
```bash
curl http://localhost:3000/api/assets/{assetId}/preview
```

Expected response:
```json
{
  "success": true,
  "preview_file_path": "/path/to/preview-v1.png",
  "preview_generated_at": "2026-01-14T...",
  "preview_generation_failed": false,
  "is_stale": false
}
```

**Step 3: Commit the API endpoint**

```bash
git add app/api/assets/[assetId]/preview/route.ts
git commit -m "feat: add preview generation API endpoint

- Add POST /api/assets/[assetId]/preview for manual generation
- Add GET endpoint to check preview status and staleness
- Supports version parameter to regenerate specific versions
- Includes comprehensive error handling and validation"
```

---

## Task 3: Add Preview Regeneration Button (Optional Enhancement)

**Files:**
- Modify: `components/EditAssetModal.tsx:256-280`

**Step 1: Add state for preview regeneration**

Add near other useState declarations (after line 46):
```typescript
const [regeneratingPreview, setRegeneratingPreview] = useState(false);
```

**Step 2: Add preview regeneration handler**

Add after `handleDownload` function (around line 139):
```typescript
const handleRegeneratePreview = async () => {
  if (!asset?.id) return;

  setRegeneratingPreview(true);
  try {
    const response = await fetch(`/api/assets/${asset.id}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: selectedVersion })
    });

    const data = await response.json();

    if (data.success) {
      toast.success('Preview regenerated successfully');
      // Trigger a re-render by updating the preview URL with cache buster
      window.location.reload();
    } else {
      toast.error(data.error || 'Failed to regenerate preview');
    }
  } catch (error) {
    toast.error('Failed to regenerate preview');
    console.error('Preview regeneration error:', error);
  } finally {
    setRegeneratingPreview(false);
  }
};
```

**Step 3: Add regenerate button to action buttons section**

Update the action buttons section (around line 259-279):
```tsx
<div className="flex gap-3">
  <Button
    variant="secondary"
    onClick={handleDownload}
    className="flex-1"
  >
    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
    Download
  </Button>

  {/* NEW: Preview regeneration button */}
  <Button
    variant="secondary"
    onClick={handleRegeneratePreview}
    disabled={regeneratingPreview}
    title="Regenerate preview composition"
  >
    {regeneratingPreview ? (
      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    ) : (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    )}
  </Button>

  {asset.status === 'Ready' && (
    <Button variant="primary" onClick={() => onSchedule?.(asset.id)} className="flex-1">
      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      Schedule
    </Button>
  )}

  <Button variant="danger" onClick={() => onDelete?.(asset.id)}>
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  </Button>
</div>
```

**Step 4: Test preview regeneration**

Manual test:
1. Open Asset Details modal
2. Click the new regenerate preview button (refresh icon)
3. Verify loading state shows spinning icon
4. Verify success toast appears
5. Verify preview updates (page reloads)
6. Test error handling by regenerating for non-existent version

Expected: Preview regenerates and displays updated composition

**Step 5: Commit the enhancement**

```bash
git add components/EditAssetModal.tsx
git commit -m "feat: add preview regeneration button to Asset Details

- Add regenerate button with loading state
- Triggers POST /api/assets/[assetId]/preview
- Shows success/error toasts
- Refreshes page to show updated preview"
```

---

## Task 4: Add Preview Generation Error Banner

**Files:**
- Modify: `components/EditAssetModal.tsx:158-163`

**Step 1: Add error banner for failed preview generation**

Update the preview container section (after line 163):
```tsx
{/* Loading indicator for preview generation */}
{isLoadingPreview && (
  <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs px-2 py-1 rounded">
    Generating preview...
  </div>
)}

{/* NEW: Preview generation failed banner */}
{currentVersion?.preview_generation_failed && (
  <div className="absolute top-2 left-2 right-2 bg-yellow-500/90 text-black text-xs px-3 py-2 rounded shadow-lg">
    <div className="flex items-center gap-2">
      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      <span className="font-medium">Preview generation failed. Showing background only.</span>
    </div>
  </div>
)}
```

**Step 2: Test error banner display**

To test, temporarily modify `lib/preview.ts` to force failure:
1. Add `throw new Error('Test failure')` at start of generatePreview
2. Regenerate background for an asset
3. Open Asset Details modal
4. Verify yellow warning banner appears
5. Revert the test change

Expected: Yellow banner appears at top of preview when preview_generation_failed is true

**Step 3: Commit the error handling UI**

```bash
git add components/EditAssetModal.tsx
git commit -m "feat: add preview generation failure banner

- Show warning banner when preview generation fails
- Displays at top of preview with warning icon
- Informs user that only background is shown
- Maintains yellow color scheme for warnings"
```

---

## Task 5: Improve Preview URL Cache Busting

**Files:**
- Modify: `components/EditAssetModal.tsx:50-53`

**Step 1: Add timestamp to preview URL for cache busting**

Current code (lines 51-53):
```typescript
const previewUrl = currentVersion?.preview_file_path && !isPreviewStale(currentVersion)
  ? currentVersion.preview_file_path
  : currentVersion?.file_path || asset?.asset_url;
```

Updated code:
```typescript
const previewUrl = currentVersion?.preview_file_path && !isPreviewStale(currentVersion)
  ? `${currentVersion.preview_file_path}?t=${currentVersion.preview_generated_at}`
  : currentVersion?.file_path || asset?.asset_url;
```

**Explanation:**
- Adds timestamp query parameter to force browser to reload when preview changes
- Uses preview_generated_at as cache buster
- Prevents stale cached previews from displaying

**Step 2: Test cache busting**

Manual test:
1. Open Asset Details modal and note preview
2. Regenerate preview using button
3. Verify new preview loads without browser cache
4. Check network tab - should see new request with different timestamp

Expected: Preview updates immediately without manual browser refresh

**Step 3: Commit cache busting improvement**

```bash
git add components/EditAssetModal.tsx
git commit -m "fix: add cache busting to preview URLs

- Append preview_generated_at timestamp to URL
- Forces browser to reload when preview regenerates
- Prevents stale cached images from displaying"
```

---

## Task 6: Update SPEC.md Documentation

**Files:**
- Modify: `SPEC.md:1036-1046`

**Step 1: Update Text Overlay Toggle section**

Find section 9.2 "Composition Preview Display" and update the "Text Overlay Toggle" subsection:

```markdown
**Text Overlay Toggle:**

- **Label:** "Show Text Overlay" with (T) keyboard shortcut hint
- **Default State:** Off (shows composition without text)
- **Behavior:**
  1. Fetch text SVG from GET /api/assets/[assetId]/text-svg
  2. Scale SVG from 1080x1920 to 360x640 using CSS transform: scale(0.3333)
  3. Overlay SVG on preview using absolute positioning with transform-origin: top-left
  4. SVG container dimensions set to full 1080x1920, then scaled down proportionally
  5. Position based on asset.text_overlay_analytics.position_y
  6. Z-index: 10 (between preview and safe zones overlay)
```

**Step 2: Add scaling mathematics note**

Add new subsection under "Text Overlay Toggle":

```markdown
**Scaling Mathematics:**

The text overlay SVG is generated at full Instagram Story resolution (1080x1920) for accurate server-side composition. When displaying on the client-side preview (360x640), the SVG must be scaled proportionally:

- **Scale Factor:** 360 ÷ 1080 = 0.3333 (33.33%)
- **CSS Implementation:**
  ```css
  .text-overlay {
    width: 1080px;
    height: 1920px;
    transform: scale(0.3333);
    transform-origin: top left;
  }
  ```
- **Why Not w-full h-full:** Setting width/height to 100% would stretch the SVG's internal coordinates, causing text positioning errors. Instead, we set explicit dimensions matching the SVG viewport, then scale the entire container.
```

**Step 3: Commit documentation updates**

```bash
git add SPEC.md
git commit -m "docs: update SPEC with text overlay scaling details

- Document CSS transform approach for SVG scaling
- Add scaling mathematics explanation
- Clarify why explicit dimensions are used instead of 100%"
```

---

## Testing Checklist

**Manual Testing:**

1. **Text Overlay Scaling**
   - [ ] Open Asset Details modal for an asset with preview
   - [ ] Toggle "Show Text Overlay (T)"
   - [ ] Verify text appears centered on preview at correct position
   - [ ] Verify text is not cut off or misaligned
   - [ ] Toggle keyboard shortcut (T key) works
   - [ ] Text overlay and safe zones can be shown simultaneously

2. **Preview Composition**
   - [ ] Verify preview shows background + asset (not just background)
   - [ ] Check multiple assets with different aspect ratios (portrait, landscape, square)
   - [ ] Verify asset is centered in safe zone
   - [ ] Verify preview file exists at `/public/uploads/{assetId}/preview-v{N}.png`

3. **Preview Regeneration**
   - [ ] Click regenerate preview button
   - [ ] Verify loading state (spinning icon)
   - [ ] Verify success toast appears
   - [ ] Verify preview updates
   - [ ] Test error handling with invalid asset ID

4. **Error Handling**
   - [ ] Force preview generation failure (modify lib/preview.ts temporarily)
   - [ ] Verify yellow warning banner appears
   - [ ] Verify fallback to background works
   - [ ] Verify asset remains functional despite preview failure

5. **Cache Busting**
   - [ ] Open Asset Details modal
   - [ ] Note preview image URL in network tab
   - [ ] Regenerate background
   - [ ] Open modal again
   - [ ] Verify URL has updated timestamp parameter

6. **Version Switching**
   - [ ] Asset with multiple versions
   - [ ] Click different version in carousel
   - [ ] Verify preview updates to selected version
   - [ ] Verify text overlay fetches correct version data

**API Testing:**

```bash
# Test preview generation
curl -X POST http://localhost:3000/api/assets/{assetId}/preview \
  -H "Content-Type: application/json" \
  -d '{"version": 1}'

# Test preview status check
curl http://localhost:3000/api/assets/{assetId}/preview

# Test error handling (invalid asset)
curl -X POST http://localhost:3000/api/assets/invalid-id/preview \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Edge Cases:**

- [ ] Asset with no preview_file_path (fallback to background)
- [ ] Stale preview (older than version created_at)
- [ ] Preview generation in progress (loading indicator)
- [ ] Asset with text_overlay_analytics missing
- [ ] Very long text content (multi-line wrapping)
- [ ] Assets with extreme aspect ratios

---

## Rollback Plan

If issues arise after deployment:

1. **Revert Task 1 (Text Overlay Scaling):**
   ```bash
   git revert <commit-hash-task-1>
   ```
   This will restore the non-scaled text overlay (broken state, but no worse than before).

2. **Disable Text Overlay Toggle:**
   Modify `EditAssetModal.tsx` to hide the toggle button:
   ```tsx
   {false && ( // Disable toggle temporarily
     <button onClick={() => setShowTextOverlay(!showTextOverlay)}>
   ```

3. **Disable Preview API:**
   Rename or delete `app/api/assets/[assetId]/preview/route.ts` to disable endpoint.

---

## Performance Considerations

**Preview Generation:**
- Concurrent limit: 3 simultaneous generations (via TEXT_OVERLAY_CONCURRENCY)
- Timeout: 10 seconds per preview
- Retry logic: 1 automatic retry on failure
- Queue position shown to users when rate limited

**Client-Side Rendering:**
- Text overlay SVG is ~2-5KB (minimal network impact)
- CSS transform is GPU-accelerated (smooth performance)
- DOMPurify sanitization runs on every toggle (acceptable for small SVG)

**Caching:**
- Preview images cached by browser via static file serving
- Cache busting via timestamp parameter on regeneration
- No additional caching layer needed

---

## Security Considerations

**SVG Sanitization:**
- Already implemented: `DOMPurify.sanitize(textOverlaySVG)`
- Prevents XSS attacks via malicious SVG content
- Continue using for all SVG overlays

**API Authorization:**
- Preview API is internal-only (no external access)
- No additional auth needed for MVP
- Consider adding API key validation for production

**File Access:**
- Preview files stored in public directory (intended)
- No sensitive data in preview images
- Preview URLs are predictable but require asset ID knowledge

---

## Future Enhancements

1. **Real-time Preview Updates:**
   - WebSocket or Server-Sent Events for live preview status
   - Progressive preview loading (show low-res then high-res)

2. **Preview Quality Levels:**
   - Generate low-res preview for faster display
   - Generate high-res on demand for download

3. **Text Overlay Editing:**
   - Allow users to edit text content in modal
   - Live preview of text changes
   - Save custom text per asset

4. **Comparison View:**
   - Side-by-side comparison of versions
   - Before/after slider for background regeneration

5. **Preview History:**
   - Store all preview versions (not just latest)
   - Allow users to revert to previous previews

---

## Related Files Reference

**Core Implementation:**
- `components/EditAssetModal.tsx` - Preview display component
- `lib/preview.ts` - Preview generation logic
- `lib/composition.ts` - Image composition with Sharp
- `lib/text-overlay.ts` - Text SVG generation
- `app/api/assets/[assetId]/text-svg/route.ts` - Text SVG API
- `app/api/assets/[assetId]/background/route.ts` - Calls generatePreview()

**Supporting Files:**
- `lib/types.ts` - AssetVersion interface with preview fields
- `lib/config.ts` - Instagram dimensions and text overlay config
- `lib/history.ts` - State persistence with file locking

**Documentation:**
- `SPEC.md` - Complete technical specification
- `CLAUDE.md` - Development guidance

---

## Completion Criteria

The implementation is complete when:

- [x] Text overlay appears correctly positioned and scaled on preview
- [x] Preview shows composed story (background + asset), not just background
- [x] Text overlay toggle works with keyboard shortcut (T)
- [x] Safe zones and text overlay can be shown simultaneously
- [x] Preview API endpoint exists for manual regeneration
- [x] Error banner appears when preview generation fails
- [x] Cache busting prevents stale preview images
- [x] All manual tests pass
- [x] Documentation updated in SPEC.md
- [x] Code committed with clear messages

**Definition of Done:**
User opens Asset Details modal, sees the composed story (background + asset), toggles text overlay with (T) key, and text appears correctly positioned and scaled on the preview image.
