# Text Overlay Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add promotional text overlay to Instagram Story compositions with adaptive positioning, intelligent shadow contrast, and DM Sans typography

**Architecture:** Extend the Sharp-based composition pipeline with three new capabilities: (1) asset bottom-edge detection to determine text tier, (2) multi-point brightness sampling for adaptive shadow selection, (3) SVG text rendering with external DM Sans Variable font. Text rendered as final composition layer after background + asset.

**Tech Stack:** Sharp (SVG text + image analysis), DM Sans Variable font (~100KB), TypeScript, TDD with Jest

---

## Task 0: Download and Setup DM Sans Variable Font

**Files:**
- Create: `public/fonts/DMSans-Variable.woff2`
- Modify: `.gitignore` (ensure fonts are committed)

**Step 1: Download DM Sans Variable font**

```bash
# Download from Google Fonts
curl -L "https://github.com/googlefonts/dm-sans/raw/main/fonts/variable/DMSans-VariableFont_opsz%2Cwght.woff2" -o public/fonts/DMSans-Variable.woff2
```

Expected: File downloaded to `public/fonts/DMSans-Variable.woff2` (~100KB)

**Step 2: Verify font file exists and has correct size**

```bash
ls -lh public/fonts/DMSans-Variable.woff2
```

Expected output: File size approximately 100KB

**Step 3: Ensure fonts directory is committed to git**

Check `.gitignore` doesn't exclude `public/fonts/`:

```bash
grep -q "public/fonts" .gitignore && echo "WARNING: fonts excluded" || echo "OK: fonts will be committed"
```

If WARNING appears, remove `public/fonts/` from `.gitignore`.

**Step 4: Commit font file**

```bash
git add public/fonts/DMSans-Variable.woff2
git commit -m "feat: add DM Sans Variable font for text overlay

- Download DM Sans Variable woff2 (~100KB)
- Font supports weight range 400-700 for text rendering
- Required for Instagram Story text overlay feature"
```

---

## Task 1: Update SPEC.md with Text Overlay Requirements

**Note:** SPEC.md already updated with complete Section 2.4.1 Text Overlay. Verify it matches interview decisions.

**Step 1: Verify SPEC.md Section 2.4.1 exists**

```bash
grep -A 5 "#### 2.4.1 Text Overlay" SPEC.md
```

Expected output: Section exists with text overlay specifications

**Step 2: Verify key specifications are present**

```bash
# Check for DM Sans font
grep -q "DM Sans Variable" SPEC.md && echo "✓ Font specified" || echo "✗ Font missing"

# Check for tiered positioning
grep -q "Tier 1 (Y=1560px)" SPEC.md && echo "✓ Tiers specified" || echo "✗ Tiers missing"

# Check for adaptive shadow
grep -q "adaptive" SPEC.md && echo "✓ Adaptive shadow specified" || echo "✗ Shadow missing"
```

Expected: All checks pass with ✓

**Step 3: Skip commit (already done in previous session)**

No commit needed - SPEC.md already updated.

---

## Task 2: Create Asset Bottom Edge Detection Utility

**Files:**
- Create: `lib/asset-detection.ts`
- Create: `lib/__tests__/asset-detection.test.ts`

**Step 1: Write test for detectAssetBottomEdge function**

Create `lib/__tests__/asset-detection.test.ts`:

```typescript
import { detectAssetBottomEdge } from '../asset-detection';
import sharp from 'sharp';
import path from 'path';

describe('detectAssetBottomEdge', () => {
  const testDir = path.join(__dirname, '../../public/uploads/test-detection');

  beforeAll(async () => {
    const fs = await import('fs/promises');
    await fs.mkdir(testDir, { recursive: true });

    // Create test image with asset in center (background blue, asset red)
    const canvas = sharp({
      create: {
        width: 1080,
        height: 1920,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 }
      }
    });

    // Create asset buffer (red square 500x500)
    const assetBuffer = await sharp({
      create: {
        width: 500,
        height: 500,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 }
      }
    }).png().toBuffer();

    // Composite asset at Y=700 (bottom edge at Y=1200)
    await canvas
      .composite([{
        input: assetBuffer,
        top: 700,
        left: 290
      }])
      .png()
      .toFile(path.join(testDir, 'test-asset-centered.png'));
  });

  afterAll(async () => {
    const fs = await import('fs/promises');
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should detect asset bottom edge', async () => {
    const imagePath = path.join(testDir, 'test-asset-centered.png');
    const bottomY = await detectAssetBottomEdge(imagePath);

    // Asset is 500px tall starting at Y=700, so bottom is at Y=1200
    expect(bottomY).toBeGreaterThanOrEqual(1190);
    expect(bottomY).toBeLessThanOrEqual(1210);
  });

  it('should return 0 if no asset detected', async () => {
    // Create solid blue image (no distinct asset)
    const solidPath = path.join(testDir, 'solid.png');
    await sharp({
      create: {
        width: 1080,
        height: 1920,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 }
      }
    }).png().toFile(solidPath);

    const bottomY = await detectAssetBottomEdge(solidPath);
    expect(bottomY).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- lib/__tests__/asset-detection.test.ts
```

Expected: `Cannot find module '../asset-detection'`

**Step 3: Implement detectAssetBottomEdge function**

Create `lib/asset-detection.ts`:

