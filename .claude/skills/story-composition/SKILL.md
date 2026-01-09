---
name: story-composition
description: Provides Instagram Story composition with Sharp library, encoding exact safe zone mathematics (top 250px, bottom 180px, center 70% asset zone) and 3-layer composition patterns. Use when composing Instagram stories, calculating safe zones, scaling assets, layering backgrounds and assets, working with Sharp image processing, or implementing Instagram Story dimensions (1080x1920). Includes aspect ratio calculations and centering logic for the IconScout Story Automator.
allowed-tools: Read, Bash, Edit, Write
---

# Instagram Story Composition with Sharp

Provides mathematical precision for Instagram Story composition using the Sharp library. Ensures consistent safe zones, aspect ratio calculations, and proper 3-layer composition.

## Quick Reference: Safe Zone Constants

```typescript
const INSTAGRAM_STORY = {
  WIDTH: 1080,
  HEIGHT: 1920,
  ASPECT_RATIO: 9 / 16,

  SAFE_ZONES: {
    TOP: 250,      // Profile, timestamp
    BOTTOM: 180    // Interaction buttons
  },

  ASSET_ZONE: {
    WIDTH: 756,      // 70% of 1080
    HEIGHT: 1344,    // 70% of 1920
    X_OFFSET: 162,   // (1080 - 756) / 2
    Y_OFFSET: 288    // (1920 - 1344) / 2
  }
};
```

## Core Capabilities

1. **Safe Zone Calculations** - Exact Instagram Story UI safe zones
2. **Asset Scaling** - Preserve aspect ratio while fitting within safe zone
3. **Composition** - Layer background + asset using Sharp
4. **Centering** - Precise centering within asset safe zone
5. **Batch Processing** - Compose multiple stories efficiently

## When This Skill Triggers

- Composing Instagram stories
- Calculating safe zone coordinates
- Scaling assets for stories
- Layering backgrounds and assets
- Working with Sharp image processing
- Implementing Instagram Story dimensions
- Centering assets within safe zones

## Instagram Story Specifications

### Canvas Dimensions

- **Resolution**: 1080x1920 pixels
- **Aspect Ratio**: 9:16 (portrait)
- **Format**: PNG (recommended) or JPG

### Safe Zones

Instagram overlays UI elements on stories. Avoid placing critical content in these areas:

**Top Safe Zone: 250px**
- Profile picture
- Account name
- Timestamp
- Top 13% of canvas

**Bottom Safe Zone: 180px**
- Interaction buttons (reply, share, etc.)
- Swipe-up area
- Bottom 9% of canvas

**Asset Safe Zone: Center 70%**
- Width: 756px (70% of 1080)
- Height: 1344px (70% of 1920)
- X Offset: 162px
- Y Offset: 288px
- Total safe area: 756x1344 pixels for main asset

### Visual Reference

```
┌─────────────── 1080px ───────────────┐
│           Top Safe Zone               │ ← 250px (Profile, Timestamp)
├──────────────────────────────────────┤
│                                       │
│     ┌─── Asset Safe Zone ───┐        │
│     │                        │        │
│     │     756 x 1344px       │        │ ← 1920px total
│     │                        │        │
│     │  (Center 70% of        │        │
│     │   canvas for asset)    │        │
│     │                        │        │
│     └────────────────────────┘        │
│                                       │
├──────────────────────────────────────┤
│         Bottom Safe Zone              │ ← 180px (Interaction buttons)
└───────────────────────────────────────┘
```

## Composition Layers

Instagram Story composition uses a 2-layer sandwich:

1. **Background Layer**: AI-generated 1080x1920px image
2. **Asset Layer**: Scaled to fit within 756x1344px safe zone

**Note**: Logo overlay NOT needed - Instagram displays profile logo automatically in the top-left corner.

## Asset Scaling Logic

### Decision Tree

**Input**: Asset dimensions (width x height)
**Output**: Scaled dimensions + position (x, y)

```
Asset Aspect Ratio = Asset Width / Asset Height
Safe Zone Aspect Ratio = 756 / 1344 ≈ 0.5625

IF Asset Aspect Ratio > Safe Zone Aspect Ratio:
    → Landscape asset → Scale by WIDTH
    Scaled Width = 756px
    Scaled Height = 756 / Asset Aspect Ratio

ELSE:
    → Portrait or Square asset → Scale by HEIGHT
    Scaled Height = 1344px
    Scaled Width = 1344 * Asset Aspect Ratio

Center within safe zone:
X = 162 + (756 - Scaled Width) / 2
Y = 288 + (1344 - Scaled Height) / 2
```

### Examples

