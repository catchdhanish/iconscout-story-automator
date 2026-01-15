# Task 4: Manual Testing Guide - Preview Generation Error Banner

## Test Objective
Verify that the error banner appears correctly when preview generation fails.

## Prerequisites
- Development server running (`npm run dev`)
- At least one asset in the system with a generated background

## Test Steps

### 1. Force Preview Generation Failure

Edit `lib/preview.ts` and add a test error at line 68 (start of generatePreview function):

```typescript
export async function generatePreview(
  assetId: string,
  version: number
): Promise<PreviewResult> {
  throw new Error('Test failure'); // ADD THIS LINE FOR TESTING
  const startTime = Date.now();
  // ... rest of function
```

### 2. Trigger Preview Generation

1. Navigate to the dashboard (`http://localhost:3000`)
2. Find an asset with status "Draft" or "Ready"
3. Click on the asset to open the Asset Details modal
4. Enter a refinement prompt (e.g., "Make it more vibrant")
5. Click "Regenerate Background"
6. Wait for the background generation to complete

### 3. Verify Error Banner

1. The Asset Details modal should remain open
2. Look at the preview image area
3. You should see a **yellow warning banner** at the top of the preview with:
   - A warning triangle icon (⚠)
   - Text: "Preview generation failed. Showing background only."
   - Yellow background with semi-transparency (yellow-500/90)
   - Black text
   - Shadow effect for visibility

### 4. Verify Banner Positioning

- Banner should span almost full width of the preview (with small margins)
- Banner should be at the top of the preview image
- Banner should NOT overlap with the "Generating preview..." indicator (which appears at top-right)

### 5. Verify Fallback Behavior

- The preview image shown should be the background image only
- No text overlay should be visible
- The regenerate preview button (🔄) should be available

### 6. Clean Up

Remove the test error line from `lib/preview.ts`:

```typescript
export async function generatePreview(
  assetId: string,
  version: number
): Promise<PreviewResult> {
  // throw new Error('Test failure'); // REMOVE THIS LINE
  const startTime = Date.now();
  // ... rest of function
```

## Expected Results

✅ Yellow warning banner appears at top of preview
✅ Banner contains warning icon and descriptive text
✅ Banner does not overlap with loading indicator
✅ Preview shows background image (fallback)
✅ User can still use regenerate preview button
✅ Banner is clearly visible with good contrast

## Edge Cases to Consider

1. **Banner and Loading Indicator**: These should never appear together
   - Loading indicator shows when preview_file_path is undefined
   - Error banner shows when preview_generation_failed is true
   - They are mutually exclusive states

2. **Multiple Failed Attempts**: If preview regeneration is clicked again and fails again, the banner should persist

3. **Successful Regeneration After Failure**: If preview is successfully regenerated, the banner should disappear

## Notes

- The `preview_generation_failed` flag is set in `lib/preview.ts` when generation fails
- This flag is stored in the version metadata in `history.json`
- The error banner uses the same yellow color scheme as the loading indicator for consistency