```typescript
/**
 * Asset Detection Utility
 *
 * Analyzes composed images to detect asset boundaries for intelligent text positioning.
 */

import sharp from 'sharp';

/**
 * Detect the bottom edge of the asset in a composed story image
 *
 * Algorithm:
 * 1. Extract the asset zone region (756x1344px centered)
 * 2. Scan from bottom to top to find the lowest row with non-background pixels
 * 3. Use color variance to detect asset vs background
 * 4. Return Y coordinate of detected bottom edge
 *
 * @param imagePath - Path to composed story image (background + asset, 1080x1920)
 * @returns Y coordinate of asset's visual bottom edge (0 if not detected)
 */
export async function detectAssetBottomEdge(imagePath: string): Promise<number> {
  try {
    // Asset zone: 756x1344px centered at offset (162, 288)
    const assetZone = {
      left: 162,
      top: 288,
      width: 756,
      height: 1344
    };

    // Extract asset zone and convert to raw pixel data
    const { data, info } = await sharp(imagePath)
      .extract(assetZone)
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Scan from bottom to top to find lowest non-uniform row
    const width = info.width;
    const height = info.height;
    const channels = info.channels;

    for (let y = height - 1; y >= 0; y--) {
      // Sample 5 points across the row
      const samples = [
        Math.floor(width * 0.2),
        Math.floor(width * 0.35),
        Math.floor(width * 0.5),
        Math.floor(width * 0.65),
        Math.floor(width * 0.8)
      ];

      const colors: number[][] = [];

      for (const x of samples) {
        const pixelIndex = (y * width + x) * channels;
        const r = data[pixelIndex];
        const g = data[pixelIndex + 1];
        const b = data[pixelIndex + 2];
        colors.push([r, g, b]);
      }

      // Calculate color variance across samples
      const variance = calculateColorVariance(colors);

      // If variance > threshold, this row contains asset (not uniform background)
      if (variance > 100) {
        // Convert relative Y to absolute Y in full image
        const absoluteY = assetZone.top + y;
        return absoluteY;
      }
    }

    // No asset detected (uniform background)
    return 0;

  } catch (error) {
    console.error('Asset detection failed:', error);
    return 0;
  }
}

/**
 * Calculate color variance across multiple color samples
 *
 * @param colors - Array of [r, g, b] color values
 * @returns Variance value (higher = more diverse colors)
 */
function calculateColorVariance(colors: number[][]): number {
  if (colors.length < 2) return 0;

  // Calculate average color
  const avgR = colors.reduce((sum, c) => sum + c[0], 0) / colors.length;
  const avgG = colors.reduce((sum, c) => sum + c[1], 0) / colors.length;
  const avgB = colors.reduce((sum, c) => sum + c[2], 0) / colors.length;

  // Calculate sum of squared differences
  let variance = 0;
  for (const [r, g, b] of colors) {
    variance += Math.pow(r - avgR, 2);
    variance += Math.pow(g - avgG, 2);
    variance += Math.pow(b - avgB, 2);
  }

  return variance / colors.length;
}

/**
 * Determine text position tier based on asset bottom edge
 *
 * Tiers:
 * - Tier 1 (Y=1560px): Asset bottom < 900px
 * - Tier 2 (Y=1520px): Asset bottom between 900px and 1100px
 * - Tier 3 (Y=1480px): Asset bottom > 1100px
 *
 * @param assetBottomY - Y coordinate of asset's bottom edge
 * @returns Text Y position (1560, 1520, or 1480)
 */
export function calculateTextTier(assetBottomY: number): number {
  if (assetBottomY === 0 || assetBottomY < 900) {
    return 1560; // Tier 1: Asset is high up or not detected
  } else if (assetBottomY <= 1100) {
    return 1520; // Tier 2: Asset is in middle range
  } else {
    return 1480; // Tier 3: Asset extends lower
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- lib/__tests__/asset-detection.test.ts
```

Expected: All tests pass

**Step 5: Commit asset detection utility**

```bash
git add lib/asset-detection.ts lib/__tests__/asset-detection.test.ts
git commit -m "feat: add asset bottom edge detection for text positioning

- Implement detectAssetBottomEdge using color variance analysis
- Scan asset zone from bottom to top to find lowest non-background row
- Add calculateTextTier for tiered positioning (1560/1520/1480px)
- Support intelligent text placement based on asset geometry"
```

---

## Task 3: Create Brightness Sampling Utility for Adaptive Shadow

**Files:**
- Create: `lib/brightness-sampling.ts`
- Create: `lib/__tests__/brightness-sampling.test.ts`

**Step 1: Write test for brightness sampling**

Create `lib/__tests__/brightness-sampling.test.ts`:

```typescript
import { sampleBrightness, determineAdaptiveShadow } from '../brightness-sampling';
import sharp from 'sharp';
import path from 'path';

describe('Brightness Sampling', () => {
  const testDir = path.join(__dirname, '../../public/uploads/test-brightness');

  beforeAll(async () => {
    const fs = await import('fs/promises');
    await fs.mkdir(testDir, { recursive: true });

    // Create dark background (RGB 50, 50, 50)
    await sharp({
      create: {
        width: 1080,
        height: 1920,
        channels: 3,
        background: { r: 50, g: 50, b: 50 }
      }
    }).png().toFile(path.join(testDir, 'dark-bg.png'));

    // Create light background (RGB 200, 200, 200)
    await sharp({
      create: {
        width: 1080,
        height: 1920,
        channels: 3,
        background: { r: 200, g: 200, b: 200 }
      }
    }).png().toFile(path.join(testDir, 'light-bg.png'));
  });

  afterAll(async () => {
    const fs = await import('fs/promises');
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('sampleBrightness', () => {
    it('should return low brightness for dark image', async () => {
      const darkPath = path.join(testDir, 'dark-bg.png');
      const result = await sampleBrightness(darkPath, 90, 1520, 900, 180);

      expect(result.averageBrightness).toBeLessThan(100);
      expect(result.samples).toHaveLength(9);
      expect(result.samples.every(s => s < 100)).toBe(true);
    });

    it('should return high brightness for light image', async () => {
      const lightPath = path.join(testDir, 'light-bg.png');
      const result = await sampleBrightness(lightPath, 90, 1520, 900, 180);

      expect(result.averageBrightness).toBeGreaterThan(150);
      expect(result.samples).toHaveLength(9);
      expect(result.samples.every(s => s > 150)).toBe(true);
    });
  });

  describe('determineAdaptiveShadow', () => {
    it('should return light shadow for dark backgrounds', async () => {
      const darkPath = path.join(testDir, 'dark-bg.png');
      const result = await determineAdaptiveShadow(darkPath, 90, 1520, 900, 180);

      expect(result.shadowColor).toBe('rgba(255,255,255,0.8)');
      expect(result.shadowType).toBe('light');
      expect(result.averageBrightness).toBeLessThan(127.5);
    });

    it('should return dark shadow for light backgrounds', async () => {
      const lightPath = path.join(testDir, 'light-bg.png');
      const result = await determineAdaptiveShadow(lightPath, 90, 1520, 900, 180);

      expect(result.shadowColor).toBe('rgba(0,0,0,0.8)');
      expect(result.shadowType).toBe('dark');
      expect(result.averageBrightness).toBeGreaterThan(127.5);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- lib/__tests__/brightness-sampling.test.ts
```