**Landscape Asset (1200x800)**:
- Aspect Ratio: 1.5
- Scale by width: 756px
- Scaled Height: 756 / 1.5 = 504px
- Position: X = 162, Y = 288 + (1344-504)/2 = 708

**Portrait Asset (600x1000)**:
- Aspect Ratio: 0.6
- Scale by height: 1344px
- Scaled Width: 1344 * 0.6 = 806.4px → Clamp to 756px
- Recalculate: Scale by width instead
- Position: X = 162, Y = centered

**Square Asset (800x800)**:
- Aspect Ratio: 1.0
- Scale by height: 1344px
- Scaled Width: 1344px → Exceeds 756px → Scale by width
- Final: 756x756px at X=162, Y=582

## Sharp Composition Pattern

### Basic Composition

```typescript
import sharp from 'sharp';

async function composeStory(
  backgroundPath: string,
  assetPath: string,
  outputPath: string
): Promise<void> {
  // 1. Load and get asset metadata
  const assetMetadata = await sharp(assetPath).metadata();
  const assetWidth = assetMetadata.width!;
  const assetHeight = assetMetadata.height!;

  // 2. Calculate scaled dimensions
  const { width, height, x, y } = calculateAssetDimensions(
    assetWidth,
    assetHeight
  );

  // 3. Resize asset to calculated dimensions
  const scaledAsset = await sharp(assetPath)
    .resize(width, height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toBuffer();

  // 4. Composite asset onto background
  await sharp(backgroundPath)
    .composite([
      {
        input: scaledAsset,
        top: y,
        left: x
      }
    ])
    .toFile(outputPath);
}
```

### With Transparency Handling

```typescript
// PNG assets with transparency
const scaledAsset = await sharp(assetPath)
  .resize(width, height, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 } // Preserve transparency
  })
  .png({ compressionLevel: 9 })
  .toBuffer();

// Ensure background is opaque
await sharp(backgroundPath)
  .flatten({ background: '#FFFFFF' }) // Fill transparency with white
  .composite([{ input: scaledAsset, top: y, left: x }])
  .png()
  .toFile(outputPath);
```

### SVG Asset Handling

```typescript
// Rasterize SVG at 2x resolution
if (assetPath.endsWith('.svg')) {
  const svgBuffer = await sharp(assetPath)
    .resize(assetWidth * 2, assetHeight * 2) // 2x for quality
    .png()
    .toBuffer();

  // Continue with PNG buffer
  assetPath = svgBuffer;
}
```

## Utilities

### Safe Zone Calculations

**Available in**: `lib/safe-zones.ts`

```typescript
export function getAssetSafeZone() {
  return {
    x: 162,
    y: 288,
    width: 756,
    height: 1344
  };
}

export function isInSafeZone(x: number, y: number, width: number, height: number): boolean {
  const zone = getAssetSafeZone();
  return (
    x >= zone.x &&
    y >= zone.y &&
    x + width <= zone.x + zone.width &&
    y + height <= zone.y + zone.height
  );
}
```

### Asset Scaling

**Available in**: `lib/asset-scaler.ts`

```typescript
export function calculateAssetDimensions(
  assetWidth: number,
  assetHeight: number
): {
  width: number;
  height: number;
  x: number;
  y: number;
} {
  const MAX_WIDTH = 756;
  const MAX_HEIGHT = 1344;
  const X_OFFSET = 162;
  const Y_OFFSET = 288;

  const aspectRatio = assetWidth / assetHeight;
  const maxAspectRatio = MAX_WIDTH / MAX_HEIGHT;

  let scaledWidth: number;
  let scaledHeight: number;

  if (aspectRatio > maxAspectRatio) {
    // Landscape: scale by width
    scaledWidth = MAX_WIDTH;
    scaledHeight = scaledWidth / aspectRatio;
  } else {
    // Portrait or square: scale by height
    scaledHeight = MAX_HEIGHT;
    scaledWidth = scaledHeight * aspectRatio;

    // Clamp width if it exceeds maximum
    if (scaledWidth > MAX_WIDTH) {
      scaledWidth = MAX_WIDTH;
      scaledHeight = scaledWidth / aspectRatio;
    }
  }

  // Center within safe zone
  const x = X_OFFSET + (MAX_WIDTH - scaledWidth) / 2;
  const y = Y_OFFSET + (MAX_HEIGHT - scaledHeight) / 2;

  return {
    width: Math.round(scaledWidth),
    height: Math.round(scaledHeight),
    x: Math.round(x),
    y: Math.round(y)
  };
}
```

### Main Composition Function

**Available in**: `lib/compose-story.ts`