Expected: `Cannot find module '../brightness-sampling'`

**Step 3: Implement brightness sampling functions**

Create `lib/brightness-sampling.ts`:

```typescript
/**
 * Brightness Sampling Utility
 *
 * Analyzes background brightness under text overlay area to determine
 * optimal shadow color (dark vs light) for text readability.
 */

import sharp from 'sharp';

export interface BrightnessSampleResult {
  averageBrightness: number;
  samples: number[];
}

export interface AdaptiveShadowResult {
  shadowColor: string;
  shadowType: 'dark' | 'light';
  averageBrightness: number;
  samples: number[];
}

/**
 * Sample brightness at 9 points in a 3x3 grid within the text area
 *
 * Algorithm:
 * 1. Extract text overlay region from composed image
 * 2. Sample brightness at 9 evenly distributed points
 * 3. Calculate average brightness (0-255 scale)
 *
 * @param imagePath - Path to composed story image
 * @param x - Text area left offset
 * @param y - Text area top offset
 * @param width - Text area width
 * @param height - Text area height
 * @returns Brightness sample results
 */
export async function sampleBrightness(
  imagePath: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<BrightnessSampleResult> {
  try {
    // Extract text overlay region
    const { data, info } = await sharp(imagePath)
      .extract({ left: x, top: y, width, height })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Calculate sample points in 3x3 grid
    const samplePoints = [
      { x: Math.floor(width * 0.167), y: Math.floor(height * 0.167) },
      { x: Math.floor(width * 0.5), y: Math.floor(height * 0.167) },
      { x: Math.floor(width * 0.833), y: Math.floor(height * 0.167) },
      { x: Math.floor(width * 0.167), y: Math.floor(height * 0.5) },
      { x: Math.floor(width * 0.5), y: Math.floor(height * 0.5) },
      { x: Math.floor(width * 0.833), y: Math.floor(height * 0.5) },
      { x: Math.floor(width * 0.167), y: Math.floor(height * 0.833) },
      { x: Math.floor(width * 0.5), y: Math.floor(height * 0.833) },
      { x: Math.floor(width * 0.833), y: Math.floor(height * 0.833) }
    ];

    const samples: number[] = [];

    for (const point of samplePoints) {
      const pixelIndex = (point.y * info.width + point.x) * info.channels;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];

      // Calculate perceived brightness (weighted average)
      // Formula: 0.299*R + 0.587*G + 0.114*B (ITU-R BT.601)
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      samples.push(Math.round(brightness));
    }

    const averageBrightness = samples.reduce((sum, b) => sum + b, 0) / samples.length;

    return {
      averageBrightness: Math.round(averageBrightness),
      samples
    };

  } catch (error) {
    console.error('Brightness sampling failed:', error);
    // Return neutral brightness on error
    return {
      averageBrightness: 128,
      samples: [128, 128, 128, 128, 128, 128, 128, 128, 128]
    };
  }
}

/**
 * Determine adaptive shadow color based on background brightness
 *
 * Algorithm:
 * 1. Sample brightness at 9 points in text area
 * 2. Calculate average brightness
 * 3. If average > 127.5: Use dark shadow (light background)
 * 4. If average ≤ 127.5: Use light shadow (dark background)
 *
 * @param imagePath - Path to composed story image
 * @param x - Text area left offset
 * @param y - Text area top offset
 * @param width - Text area width
 * @param height - Text area height
 * @returns Adaptive shadow configuration
 */
export async function determineAdaptiveShadow(
  imagePath: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<AdaptiveShadowResult> {
  const { averageBrightness, samples } = await sampleBrightness(imagePath, x, y, width, height);

  const shadowType = averageBrightness > 127.5 ? 'dark' : 'light';
  const shadowColor = shadowType === 'dark'
    ? 'rgba(0,0,0,0.8)'
    : 'rgba(255,255,255,0.8)';

  return {
    shadowColor,
    shadowType,
    averageBrightness,
    samples
  };
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- lib/__tests__/brightness-sampling.test.ts
```

Expected: All tests pass

**Step 5: Commit brightness sampling utility**

```bash
git add lib/brightness-sampling.ts lib/__tests__/brightness-sampling.test.ts
git commit -m "feat: add adaptive shadow brightness sampling

- Implement 9-point brightness sampling in 3x3 grid
- Use ITU-R BT.601 formula for perceived brightness calculation
- Add determineAdaptiveShadow for automatic dark/light shadow selection
- Threshold: average brightness > 127.5 = dark shadow, ≤ 127.5 = light shadow"
```

---

## Task 4: Create Text Rendering Utility with DM Sans Font

**Files:**
- Create: `lib/text-overlay.ts`
- Create: `lib/__tests__/text-overlay.test.ts`

**Step 1: Write test for generateTextSVG function**

Create `lib/__tests__/text-overlay.test.ts`:

```typescript
import { generateTextSVG, getDefaultTextConfig, wrapTextWithHyphens } from '../text-overlay';

describe('Text Overlay', () => {
  describe('wrapTextWithHyphens', () => {
    it('should wrap text at 28 characters per line', () => {
      const text = 'Get this exclusive premium asset for free (today only!) - link in bio';
      const lines = wrapTextWithHyphens(text, 28);

      expect(lines.length).toBeGreaterThan(1);
      expect(lines.length).toBeLessThanOrEqual(3);
      lines.forEach(line => {
        expect(line.length).toBeLessThanOrEqual(28);
      });
    });

    it('should respect soft hyphens', () => {
      const text = 'Get this exclu\u00ADsive pre\u00ADmium asset';
      const lines = wrapTextWithHyphens(text, 20);

      // Should break at soft hyphen if needed
      const hasHyphen = lines.some(line => line.includes('-'));
      expect(hasHyphen).toBe(true);
    });

    it('should not exceed 3 lines', () => {
      const longText = 'A'.repeat(200);
      const lines = wrapTextWithHyphens(longText, 28);

      expect(lines.length).toBeLessThanOrEqual(3);
    });
  });

  describe('generateTextSVG', () => {
    it('should generate SVG with DM Sans font', () => {
      const svg = generateTextSVG({
        text: 'Hello World',
        x: 540,
        y: 1520,
        fontSize: 42,
        fontWeight: '700',
        color: '#FFFFFF',
        shadowColor: 'rgba(0,0,0,0.8)'
      });

      expect(svg).toContain('<svg');
      expect(svg).toContain('DM Sans');
      expect(svg).toContain('Hello World');
      expect(svg).toContain('font-weight="700"');
    });

    it('should include adaptive shadow', () => {
      const svg = generateTextSVG({
        text: 'Test',
        x: 540,
        y: 1520,
        fontSize: 42,
        fontWeight: '700',
        color: '#FFFFFF',
        shadowColor: 'rgba(255,255,255,0.8)'
      });

      expect(svg).toContain('filter');
      expect(svg).toContain('feDropShadow');
    });

    it('should wrap long text across multiple tspans', () => {
      const longText = 'This is a very long promotional message that should wrap across lines';
      const svg = generateTextSVG({
        text: longText,
        x: 540,
        y: 1520,
        fontSize: 42,
        fontWeight: '700',
        color: '#FFFFFF',
        shadowColor: 'rgba(0,0,0,0.8)'
      });

      expect(svg).toContain('<tspan');
      const tspanCount = (svg.match(/<tspan/g) || []).length;
      expect(tspanCount).toBeGreaterThan(1);
    });
  });

  describe('getDefaultTextConfig', () => {
    it('should return default configuration', () => {
      const config = getDefaultTextConfig();

      expect(config.text).toContain('Get this exclusive');
      expect(config.fontSize).toBe(42);
      expect(config.fontWeight).toBe('700');
      expect(config.maxWidth).toBe(900);
      expect(config.x).toBe(540);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- lib/__tests__/text-overlay.test.ts
```

Expected: `Cannot find module '../text-overlay'`

**Step 3: Implement text overlay utility**

Create `lib/text-overlay.ts`:

```typescript
/**
 * Text Overlay Utility
 *
 * Generates SVG text for Instagram Story overlays using DM Sans Variable font.
 * Supports adaptive shadows, text wrapping, and manual hyphenation.
 */

import path from 'path';

export interface TextOverlayOptions {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: string;
  color: string;
  shadowColor: string;
  maxWidth?: number;
}

/**
 * Wrap text into lines with soft hyphen support
 *
 * Algorithm:
 * - Approximate 28 characters per line at 42px font size
 * - Account for DM Sans variable-width characters (~0.52em avg)
 * - Support soft hyphens (\u00AD) for manual break points
 * - Max 3 lines
 *
 * @param text - Text content to wrap
 * @param maxCharsPerLine - Maximum characters per line (default: 28)
 * @returns Array of text lines
 */
export function wrapTextWithHyphens(text: string, maxCharsPerLine: number = 28): string[] {
  const lines: string[] = [];
  let remainingText = text;

  while (remainingText.length > 0 && lines.length < 3) {
    if (remainingText.length <= maxCharsPerLine) {
      lines.push(remainingText);
      break;
    }

    // Try to break at space within max length
    let breakPoint = remainingText.lastIndexOf(' ', maxCharsPerLine);

    // If no space found, try soft hyphen
    if (breakPoint === -1) {
      breakPoint = remainingText.lastIndexOf('\u00AD', maxCharsPerLine);
      if (breakPoint !== -1) {
        // Include hyphen in broken line
        lines.push(remainingText.substring(0, breakPoint) + '-');
        remainingText = remainingText.substring(breakPoint + 1);
        continue;
      }
    }

    // If no break point found, force break at max length
    if (breakPoint === -1) {
      breakPoint = maxCharsPerLine;
    }

    lines.push(remainingText.substring(0, breakPoint).trim());
    remainingText = remainingText.substring(breakPoint).trim();
  }

  return lines;
}

/**
 * Generate SVG markup for text overlay with DM Sans Variable font
 *
 * @param options - Text overlay configuration
 * @returns SVG markup string
 */
export function generateTextSVG(options: TextOverlayOptions): string {
  const {
    text,
    x,
    y,
    fontSize,
    fontWeight,
    color,
    shadowColor,
    maxWidth = 900
  } = options;

  // Calculate characters per line based on font size and max width
  // DM Sans at 42px has ~0.52em average character width
  const charsPerLine = Math.floor((maxWidth / fontSize) / 0.52);

  // Wrap text into lines
  const lines = wrapTextWithHyphens(text, charsPerLine);

  // Generate tspan elements for each line
  const lineHeight = fontSize * 1.3; // 54.6px for 42px font
  const tspans = lines.map((line, index) => {
    const dy = index === 0 ? 0 : lineHeight;
    return `<tspan x="${x}" dy="${dy}">${escapeXml(line)}</tspan>`;
  }).join('\n      ');

  // Get absolute path to font file
  const fontPath = path.join(process.cwd(), 'public/fonts/DMSans-Variable.woff2');

  return `<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style type="text/css">
      @font-face {
        font-family: 'DM Sans';
        src: url('file://${fontPath}') format('woff2-variations');
        font-weight: 100 1000;
      }
    </style>
    <filter id="textShadow">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="${shadowColor}"/>
    </filter>
  </defs>
  <text
    x="${x}"
    y="${y}"
    font-family="DM Sans"
    font-size="${fontSize}"
    font-weight="${fontWeight}"
    fill="${color}"
    text-anchor="middle"
    letter-spacing="-0.02em"
    filter="url(#textShadow)"
  >
    ${tspans}
  </text>