Provides the complete composition workflow with error handling, metadata storage, and version management.

## Batch Processing

```typescript
import pLimit from 'p-limit';

async function composeBatch(
  items: Array<{ background: string; asset: string; output: string }>
): Promise<void> {
  const limit = pLimit(5); // Process 5 concurrently

  await Promise.all(
    items.map(item =>
      limit(() => composeStory(item.background, item.asset, item.output))
    )
  );
}
```

## Common Patterns

### Pattern: Verify Asset Fits in Safe Zone

```typescript
const { width, height, x, y } = calculateAssetDimensions(assetWidth, assetHeight);

if (!isInSafeZone(x, y, width, height)) {
  throw new Error('Asset does not fit in safe zone after scaling');
}
```

### Pattern: Preview Mode (Smaller Output)

```typescript
// Generate 720x1280 preview (75% scale)
const previewBuffer = await sharp(outputPath)
  .resize(720, 1280, { fit: 'contain' })
  .toBuffer();
```

### Pattern: Add Safe Zone Overlay (Debug)

```typescript
import sharp from 'sharp';

// Create overlay SVG showing safe zones
const safeZoneOverlay = Buffer.from(`
  <svg width="1080" height="1920">
    <rect x="0" y="0" width="1080" height="250" fill="red" opacity="0.3" />
    <rect x="0" y="1740" width="1080" height="180" fill="red" opacity="0.3" />
    <rect x="162" y="288" width="756" height="1344" stroke="yellow" stroke-width="4" fill="none" stroke-dasharray="10,5" />
  </svg>
`);

await sharp(outputPath)
  .composite([{ input: safeZoneOverlay, top: 0, left: 0 }])
  .toFile('debug-with-overlay.png');
```

## Performance Optimization

### Reuse Sharp Instances

```typescript
// Bad: Creates new Sharp instance each time
await sharp(buffer).resize(100, 100).toBuffer();
await sharp(buffer).resize(200, 200).toBuffer();

// Good: Reuse instance
const pipeline = sharp(buffer);
const small = await pipeline.clone().resize(100, 100).toBuffer();
const medium = await pipeline.clone().resize(200, 200).toBuffer();
```

### Stream Processing for Large Files

```typescript
import { createReadStream, createWriteStream } from 'fs';

createReadStream(backgroundPath)
  .pipe(
    sharp()
      .composite([{ input: scaledAsset, top: y, left: x }])
      .png()
  )
  .pipe(createWriteStream(outputPath));
```

## Integration with ISA Workflow

**Typical Workflow**:
1. AI generates background → `background_raw.png` (1080x1920)
2. Load original asset → From `asset_url`
3. **Compose story** → Using this skill
4. Save version → `/uploads/{assetId}/v1.png`
5. Display preview → Gallery grid

**Version Management**:
- Each composition saved as new version (v1.png, v2.png, etc.)
- Store composition metadata in history.json
- Active version pointer determines which to schedule

## Error Handling

```typescript
try {
  await composeStory(background, asset, output);
} catch (error) {
  if (error.message.includes('Input file is missing')) {
    // Asset file not found
  } else if (error.message.includes('unsupported')) {
    // Unsupported image format
  } else if (error.message.includes('ENOSPC')) {
    // Disk space issue
  }

  // Log error with context
  logger.error('Story composition failed', {
    background,
    asset,
    error: error.message
  });

  throw error;
}
```

## Testing Checklist

- [ ] Landscape assets scale correctly by width
- [ ] Portrait assets scale correctly by height
- [ ] Square assets scale correctly
- [ ] Assets centered within safe zone
- [ ] Transparency preserved for PNG assets
- [ ] SVG assets rasterized correctly
- [ ] Output is 1080x1920 pixels
- [ ] Safe zone calculations match exactly
- [ ] Batch processing works
- [ ] Error handling covers edge cases

## Reference Files

- **Instagram Specifications**: [INSTAGRAM_SPECS.md](references/INSTAGRAM_SPECS.md)
- **Sharp Library Patterns**: [SHARP_PATTERNS.md](references/SHARP_PATTERNS.md)

## Examples

- **Basic Composition**: [basic-composition.ts](examples/basic-composition.ts)
- **Batch Processing**: [batch-composition.ts](examples/batch-composition.ts)

## Related Skills

- **iconscout-brand**: For AI background generation prompts and brand aesthetic
  - See [../iconscout-brand/references/BRAND_GUIDELINES.md](../iconscout-brand/references/BRAND_GUIDELINES.md)

---

**Skill Version**: 1.0.0
**Last Updated**: January 2026
**Project**: IconScout Story Automator (ISA)