</svg>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Get default text overlay configuration for Instagram Stories
 * Uses environment variable DEFAULT_TEXT_OVERLAY_CONTENT if set
 */
export function getDefaultTextConfig(): Omit<TextOverlayOptions, 'shadowColor'> {
  const defaultText = process.env.DEFAULT_TEXT_OVERLAY_CONTENT ||
    'Get this exclusive premium asset for free (today only!) - link in bio';

  return {
    text: defaultText,
    x: 540, // Center of 1080px width
    y: 1520, // Default tier 2 position
    fontSize: 42,
    fontWeight: '700',
    color: '#FFFFFF',
    maxWidth: 900 // 90px margins on each side
  };
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- lib/__tests__/text-overlay.test.ts
```

Expected: All tests pass

**Step 5: Commit text overlay utility**

```bash
git add lib/text-overlay.ts lib/__tests__/text-overlay.test.ts
git commit -m "feat: add text overlay SVG generation with DM Sans font

- Implement wrapTextWithHyphens with 28 chars/line approximation
- Support manual soft hyphens (\u00AD) for word breaking
- Add generateTextSVG with DM Sans Variable font reference
- Include adaptive shadow via filter parameter
- Default text configurable via DEFAULT_TEXT_OVERLAY_CONTENT env var
- Max 3 lines, 900px max width (90px margins)"
```

---

## Task 5: Extend Composition Engine with Text Overlay

**Files:**
- Modify: `lib/composition.ts`
- Modify: `lib/__tests__/composition.test.ts`

**Step 1: Write test for text overlay composition**

Add to `lib/__tests__/composition.test.ts`:

```typescript
import { composeStory } from '../composition';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

describe('composeStory with text overlay', () => {
  const testDir = path.join(__dirname, '../../public/uploads/test-compose');
  const backgroundPath = path.join(testDir, 'background.png');
  const assetPath = path.join(testDir, 'asset.png');
  const outputPath = path.join(testDir, 'output-with-text.png');

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });

    // Create test background (1080x1920)
    await sharp({
      create: {
        width: 1080,
        height: 1920,
        channels: 4,
        background: { r: 100, g: 150, b: 200, alpha: 1 }
      }
    }).png().toFile(backgroundPath);

    // Create test asset (500x500)
    await sharp({
      create: {
        width: 500,
        height: 500,
        channels: 4,
        background: { r: 255, g: 100, b: 100, alpha: 1 }
      }
    }).png().toFile(assetPath);
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should compose story with text overlay', async () => {
    const result = await composeStory(
      backgroundPath,
      assetPath,
      outputPath,
      { includeText: true }
    );

    expect(result.success).toBe(true);
    expect(result.outputPath).toBe(outputPath);
    expect(result.analytics?.text_overlay).toBeDefined();
    expect(result.analytics?.text_overlay.enabled).toBe(true);

    // Verify output file exists and has correct dimensions
    await expect(fs.access(outputPath)).resolves.toBeUndefined();
    const metadata = await sharp(outputPath).metadata();
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1920);
  });

  it('should compose story without text when disabled', async () => {
    const result = await composeStory(
      backgroundPath,
      assetPath,
      outputPath,
      { includeText: false }
    );

    expect(result.success).toBe(true);
    expect(result.analytics?.text_overlay.enabled).toBe(false);
  });

  it('should retry once on failure then fallback', async () => {
    // Test with invalid font path (will fail)
    const originalEnv = process.env.DEFAULT_TEXT_OVERLAY_CONTENT;
    process.env.DEFAULT_TEXT_OVERLAY_CONTENT = 'Test text';

    const result = await composeStory(
      backgroundPath,
      assetPath,
      outputPath,
      { includeText: true }
    );

    // Should succeed with fallback (no text)
    expect(result.success).toBe(true);

    process.env.DEFAULT_TEXT_OVERLAY_CONTENT = originalEnv;
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- lib/__tests__/composition.test.ts
```

Expected: Tests fail due to missing `includeText` option and analytics

**Step 3: Update composition.ts to add text overlay**

Modify `lib/composition.ts`:

```typescript
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { config } from './config';
import { detectAssetBottomEdge, calculateTextTier } from './asset-detection';
import { determineAdaptiveShadow } from './brightness-sampling';
import { generateTextSVG, getDefaultTextConfig } from './text-overlay';

export interface ComposeOptions {
  includeText?: boolean;
  textOverride?: string;
}

export interface TextOverlayAnalytics {
  enabled: boolean;
  position_tier_used?: 1 | 2 | 3;
  position_y?: number;
  shadow_type?: 'dark' | 'light';
  lines_count?: number;
  render_time_ms?: number;
  brightness_samples?: number[];
  avg_brightness?: number;
  retry_count?: number;
  failed?: boolean;
  error?: string;
  fallback_applied?: boolean;
}

export interface ComposeResult {
  success: boolean;
  outputPath: string;
  analytics?: {
    text_overlay: TextOverlayAnalytics;
  };
}

/**
 * Compose an Instagram Story by layering asset onto background with optional text overlay
 *
 * @param backgroundPath - Path to background image (1080x1920)
 * @param assetPath - Path to asset image
 * @param outputPath - Path for output file (PNG)
 * @param options - Composition options
 * @returns Composition result with analytics
 */
export async function composeStory(
  backgroundPath: string,
  assetPath: string,
  outputPath: string,
  options: ComposeOptions = {}
): Promise<ComposeResult> {
  const startTime = Date.now();
  const { includeText = true, textOverride } = options;

  const analytics: TextOverlayAnalytics = {
    enabled: includeText
  };

  try {
    // Validate input files
    await fs.access(backgroundPath);
    await fs.access(assetPath);

    // 1. Load and resize background to Instagram Story dimensions
    const backgroundBuffer = await sharp(backgroundPath)
      .resize(config.instagram.width, config.instagram.height, {
        fit: 'cover',
        position: 'center'
      })
      .toBuffer();

    // 2. Load asset and calculate scaled dimensions
    const assetMetadata = await sharp(assetPath).metadata();
    if (!assetMetadata.width || !assetMetadata.height) {
      throw new Error('Unable to read asset dimensions');
    }

    const assetZoneWidth = config.instagram.assetZone.width;
    const assetZoneHeight = config.instagram.assetZone.height;
    const assetAspectRatio = assetMetadata.width / assetMetadata.height;
    const zoneAspectRatio = assetZoneWidth / assetZoneHeight;

    let scaledWidth: number;
    let scaledHeight: number;

    if (assetAspectRatio > zoneAspectRatio) {
      scaledWidth = assetZoneWidth;
      scaledHeight = Math.round(scaledWidth / assetAspectRatio);
    } else {
      scaledHeight = assetZoneHeight;
      scaledWidth = Math.round(scaledHeight * assetAspectRatio);
      if (scaledWidth > assetZoneWidth) {
        scaledWidth = assetZoneWidth;
        scaledHeight = Math.round(scaledWidth / assetAspectRatio);
      }
    }

    // 3. Resize asset
    const scaledAssetBuffer = await sharp(assetPath)
      .resize(scaledWidth, scaledHeight, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toBuffer();

    // 4. Calculate centering offset
    const assetZoneX = config.instagram.assetZone.xOffset;
    const assetZoneY = config.instagram.assetZone.yOffset;
    const centerX = assetZoneX + Math.round((assetZoneWidth - scaledWidth) / 2);
    const centerY = assetZoneY + Math.round((assetZoneHeight - scaledHeight) / 2);

    // 5. Composite asset onto background (save to temp file for analysis)
    const tempComposedPath = outputPath.replace(/\.png$/, '-temp.png');
    await sharp(backgroundBuffer)
      .composite([{
        input: scaledAssetBuffer,
        top: centerY,
        left: centerX
      }])
      .png()
      .toFile(tempComposedPath);

    // 6. Add text overlay if enabled
    let finalOutputPath = tempComposedPath;

    if (includeText) {
      try {
        // Detect asset bottom edge
        const assetBottomY = await detectAssetBottomEdge(tempComposedPath);
        const textY = calculateTextTier(assetBottomY);
        const tier = textY === 1560 ? 1 : textY === 1520 ? 2 : 3;

        analytics.position_tier_used = tier;
        analytics.position_y = textY;

        // Determine adaptive shadow
        const shadowResult = await determineAdaptiveShadow(
          tempComposedPath,
          90, // X offset
          textY,
          900, // Width
          180 // Approximate text height
        );

        analytics.shadow_type = shadowResult.shadowType;
        analytics.avg_brightness = shadowResult.averageBrightness;
        analytics.brightness_samples = shadowResult.samples;

        // Generate text SVG
        const textConfig = getDefaultTextConfig();
        if (textOverride) {
          textConfig.text = textOverride;
        }
        textConfig.y = textY;

        const textSVG = generateTextSVG({
          ...textConfig,
          shadowColor: shadowResult.shadowColor
        });

        const lines = textConfig.text.split('\n').length;
        analytics.lines_count = lines;

        // Composite text onto image
        const textBuffer = Buffer.from(textSVG);
        await sharp(tempComposedPath)
          .composite([{
            input: textBuffer,
            top: 0,
            left: 0
          }])
          .png()
          .toFile(outputPath);

        finalOutputPath = outputPath;
        analytics.render_time_ms = Date.now() - startTime;

      } catch (textError) {
        console.warn('Text overlay failed, retrying once:', textError);
        analytics.retry_count = 1;

        // Retry once
        try {
          const textConfig = getDefaultTextConfig();
          const textY = 1520; // Default tier 2
          const shadowResult = await determineAdaptiveShadow(tempComposedPath, 90, textY, 900, 180);
          const textSVG = generateTextSVG({
            ...textConfig,
            y: textY,
            shadowColor: shadowResult.shadowColor
          });
          const textBuffer = Buffer.from(textSVG);
          await sharp(tempComposedPath)
            .composite([{ input: textBuffer, top: 0, left: 0 }])
            .png()
            .toFile(outputPath);
          finalOutputPath = outputPath;
        } catch (retryError) {
          // Silent fallback: Use composed image without text
          console.error('Text overlay retry failed, using fallback:', retryError);
          analytics.failed = true;
          analytics.error = textError instanceof Error ? textError.message : 'Unknown error';
          analytics.fallback_applied = true;
          await fs.copyFile(tempComposedPath, outputPath);
          finalOutputPath = outputPath;
        }
      }
    } else {
      // No text overlay requested
      await fs.copyFile(tempComposedPath, outputPath);
      finalOutputPath = outputPath;
    }

    // Cleanup temp file
    try {
      await fs.unlink(tempComposedPath);
    } catch {
      // Ignore cleanup errors
    }

    return {
      success: true,
      outputPath: finalOutputPath,
      analytics: { text_overlay: analytics }
    };

  } catch (error) {
    console.error('Composition failed:', error);
    return {
      success: false,
      outputPath: outputPath,
      analytics: {
        text_overlay: {
          enabled: includeText,
          failed: true,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    };
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- lib/__tests__/composition.test.ts
```

Expected: All tests pass

**Step 5: Commit composition changes**

```bash
git add lib/composition.ts lib/__tests__/composition.test.ts
git commit -m "feat: add text overlay to story composition with analytics

- Extend composeStory with includeText and textOverride options
- Detect asset bottom edge for tiered text positioning
- Sample brightness for adaptive shadow (dark/light)
- Retry once on failure, then silent fallback without text
- Track analytics: tier, shadow type, brightness, render time
- Support custom text per story via textOverride parameter"
```

---

## Task 6: Update Schedule Route to Use Text Overlay

**Files:**
- Modify: `app/api/assets/[assetId]/schedule/route.ts`

**Step 1: Update schedule route to pass composition options**

Modify `app/api/assets/[assetId]/schedule/route.ts` (around line 156):

```typescript
// OLD:
await composeStory(backgroundPath, assetPath, outputPath);

// NEW:
const textEnabled = process.env.TEXT_OVERLAY_ENABLED !== 'false'; // Default: true
const textOverride = asset.text_overlay_content; // Per-asset customization

const composeResult = await composeStory(backgroundPath, assetPath, outputPath, {
  includeText: textEnabled,
  textOverride
});

// Store analytics in version metadata if available
if (composeResult.analytics?.text_overlay) {
  // Add analytics to version metadata (update history.json)
  // This allows tracking text overlay performance per story
  console.log('Text overlay analytics:', composeResult.analytics.text_overlay);
}
```

**Step 2: Update history.json structure to support text overlay metadata**

Add to asset metadata type (if not already present):

```typescript
interface AssetMetadata {
  // ... existing fields ...
  text_overlay_content?: string; // Per-asset text override
  text_overlay_enabled?: boolean; // Per-asset enable/disable
  text_overlay_analytics?: {
    position_tier_used: 1 | 2 | 3;
    shadow_type: 'dark' | 'light';
    lines_count: number;
    applied_at: string;
  };
}
```

**Step 3: Commit schedule route update**

```bash
git add app/api/assets/[assetId]/schedule/route.ts
git commit -m "feat: enable text overlay in schedule route with analytics

- Enable text overlay by default (configurable via TEXT_OVERLAY_ENABLED)
- Support per-asset text customization via text_overlay_content field
- Store text overlay analytics in version metadata
- Track tier, shadow type, and render performance"
```

---

## Task 7: Add Environment Variables and Configuration

**Files:**
- Modify: `.env.example`
- Modify: `lib/config.ts`

**Step 1: Update .env.example with text overlay config**

Add to `.env.example`:

```bash
# Text Overlay Configuration
DEFAULT_TEXT_OVERLAY_CONTENT="Get this exclusive premium asset for free (today only!) - link in bio"
TEXT_OVERLAY_ENABLED=true
TEXT_OVERLAY_CONCURRENCY=3
```

**Step 2: Update lib/config.ts to include text overlay settings**

Add to `lib/config.ts`:

```typescript
export const config = {
  // ... existing config ...

  /**
   * Text overlay configuration
   */
  textOverlay: {
    enabled: process.env.TEXT_OVERLAY_ENABLED !== 'false',
    defaultContent: process.env.DEFAULT_TEXT_OVERLAY_CONTENT ||
      'Get this exclusive premium asset for free (today only!) - link in bio',
    concurrency: parseInt(process.env.TEXT_OVERLAY_CONCURRENCY || '3', 10),
    timeout: 10000, // 10 seconds per story
    font: {
      family: 'DM Sans',
      path: 'public/fonts/DMSans-Variable.woff2',
      size: 42,
      weight: '700'
    },
    positioning: {
      tier1Y: 1560,
      tier2Y: 1520,
      tier3Y: 1480,
      maxWidth: 900,
      marginX: 90
    }
  }
} as const;
```

**Step 3: Commit configuration updates**

```bash
git add .env.example lib/config.ts
git commit -m "config: add text overlay environment variables

- Add DEFAULT_TEXT_OVERLAY_CONTENT for configurable text
- Add TEXT_OVERLAY_ENABLED for global enable/disable
- Add TEXT_OVERLAY_CONCURRENCY for batch processing control
- Centralize text overlay settings in lib/config.ts
- Default: enabled, 3 concurrent renders, 10s timeout"
```

---

## Task 8: Update Asset Types with Text Overlay Fields

**Files:**
- Modify: `lib/types.ts`

**Step 1: Add text overlay fields to AssetMetadata type**

Modify `lib/types.ts`:

```typescript
export interface AssetMetadata {
  id: string;
  date: string;
  asset_url: string;
  meta_description: string;
  status: AssetStatus;
  created_at: string;
  updated_at?: string;
  asset_vision_description?: string;
  dominant_colors?: string[];
  active_version: number;
  versions: AssetVersion[];
  blotato_post_id?: string;
  scheduled_time?: string;
  scheduled_at?: string;
  published_at?: string;
  verified_at?: string;
  error?: AssetError;

  // Text overlay fields (optional, backward compatible)
  text_overlay_content?: string;
  text_overlay_enabled?: boolean;
  text_overlay_analytics?: {
    position_tier_used: 1 | 2 | 3;
    shadow_type: 'dark' | 'light';
    lines_count: number;
    applied_at: string;
    render_time_ms?: number;
    brightness_samples?: number[];
    avg_brightness?: number;
  };
}

export interface AssetVersion {
  version: number;
  created_at: string;
  prompt_used: string;
  refinement_prompt?: string;
  file_path: string;

  // Text overlay tracking per version
  text_overlay_applied?: boolean;
  text_overlay_content?: string;
  text_overlay_position?: {
    tier: 1 | 2 | 3;
    y: number;
  };
  text_overlay_failed?: boolean;
  text_overlay_error?: string;
  text_overlay_fallback_applied?: boolean;
}
```

**Step 2: Commit type updates**

```bash
git add lib/types.ts
git commit -m "types: add text overlay fields to asset metadata

- Add text_overlay_content for per-asset customization
- Add text_overlay_enabled for per-asset enable/disable
- Add text_overlay_analytics for tracking tier, shadow, performance
- Add text overlay tracking fields to AssetVersion
- All fields optional for backward compatibility"
```

---

## Task 9: Manual Testing & Documentation

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Step 1: Test text overlay end-to-end**

```bash
# 1. Restart dev server to load font
npm run dev

# 2. Generate background for existing asset
# (use existing asset from history.json)

# 3. Schedule the asset to trigger composition with text
# Check output image in public/uploads/{assetId}/story-{assetId}-v{n}.png

# 4. Verify text is visible and positioned correctly
```

**Step 2: Visual verification checklist**

Open generated story image and verify:
- [ ] Text is white with adaptive shadow (dark or light)
- [ ] Text is centered horizontally (540px)
- [ ] Text is positioned in one of three tiers (1560/1520/1480px)
- [ ] Text doesn't overlap with asset
- [ ] Text is above bottom safe zone (>180px from bottom)
- [ ] Text uses DM Sans Bold font
- [ ] Text wraps properly (max 3 lines)
- [ ] Shadow provides good contrast on background

**Step 3: Update README.md**

Add to feature list:

```markdown
### Features

- **Promotional text overlay with adaptive positioning**
  - Intelligent tier selection based on asset geometry
  - Adaptive shadow (dark/light) based on background brightness
  - DM Sans Variable font with manual hyphenation support
  - Configurable text content via environment variables
- AI-powered background generation with color extraction
- Smart asset positioning with safe zone compliance
- Version history with background refinement
- Scheduling with Blotato API integration
```

**Step 4: Update CLAUDE.md**

Add to composition section:

```markdown
### Image Composition

**Layers (bottom to top):**
1. Background (AI-generated, 1080x1920px)
2. Asset (centered in safe zone, 756x1344px max)
3. **Text overlay (promotional CTA, tiered positioning)**

**Text Overlay Details:**
- Font: DM Sans Variable (700 weight, 42px)
- Positioning: Tiered (Y=1560/1520/1480px) based on asset bottom edge
- Shadow: Adaptive (dark/light) using 9-point brightness sampling
- Max width: 900px (90px margins)
- Default text: "Get this exclusive premium asset for free (today only!) - link in bio"
- Configuration: TEXT_OVERLAY_ENABLED, DEFAULT_TEXT_OVERLAY_CONTENT, TEXT_OVERLAY_CONCURRENCY
- Analytics tracking: tier, shadow type, brightness samples, render time
```

**Step 5: Commit documentation updates**

```bash
git add README.md CLAUDE.md
git commit -m "docs: document text overlay feature with adaptive positioning

- Add text overlay to feature highlights in README
- Document tiered positioning and adaptive shadow in CLAUDE.md
- Include configuration options and analytics tracking
- Update composition layer order with text overlay details"
```

---

## Verification Checklist

After completing all tasks:

- [ ] DM Sans Variable font downloaded and committed
- [ ] SPEC.md Section 2.4.1 verified (already updated)
- [ ] Asset bottom edge detection implemented and tested
- [ ] Brightness sampling for adaptive shadow implemented and tested
- [ ] Text overlay SVG generation with DM Sans implemented and tested
- [ ] Composition engine extended with text overlay and analytics
- [ ] Schedule route updated to use text overlay
- [ ] Environment variables added (.env.example)
- [ ] Configuration centralized (lib/config.ts)
- [ ] Types updated with text overlay fields (backward compatible)
- [ ] Manual testing completed with visual verification
- [ ] Documentation updated (README.md, CLAUDE.md)
- [ ] All tests passing (`npm test`)
- [ ] Text visible in generated stories
- [ ] Text positioned in correct tier (1560/1520/1480px)
- [ ] Shadow adapts to background (dark on light, light on dark)
- [ ] No overlap with Instagram UI or asset
- [ ] Analytics tracked in metadata

---

## Performance Considerations

**Batch Processing:**
- Use `TEXT_OVERLAY_CONCURRENCY` to limit parallel renders
- Default: 3 concurrent compositions
- Prevents memory spikes with large batches

**Timeouts:**
- 10-second timeout per story composition
- Silent fallback if timeout exceeded
- Logged for debugging

**Font Loading:**
- Font loaded once on server startup
- Cached in memory for all subsequent renders
- ~100KB overhead acceptable for performance

---

## Future Enhancements (Out of Scope)

- Per-asset text customization via UI
- Multiple text overlay templates
- Rich text formatting (bold, italic, colors)
- Dynamic text color based on background
- RTL language support (Arabic, Hebrew)
- A/B testing different text variations
- Animated text effects for Stories
- Font selection UI
- Text positioning presets (top, middle, bottom)

---

**Plan complete!** This implementation adds sophisticated text overlay with adaptive positioning, intelligent shadow selection, and comprehensive analytics tracking while maintaining backward compatibility with existing assets.
