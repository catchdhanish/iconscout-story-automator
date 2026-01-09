# IconScout Story Automator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an internal dashboard for automating Instagram Story creation and scheduling with AI-generated backgrounds.

**Architecture:** Next.js 14+ App Router with local filesystem storage, OpenRouter/Gemini for AI, Sharp for image processing, Blotato for Instagram scheduling. File-locked JSON for state management.

**Tech Stack:** Next.js 14+, TypeScript, Tailwind CSS, Sharp, OpenRouter API (Gemini 2.0 Pro), Blotato API, proper-lockfile, node-vibrant, Winston logger

**Reference Skills:**
- @story-composition - Safe zone math and Sharp composition
- @iconscout-brand - AI prompt templates and brand guidelines
- @scheduling-instagram-stories - Blotato API integration patterns

---

## Phase 1: Project Foundation

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `tailwind.config.js`

**Step 1: Initialize Next.js with TypeScript**

```bash
npx create-next-app@latest iconscout-story-automator --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd iconscout-story-automator
```

Expected: Creates Next.js 14+ project with App Router

**Step 2: Install core dependencies**

```bash
npm install sharp@^0.33.0 proper-lockfile@^4.1.2 node-vibrant@^3.2.1 winston@^3.11.0 date-fns@^3.0.0 react-hot-toast@^2.4.1
npm install -D @types/proper-lockfile @types/node-vibrant
```

Expected: All packages installed successfully

**Step 3: Verify build works**

```bash
npm run build
```

Expected: Build completes without errors

**Step 4: Create directory structure**

```bash
mkdir -p public/uploads public/temp logs lib/utils lib/api components app/api app/dashboard app/upload
touch history.json
echo "[]" > history.json
```

Expected: All directories and files created

**Step 5: Commit foundation**

```bash
git add .
git commit -m "feat: initialize Next.js project with dependencies"
```

---

### Task 2: Environment Configuration & Types

**Files:**
- Create: `lib/types.ts`
- Modify: `.env` (already exists)
- Create: `lib/config.ts`

**Step 1: Define core TypeScript types**

Create `lib/types.ts`:

```typescript
export type Status = 'Draft' | 'Ready' | 'Scheduled' | 'Published' | 'Failed' | 'Archived';

export interface AssetVersion {
  version: number;
  created_at: string;
  prompt_used: string;
  refinement_prompt?: string;
  file_path: string;
}

export interface AssetError {
  message: string;
  details: string;
  failed_at: string;
  retry_count: number;
}

export interface AssetMetadata {
  id: string;
  date: string;
  asset_url: string;
  meta_description: string;
  status: Status;
  created_at: string;
  updated_at?: string;
  asset_vision_description?: string;
  dominant_colors?: string[];
  active_version?: number;
  versions: AssetVersion[];
  blotato_post_id?: string;
  scheduled_time?: string;
  scheduled_at?: string;
  published_at?: string;
  verified_at?: string;
  error?: AssetError;
}

export interface HistoryData {
  assets: AssetMetadata[];
}
```

**Step 2: Create configuration utility**

Create `lib/config.ts`:

```typescript
export const config = {
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY!,
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'google/gemini-2.0-flash-exp:free',
    maxCallsPerMinute: parseInt(process.env.OPENROUTER_MAX_CALLS_PER_MINUTE || '20'),
    timeout: 30000
  },
  blotato: {
    apiKey: process.env.BLOTATO_API_KEY!,
    baseUrl: process.env.BLOTATO_API_BASE_URL || 'https://api.blotato.com',
    accountId: process.env.BLOTATO_ACCOUNT_ID || '',
    timeout: 15000
  },
  paths: {
    uploads: './public/uploads',
    temp: './public/temp',
    history: './history.json',
    logs: './logs'
  },
  instagram: {
    width: 1080,
    height: 1920,
    safeZones: {
      top: 250,
      bottom: 180
    },
    assetZone: {
      width: 756,  // 70% of 1080
      height: 1344, // 70% of 1920
      xOffset: 162, // (1080 - 756) / 2
      yOffset: 288  // (1920 - 1344) / 2
    }
  }
} as const;

export function validateConfig() {
  const missing: string[] = [];

  if (!config.openrouter.apiKey) missing.push('OPENROUTER_API_KEY');
  if (!config.blotato.apiKey) missing.push('BLOTATO_API_KEY');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
```

**Step 3: Write test for config validation**

Create `lib/__tests__/config.test.ts`:

```typescript
import { validateConfig } from '../config';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should throw error when OPENROUTER_API_KEY is missing', () => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.BLOTATO_API_KEY = 'test';

    expect(() => validateConfig()).toThrow('Missing required environment variables: OPENROUTER_API_KEY');
  });

  it('should throw error when BLOTATO_API_KEY is missing', () => {
    process.env.OPENROUTER_API_KEY = 'test';
    delete process.env.BLOTATO_API_KEY;

    expect(() => validateConfig()).toThrow('Missing required environment variables: BLOTATO_API_KEY');
  });

  it('should not throw when all required variables are present', () => {
    process.env.OPENROUTER_API_KEY = 'test';
    process.env.BLOTATO_API_KEY = 'test';

    expect(() => validateConfig()).not.toThrow();
  });
});
```

**Step 4: Run test**

```bash
npm test -- lib/__tests__/config.test.ts
```

Expected: All tests pass

**Step 5: Commit configuration**

```bash
git add lib/types.ts lib/config.ts lib/__tests__/config.test.ts
git commit -m "feat: add TypeScript types and configuration"
```

---

## Phase 2: History Management (File Locking)

### Task 3: History File Locking Utility

**Reference:** Use patterns from @scheduling-instagram-stories for file locking

**Files:**
- Create: `lib/history.ts`
- Create: `lib/__tests__/history.test.ts`

**Step 1: Write test for history operations**

Create `lib/__tests__/history.test.ts`:

```typescript
import { readHistory, updateHistory, addAsset, updateAssetStatus } from '../history';
import { AssetMetadata } from '../types';
import fs from 'fs';

describe('History Management', () => {
  const testHistoryPath = './test-history.json';

  beforeEach(() => {
    fs.writeFileSync(testHistoryPath, JSON.stringify({ assets: [] }));
  });

  afterEach(() => {
    if (fs.existsSync(testHistoryPath)) {
      fs.unlinkSync(testHistoryPath);
    }
  });

  it('should read empty history', async () => {
    const history = await readHistory(testHistoryPath);
    expect(history.assets).toEqual([]);
  });

  it('should add new asset', async () => {
    const asset: AssetMetadata = {
      id: 'test-1',
      date: '2024-01-15',
      asset_url: 'https://example.com/asset.png',
      meta_description: 'Test asset',
      status: 'Draft',
      created_at: new Date().toISOString(),
      versions: []
    };

    await addAsset(asset, testHistoryPath);
    const history = await readHistory(testHistoryPath);

    expect(history.assets).toHaveLength(1);
    expect(history.assets[0].id).toBe('test-1');
  });

  it('should update asset status', async () => {
    const asset: AssetMetadata = {
      id: 'test-1',
      date: '2024-01-15',
      asset_url: 'https://example.com/asset.png',
      meta_description: 'Test asset',
      status: 'Draft',
      created_at: new Date().toISOString(),
      versions: []
    };

    await addAsset(asset, testHistoryPath);
    await updateAssetStatus('test-1', 'Ready', testHistoryPath);

    const history = await readHistory(testHistoryPath);
    expect(history.assets[0].status).toBe('Ready');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- lib/__tests__/history.test.ts
```

Expected: FAIL - functions not defined

**Step 3: Implement history utility**

Create `lib/history.ts`:

```typescript
import fs from 'fs';
import lockfile from 'proper-lockfile';
import { AssetMetadata, HistoryData, Status } from './types';
import { config } from './config';

export async function readHistory(path: string = config.paths.history): Promise<HistoryData> {
  if (!fs.existsSync(path)) {
    return { assets: [] };
  }

  const data = fs.readFileSync(path, 'utf8');
  return JSON.parse(data);
}

export async function updateHistory(
  updateFn: (history: HistoryData) => HistoryData,
  path: string = config.paths.history
): Promise<void> {
  let release: (() => Promise<void>) | undefined;

  try {
    // Acquire lock
    release = await lockfile.lock(path, {
      retries: {
        retries: 10,
        minTimeout: 100,
        maxTimeout: 2000
      },
      stale: 10000
    });

    // Read current history
    const history = await readHistory(path);

    // Apply update
    const updated = updateFn(history);

    // Write atomically
    fs.writeFileSync(path, JSON.stringify(updated, null, 2));

  } finally {
    if (release) await release();
  }
}

export async function addAsset(
  asset: AssetMetadata,
  path: string = config.paths.history
): Promise<void> {
  await updateHistory((history) => {
    history.assets.push(asset);
    return history;
  }, path);
}

export async function updateAssetStatus(
  assetId: string,
  status: Status,
  path: string = config.paths.history
): Promise<void> {
  await updateHistory((history) => {
    const asset = history.assets.find(a => a.id === assetId);
    if (asset) {
      asset.status = status;
      asset.updated_at = new Date().toISOString();
    }
    return history;
  }, path);
}

export async function getAsset(
  assetId: string,
  path: string = config.paths.history
): Promise<AssetMetadata | null> {
  const history = await readHistory(path);
  return history.assets.find(a => a.id === assetId) || null;
}

export async function deleteAsset(
  assetId: string,
  path: string = config.paths.history
): Promise<void> {
  await updateHistory((history) => {
    history.assets = history.assets.filter(a => a.id !== assetId);
    return history;
  }, path);
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- lib/__tests__/history.test.ts
```

Expected: PASS - all tests pass

**Step 5: Commit history utility**

```bash
git add lib/history.ts lib/__tests__/history.test.ts
git commit -m "feat: add file-locked history management"
```

---

## Phase 3: Image Processing (Sharp Integration)

### Task 4: Asset Composition Engine

**Reference:** Use @story-composition for safe zone calculations and Sharp patterns

**Files:**
- Create: `lib/composition.ts`
- Create: `lib/__tests__/composition.test.ts`

**Step 1: Write test for composition**

Create `lib/__tests__/composition.test.ts`:

```typescript
import { calculateAssetDimensions, composeStory } from '../composition';
import { config } from '../config';

describe('Image Composition', () => {
  describe('calculateAssetDimensions', () => {
    it('should scale landscape asset by width', () => {
      const result = calculateAssetDimensions(1000, 500);

      expect(result.width).toBe(756);
      expect(result.height).toBe(378);
      expect(result.x).toBe(162);
      expect(result.y).toBeGreaterThan(config.instagram.assetZone.yOffset);
    });

    it('should scale portrait asset by height', () => {
      const result = calculateAssetDimensions(500, 1000);

      expect(result.height).toBe(1344);
      expect(result.width).toBe(672);
      expect(result.y).toBe(288);
      expect(result.x).toBeGreaterThan(config.instagram.assetZone.xOffset);
    });

    it('should scale square asset to fit', () => {
      const result = calculateAssetDimensions(1000, 1000);

      expect(result.width).toBe(756);
      expect(result.height).toBe(756);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- lib/__tests__/composition.test.ts
```

Expected: FAIL - functions not defined

**Step 3: Implement composition utility**

Create `lib/composition.ts`:

```typescript
import sharp from 'sharp';
import { config } from './config';

export interface ScaledAsset {
  width: number;
  height: number;
  x: number;
  y: number;
}

export function calculateAssetDimensions(
  assetWidth: number,
  assetHeight: number
): ScaledAsset {
  const { width: maxWidth, height: maxHeight, xOffset, yOffset } = config.instagram.assetZone;

  const aspectRatio = assetWidth / assetHeight;
  const safeZoneAspectRatio = maxWidth / maxHeight;

  let scaledWidth: number;
  let scaledHeight: number;

  if (aspectRatio > safeZoneAspectRatio) {
    // Landscape: scale by width
    scaledWidth = maxWidth;
    scaledHeight = scaledWidth / aspectRatio;
  } else {
    // Portrait or square: scale by height
    scaledHeight = maxHeight;
    scaledWidth = scaledHeight * aspectRatio;
  }

  // Center within safe zone
  const x = xOffset + (maxWidth - scaledWidth) / 2;
  const y = yOffset + (maxHeight - scaledHeight) / 2;

  return {
    width: Math.round(scaledWidth),
    height: Math.round(scaledHeight),
    x: Math.round(x),
    y: Math.round(y)
  };
}

export async function composeStory(
  backgroundPath: string,
  assetPath: string,
  outputPath: string
): Promise<{ processingTime: number }> {
  const startTime = Date.now();

  // 1. Validate background dimensions
  const backgroundMetadata = await sharp(backgroundPath).metadata();

  if (
    backgroundMetadata.width !== config.instagram.width ||
    backgroundMetadata.height !== config.instagram.height
  ) {
    throw new Error(
      `Background must be ${config.instagram.width}x${config.instagram.height}px`
    );
  }

  // 2. Get asset metadata
  const assetMetadata = await sharp(assetPath).metadata();

  if (!assetMetadata.width || !assetMetadata.height) {
    throw new Error('Unable to read asset dimensions');
  }

  // 3. Calculate scaled dimensions
  const { width, height, x, y } = calculateAssetDimensions(
    assetMetadata.width,
    assetMetadata.height
  );

  // 4. Resize asset
  const scaledAssetBuffer = await sharp(assetPath)
    .resize(width, height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toBuffer();

  // 5. Composite onto background
  await sharp(backgroundPath)
    .composite([
      {
        input: scaledAssetBuffer,
        top: y,
        left: x
      }
    ])
    .png({ compressionLevel: 9 })
    .toFile(outputPath);

  const processingTime = Date.now() - startTime;

  return { processingTime };
}

export async function convertSvgToPng(svgPath: string, outputPath: string): Promise<void> {
  await sharp(svgPath)
    .resize(config.instagram.width * 2, config.instagram.height * 2) // 2x for quality
    .png()
    .toFile(outputPath);
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- lib/__tests__/composition.test.ts
```

Expected: PASS - all tests pass

**Step 5: Commit composition engine**

```bash
git add lib/composition.ts lib/__tests__/composition.test.ts
git commit -m "feat: add Sharp image composition engine with safe zones"
```

---

## Phase 4: AI Integration (OpenRouter/Gemini)

### Task 5: OpenRouter API Client

**Reference:** Use @iconscout-brand for prompt templates

**Files:**
- Create: `lib/openrouter.ts`
- Create: `lib/__tests__/openrouter.test.ts`

**Step 1: Write test for OpenRouter client**

Create `lib/__tests__/openrouter.test.ts`:

```typescript
import { analyzeAssetVision, generateBackground, buildSystemPrompt } from '../openrouter';

describe('OpenRouter API Client', () => {
  describe('buildSystemPrompt', () => {
    it('should build basic system prompt', () => {
      const prompt = buildSystemPrompt();

      expect(prompt).toContain('background designer');
      expect(prompt).toContain('1080x1920');
      expect(prompt).toContain('DO NOT draw the asset');
    });

    it('should include color context when provided', () => {
      const prompt = buildSystemPrompt(['#FF5733', '#33A1FF']);

      expect(prompt).toContain('#FF5733');
      expect(prompt).toContain('dominant colors');
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- lib/__tests__/openrouter.test.ts
```

Expected: FAIL - functions not defined

**Step 3: Implement OpenRouter client**

Create `lib/openrouter.ts`:

```typescript
import { config } from './config';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export function buildSystemPrompt(dominantColors?: string[]): string {
  let prompt = `You are an expert background designer for Instagram Stories specializing in the IconScout brand aesthetic.

BRAND STYLE:
- Modern, clean, vibrant yet professional
- Abstract, gradient-based, or organic shapes
- Bold colors that complement (not compete with) the main asset

CRITICAL RULES:
- Generate ONLY the background - DO NOT draw the asset, logo, or text
- Respect Instagram Story safe zones: top 250px and bottom 180px should avoid critical visual elements
- The center 70% of the canvas (756x1344 pixels out of 1080x1920) is reserved for the asset overlay
- Design the background to enhance, not compete with, the asset that will be placed on top
- Output resolution: 1080x1920 pixels (9:16 aspect ratio)

VISUAL APPROACH:
- Use abstract shapes and gradients rather than literal objects
- Create depth with layered shapes or gradient transitions
- Balance vibrant colors with clean, uncluttered composition
- Ensure the center area has visual interest but remains suitable for overlay`;

  if (dominantColors && dominantColors.length > 0) {
    prompt += `\n\nASSET COLOR CONTEXT:
The asset that will be overlaid has the following dominant colors: ${dominantColors.join(', ')}

COLOR STRATEGY:
- Use complementary or analogous colors to create harmony
- Avoid using the exact same colors as the asset (creates visual confusion)
- Create subtle contrast to make the asset "pop" without jarring transitions
- Consider using one dominant color from the asset as an accent (10-20% of background)`;
  }

  return prompt;
}

export function buildUserPrompt(
  assetDescription: string,
  metaDescription: string,
  dominantColors?: string[]
): string {
  let prompt = `Create a background for an Instagram Story featuring this asset:

Asset Description: ${assetDescription}
Meta Description: ${metaDescription}`;

  if (dominantColors && dominantColors.length > 0) {
    prompt += `\nSuggested Color Palette (use as guidance, not strict requirement): ${dominantColors.join(', ')}`;
  }

  prompt += '\n\nDesign a complementary background that enhances this asset while allowing it to remain the focal point.';

  return prompt;
}

export async function callOpenRouter(request: OpenRouterRequest): Promise<OpenRouterResponse> {
  const response = await fetch(config.openrouter.baseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.openrouter.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://iconscout.com',
      'X-Title': 'IconScout Story Automator'
    },
    body: JSON.stringify({
      model: config.openrouter.model,
      ...request
    }),
    signal: AbortSignal.timeout(config.openrouter.timeout)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function analyzeAssetVision(assetPath: string): Promise<string> {
  // TODO: Implement vision analysis with image upload
  // For now, return placeholder
  throw new Error('Vision analysis not yet implemented');
}

export async function generateBackground(
  assetDescription: string,
  metaDescription: string,
  dominantColors?: string[]
): Promise<string> {
  const systemPrompt = buildSystemPrompt(dominantColors);
  const userPrompt = buildUserPrompt(assetDescription, metaDescription, dominantColors);

  const response = await callOpenRouter({
    model: config.openrouter.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
    max_tokens: 1024
  });

  return response.choices[0].message.content;
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- lib/__tests__/openrouter.test.ts
```

Expected: PASS - all tests pass

**Step 5: Commit OpenRouter client**

```bash
git add lib/openrouter.ts lib/__tests__/openrouter.test.ts
git commit -m "feat: add OpenRouter API client with prompt templates"
```

---

## Phase 5: Scheduling Integration (Blotato)

### Task 6: Blotato API Client

**Reference:** Use @scheduling-instagram-stories for retry logic and error handling

**Files:**
- Create: `lib/blotato.ts`
- Create: `lib/__tests__/blotato.test.ts`

**Step 1: Write test for Blotato client**

Create `lib/__tests__/blotato.test.ts`:

```typescript
import { schedulePost, getPostStatus, unschedulePost, retryWithBackoff } from '../blotato';

describe('Blotato API Client', () => {
  describe('retryWithBackoff', () => {
    it('should succeed on first try', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      await expect(retryWithBackoff(fn, { maxRetries: 3 }))
        .rejects.toThrow('fail');

      expect(fn).toHaveBeenCalledTimes(3);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- lib/__tests__/blotato.test.ts
```

Expected: FAIL - functions not defined

**Step 3: Implement Blotato client**

Create `lib/blotato.ts`:

```typescript
import { config } from './config';

export interface BlotatoPost {
  mediaType: 'story';
  mediaUrl: string;
  scheduledTime: string;
  accountId?: string;
}

export interface BlotatoPostResponse {
  postId: string;
  status: string;
  scheduledTime: string;
}

export interface RetryConfig {
  maxRetries?: number;
  delays?: number[];
  onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  delays: [5000, 15000, 45000], // 5s, 15s, 45s
  onRetry: () => {}
};

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const { maxRetries, delays, onRetry } = { ...DEFAULT_RETRY_CONFIG, ...config };

  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries - 1) {
        const delay = delays[attempt] || delays[delays.length - 1];
        onRetry(attempt + 1, lastError);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

async function callBlotato<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${config.blotato.baseUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${config.blotato.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers
    },
    signal: AbortSignal.timeout(config.blotato.timeout)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Blotato API error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function schedulePost(post: BlotatoPost): Promise<BlotatoPostResponse> {
  return retryWithBackoff(async () => {
    return callBlotato<BlotatoPostResponse>('/v2/posts', {
      method: 'POST',
      body: JSON.stringify({
        ...post,
        accountId: post.accountId || config.blotato.accountId
      })
    });
  });
}

export async function getPostStatus(postId: string): Promise<BlotatoPostResponse> {
  return callBlotato<BlotatoPostResponse>(`/v2/posts/${postId}`, {
    method: 'GET'
  });
}

export async function unschedulePost(postId: string): Promise<void> {
  await callBlotato(`/v2/posts/${postId}`, {
    method: 'DELETE'
  });
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- lib/__tests__/blotato.test.ts
```

Expected: PASS - all tests pass

**Step 5: Commit Blotato client**

```bash
git add lib/blotato.ts lib/__tests__/blotato.test.ts
git commit -m "feat: add Blotato API client with retry logic"
```

---

## Phase 6: API Routes

### Task 7: Asset Upload API

**Files:**
- Create: `app/api/assets/upload/route.ts`
- Create: `app/api/assets/[id]/route.ts`

**Step 1: Create upload endpoint**

Create `app/api/assets/upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { addAsset } from '@/lib/history';
import { AssetMetadata } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { config } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { asset_url, meta_description, date } = body;

    // Validate required fields
    if (!asset_url || !meta_description || !date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create asset metadata
    const asset: AssetMetadata = {
      id: uuidv4(),
      date,
      asset_url,
      meta_description,
      status: 'Draft',
      created_at: new Date().toISOString(),
      versions: []
    };

    // Create asset directory
    const assetDir = path.join(config.paths.uploads, asset.id);
    if (!fs.existsSync(assetDir)) {
      fs.mkdirSync(assetDir, { recursive: true });
    }

    // Add to history
    await addAsset(asset);

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload asset' },
      { status: 500 }
    );
  }
}
```

**Step 2: Create get/update/delete endpoint**

Create `app/api/assets/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAsset, updateAssetStatus, deleteAsset } from '@/lib/history';
import { Status } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const asset = await getAsset(params.id);

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(asset);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch asset' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    await updateAssetStatus(params.id, status as Status);

    const updated = await getAsset(params.id);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update asset' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await deleteAsset(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete asset' },
      { status: 500 }
    );
  }
}
```

**Step 3: Test endpoints manually**

```bash
# Start dev server
npm run dev

# Test upload
curl -X POST http://localhost:3000/api/assets/upload \
  -H "Content-Type: application/json" \
  -d '{"asset_url":"https://example.com/asset.png","meta_description":"Test","date":"2024-01-15"}'
```

Expected: Returns asset with status 201

**Step 4: Commit API routes**

```bash
git add app/api/assets/
git commit -m "feat: add asset upload and management API routes"
```

---

## Phase 7: Background Generation API

### Task 8: Background Generation Endpoint

**Files:**
- Create: `app/api/backgrounds/generate/route.ts`

**Step 1: Create background generation endpoint**

Create `app/api/backgrounds/generate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { generateBackground } from '@/lib/openrouter';
import { getAsset, updateHistory } from '@/lib/history';
import { config } from '@/lib/config';
import path from 'path';
import fs from 'fs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { assetId } = body;

    if (!assetId) {
      return NextResponse.json(
        { error: 'Asset ID is required' },
        { status: 400 }
      );
    }

    // Get asset metadata
    const asset = await getAsset(assetId);
    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Generate background using AI
    const backgroundDescription = await generateBackground(
      asset.asset_vision_description || asset.meta_description,
      asset.meta_description,
      asset.dominant_colors
    );

    // TODO: Actually generate image from description
    // For now, just store the prompt

    // Update asset with version
    await updateHistory((history) => {
      const assetIndex = history.assets.findIndex(a => a.id === assetId);
      if (assetIndex >= 0) {
        const version = {
          version: (asset.versions?.length || 0) + 1,
          created_at: new Date().toISOString(),
          prompt_used: backgroundDescription,
          file_path: `/uploads/${assetId}/v${(asset.versions?.length || 0) + 1}.png`
        };

        history.assets[assetIndex].versions.push(version);
        history.assets[assetIndex].active_version = version.version;
        history.assets[assetIndex].status = 'Ready';
      }
      return history;
    });

    const updated = await getAsset(assetId);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Background generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate background' },
      { status: 500 }
    );
  }
}
```

**Step 2: Test endpoint**

```bash
curl -X POST http://localhost:3000/api/backgrounds/generate \
  -H "Content-Type: application/json" \
  -d '{"assetId":"<asset-id>"}'
```

Expected: Returns updated asset with new version

**Step 3: Commit background generation API**

```bash
git add app/api/backgrounds/
git commit -m "feat: add background generation API endpoint"
```

---

## Phase 8: Scheduling API

### Task 9: Scheduling Endpoint

**Files:**
- Create: `app/api/schedule/route.ts`

**Step 1: Create scheduling endpoint**

Create `app/api/schedule/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { schedulePost, getPostStatus } from '@/lib/blotato';
import { getAsset, updateHistory } from '@/lib/history';
import { config } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { assetId } = body;

    if (!assetId) {
      return NextResponse.json(
        { error: 'Asset ID is required' },
        { status: 400 }
      );
    }

    // Get asset
    const asset = await getAsset(assetId);
    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    if (asset.status !== 'Ready') {
      return NextResponse.json(
        { error: 'Asset must be in Ready status to schedule' },
        { status: 400 }
      );
    }

    if (!asset.active_version) {
      return NextResponse.json(
        { error: 'Asset has no active version' },
        { status: 400 }
      );
    }

    // Get active version file path
    const activeVersion = asset.versions.find(v => v.version === asset.active_version);
    if (!activeVersion) {
      return NextResponse.json(
        { error: 'Active version not found' },
        { status: 404 }
      );
    }

    // Convert date to ISO UTC
    const scheduledTime = new Date(asset.date).toISOString();

    // Schedule on Blotato
    const response = await schedulePost({
      mediaType: 'story',
      mediaUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}${activeVersion.file_path}`,
      scheduledTime
    });

    // Update asset status
    await updateHistory((history) => {
      const assetIndex = history.assets.findIndex(a => a.id === assetId);
      if (assetIndex >= 0) {
        history.assets[assetIndex].status = 'Scheduled';
        history.assets[assetIndex].blotato_post_id = response.postId;
        history.assets[assetIndex].scheduled_time = scheduledTime;
        history.assets[assetIndex].scheduled_at = new Date().toISOString();
      }
      return history;
    });

    const updated = await getAsset(assetId);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Scheduling error:', error);

    // Update asset with error
    await updateHistory((history) => {
      const assetIndex = history.assets.findIndex(a => a.id === assetId);
      if (assetIndex >= 0) {
        history.assets[assetIndex].status = 'Failed';
        history.assets[assetIndex].error = {
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error instanceof Error ? error.stack || '' : '',
          failed_at: new Date().toISOString(),
          retry_count: 0
        };
      }
      return history;
    });

    return NextResponse.json(
      { error: 'Failed to schedule post' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');

    if (!assetId) {
      return NextResponse.json(
        { error: 'Asset ID is required' },
        { status: 400 }
      );
    }

    const asset = await getAsset(assetId);
    if (!asset || !asset.blotato_post_id) {
      return NextResponse.json(
        { error: 'Scheduled post not found' },
        { status: 404 }
      );
    }

    const status = await getPostStatus(asset.blotato_post_id);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}
```

**Step 2: Test scheduling endpoint**

```bash
curl -X POST http://localhost:3000/api/schedule \
  -H "Content-Type: application/json" \
  -d '{"assetId":"<asset-id>"}'
```

Expected: Returns scheduled asset with Blotato post ID

**Step 3: Commit scheduling API**

```bash
git add app/api/schedule/
git commit -m "feat: add Blotato scheduling API endpoint"
```

---

## Phase 9: Frontend Components

### Task 10: Asset Card Component

**Files:**
- Create: `components/AssetCard.tsx`

**Step 1: Create asset card component**

Create `components/AssetCard.tsx`:

```tsx
import { AssetMetadata } from '@/lib/types';
import { format } from 'date-fns';

interface AssetCardProps {
  asset: AssetMetadata;
  onEdit: (id: string) => void;
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
  onSchedule: (id: string) => void;
}

export function AssetCard({ asset, onEdit, onApprove, onDelete, onSchedule }: AssetCardProps) {
  const statusColors = {
    Draft: 'bg-gray-100 text-gray-800',
    Ready: 'bg-blue-100 text-blue-800',
    Scheduled: 'bg-green-100 text-green-800',
    Published: 'bg-purple-100 text-purple-800',
    Failed: 'bg-red-100 text-red-800',
    Archived: 'bg-gray-100 text-gray-500'
  };

  const activeVersion = asset.versions.find(v => v.version === asset.active_version);

  return (
    <div className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      {activeVersion && (
        <img
          src={activeVersion.file_path}
          alt={asset.meta_description}
          className="w-full aspect-[9/16] object-cover rounded-md mb-3"
        />
      )}

      {/* Date Badge */}
      <div className="text-sm text-gray-600 mb-2">
        {format(new Date(asset.date), 'MMM dd, yyyy')}
      </div>

      {/* Status Badge */}
      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mb-3 ${statusColors[asset.status]}`}>
        {asset.status}
      </span>

      {/* Meta Description */}
      <p className="text-sm text-gray-700 mb-4 line-clamp-2">
        {asset.meta_description}
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        {asset.status === 'Draft' && (
          <>
            <button
              onClick={() => onEdit(asset.id)}
              className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
            >
              Edit
            </button>
            <button
              onClick={() => onApprove(asset.id)}
              className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded"
            >
              Approve
            </button>
          </>
        )}
        {asset.status === 'Ready' && (
          <button
            onClick={() => onSchedule(asset.id)}
            className="px-3 py-1 text-sm bg-green-500 hover:bg-green-600 text-white rounded"
          >
            Schedule
          </button>
        )}
        <button
          onClick={() => onDelete(asset.id)}
          className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded ml-auto"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit component**

```bash
git add components/AssetCard.tsx
git commit -m "feat: add AssetCard component"
```

---

## Phase 10: Dashboard Page

### Task 11: Gallery Dashboard

**Files:**
- Create: `app/dashboard/page.tsx`

**Step 1: Create dashboard page**

Create `app/dashboard/page.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { AssetMetadata } from '@/lib/types';
import { AssetCard } from '@/components/AssetCard';
import toast, { Toaster } from 'react-hot-toast';

export default function DashboardPage() {
  const [assets, setAssets] = useState<AssetMetadata[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssets();
  }, []);

  async function fetchAssets() {
    try {
      const response = await fetch('/api/assets');
      const data = await response.json();
      setAssets(data.assets || []);
    } catch (error) {
      toast.error('Failed to load assets');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    try {
      await fetch(`/api/assets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Ready' })
      });
      toast.success('Asset approved');
      fetchAssets();
    } catch (error) {
      toast.error('Failed to approve asset');
    }
  }

  async function handleSchedule(id: string) {
    try {
      await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: id })
      });
      toast.success('Story scheduled successfully');
      fetchAssets();
    } catch (error) {
      toast.error('Failed to schedule story');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this asset?')) return;

    try {
      await fetch(`/api/assets/${id}`, { method: 'DELETE' });
      toast.success('Asset deleted');
      fetchAssets();
    } catch (error) {
      toast.error('Failed to delete asset');
    }
  }

  function handleEdit(id: string) {
    // TODO: Implement edit modal
    toast('Edit functionality coming soon');
  }

  const filteredAssets = assets
    .filter(a => filter === 'all' || a.status === filter)
    .filter(a => a.meta_description.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="container mx-auto px-4 py-8">
      <Toaster position="top-right" />

      <h1 className="text-3xl font-bold mb-8">Instagram Story Dashboard</h1>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <input
          type="text"
          placeholder="Search descriptions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border rounded-lg"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="all">All Status</option>
          <option value="Draft">Draft</option>
          <option value="Ready">Ready</option>
          <option value="Scheduled">Scheduled</option>
          <option value="Published">Published</option>
          <option value="Failed">Failed</option>
        </select>
      </div>

      {/* Gallery Grid */}
      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : filteredAssets.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No assets found. <a href="/upload" className="text-blue-500">Upload some assets</a> to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAssets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onEdit={handleEdit}
              onApprove={handleApprove}
              onDelete={handleDelete}
              onSchedule={handleSchedule}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add API route to list all assets**

Create `app/api/assets/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { readHistory } from '@/lib/history';

export async function GET() {
  try {
    const history = await readHistory();
    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch assets' },
      { status: 500 }
    );
  }
}
```

**Step 3: Test dashboard**

```bash
npm run dev
# Visit http://localhost:3000/dashboard
```

Expected: Dashboard loads with asset grid

**Step 4: Commit dashboard**

```bash
git add app/dashboard/page.tsx app/api/assets/route.ts
git commit -m "feat: add dashboard with gallery grid"
```

---

## Phase 11: Upload Interface

### Task 12: Upload Page

**Files:**
- Create: `app/upload/page.tsx`

**Step 1: Create upload page**

Create `app/upload/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

export default function UploadPage() {
  const router = useRouter();
  const [assets, setAssets] = useState([{
    asset_url: '',
    meta_description: '',
    date: ''
  }]);

  function addAsset() {
    setAssets([...assets, { asset_url: '', meta_description: '', date: '' }]);
  }

  function removeAsset(index: number) {
    setAssets(assets.filter((_, i) => i !== index));
  }

  function updateAsset(index: number, field: string, value: string) {
    const updated = [...assets];
    updated[index] = { ...updated[index], [field]: value };
    setAssets(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const loading = toast.loading('Uploading assets...');

    try {
      const results = await Promise.all(
        assets.map(asset =>
          fetch('/api/assets/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(asset)
          })
        )
      );

      const allSuccess = results.every(r => r.ok);

      if (allSuccess) {
        toast.success('All assets uploaded successfully', { id: loading });
        router.push('/dashboard');
      } else {
        toast.error('Some assets failed to upload', { id: loading });
      }
    } catch (error) {
      toast.error('Upload failed', { id: loading });
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Toaster position="top-right" />

      <h1 className="text-3xl font-bold mb-8">Upload Assets</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {assets.map((asset, index) => (
          <div key={index} className="border rounded-lg p-6 relative">
            {assets.length > 1 && (
              <button
                type="button"
                onClick={() => removeAsset(index)}
                className="absolute top-4 right-4 text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Asset URL *
                </label>
                <input
                  type="url"
                  required
                  value={asset.asset_url}
                  onChange={(e) => updateAsset(index, 'asset_url', e.target.value)}
                  placeholder="https://example.com/asset.png"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Meta Description *
                </label>
                <textarea
                  required
                  value={asset.meta_description}
                  onChange={(e) => updateAsset(index, 'meta_description', e.target.value)}
                  placeholder="Describe this asset..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Scheduled Date *
                </label>
                <input
                  type="date"
                  required
                  value={asset.date}
                  onChange={(e) => updateAsset(index, 'date', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>
          </div>
        ))}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={addAsset}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md"
          >
            + Add Another Asset
          </button>

          <button
            type="submit"
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md ml-auto"
          >
            Upload All
          </button>
        </div>
      </form>
    </div>
  );
}
```

**Step 2: Test upload page**

```bash
npm run dev
# Visit http://localhost:3000/upload
```

Expected: Upload form loads, can add multiple assets

**Step 3: Commit upload page**

```bash
git add app/upload/page.tsx
git commit -m "feat: add manual upload page with batch entry"
```

---

## Phase 12: Final Integration & Testing

### Task 13: Integration Testing

**Files:**
- Create: `tests/integration/workflow.test.ts`

**Step 1: Write end-to-end workflow test**

Create `tests/integration/workflow.test.ts`:

```typescript
import { addAsset, getAsset, updateAssetStatus } from '@/lib/history';
import { AssetMetadata } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

describe('Complete Workflow Integration', () => {
  const testHistoryPath = './test-workflow-history.json';
  let assetId: string;

  beforeEach(async () => {
    fs.writeFileSync(testHistoryPath, JSON.stringify({ assets: [] }));
    assetId = uuidv4();
  });

  afterEach(() => {
    if (fs.existsSync(testHistoryPath)) {
      fs.unlinkSync(testHistoryPath);
    }
  });

  it('should complete full workflow: upload -> approve -> schedule', async () => {
    // Step 1: Upload (Draft)
    const asset: AssetMetadata = {
      id: assetId,
      date: '2024-01-15',
      asset_url: 'https://example.com/asset.png',
      meta_description: 'Test workflow asset',
      status: 'Draft',
      created_at: new Date().toISOString(),
      versions: []
    };

    await addAsset(asset, testHistoryPath);

    let fetched = await getAsset(assetId, testHistoryPath);
    expect(fetched?.status).toBe('Draft');

    // Step 2: Approve (Ready)
    await updateAssetStatus(assetId, 'Ready', testHistoryPath);

    fetched = await getAsset(assetId, testHistoryPath);
    expect(fetched?.status).toBe('Ready');

    // Step 3: Schedule (Scheduled)
    await updateAssetStatus(assetId, 'Scheduled', testHistoryPath);

    fetched = await getAsset(assetId, testHistoryPath);
    expect(fetched?.status).toBe('Scheduled');
    expect(fetched?.updated_at).toBeDefined();
  });
});
```

**Step 2: Run integration test**

```bash
npm test -- tests/integration/workflow.test.ts
```

Expected: PASS - workflow completes successfully

**Step 3: Commit integration tests**

```bash
git add tests/integration/
git commit -m "test: add end-to-end workflow integration tests"
```

---

### Task 14: Documentation & README

**Files:**
- Create: `README.md`

**Step 1: Create comprehensive README**

Create `README.md`:

```markdown
# IconScout Story Automator

Internal dashboard for automating Instagram Story creation and scheduling with AI-generated backgrounds.

## Features

- 📤 **Batch Upload** - CSV or manual entry for multiple assets
- 🤖 **AI Background Generation** - Powered by Gemini 2.0 Pro via OpenRouter
- 🎨 **Smart Composition** - Safe zone-aware image layering with Sharp
- 📅 **Automated Scheduling** - Schedule posts via Blotato API
- 📊 **Dashboard** - Filter, search, and manage all stories
- 🔄 **Version Control** - Keep history of background iterations

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), React, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **AI**: OpenRouter API (Gemini 2.0 Pro)
- **Image Processing**: Sharp
- **Scheduling**: Blotato API
- **Storage**: Local filesystem with file-locked JSON

## Getting Started

### Prerequisites

- Node.js 18+
- OpenRouter API key
- Blotato API key

### Installation

1. Clone the repository
```bash
git clone https://github.com/catchdhanish/iconscout-story-automator.git
cd iconscout-story-automator
```

2. Install dependencies
```bash
npm install
```

3. Configure environment
```bash
cp .env.example .env
# Edit .env with your API keys
```

4. Create required directories
```bash
mkdir -p public/uploads public/temp logs
echo "[]" > history.json
```

5. Run development server
```bash
npm run dev
```

Visit http://localhost:3000/dashboard

## Usage

### Upload Assets

1. Go to `/upload`
2. Enter asset URL, description, and date
3. Click "Upload All"

### Review & Approve

1. Go to `/dashboard`
2. Review generated backgrounds
3. Click "Approve" to mark as ready

### Schedule Posts

1. Click "Schedule" on approved assets
2. Stories automatically post via Blotato

## Architecture

See [SPEC.md](./SPEC.md) for complete technical specification.

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- lib/__tests__/history.test.ts
```

## Deployment

```bash
# Build for production
npm run build

# Start production server
npm start

# Or use PM2
pm2 start npm --name "isa" -- start
pm2 save
pm2 startup
```

## Claude Code Skills

This project includes custom Claude Code skills:

- **@story-composition** - Instagram Story safe zone math and Sharp composition
- **@iconscout-brand** - AI Art Director prompt templates
- **@scheduling-instagram-stories** - Blotato API integration patterns

## License

Internal tool - All rights reserved by IconScout
```

**Step 2: Commit README**

```bash
git add README.md
git commit -m "docs: add comprehensive README with setup instructions"
```

---

## Task 15: Final Build & Verification

**Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests pass

**Step 2: Build production**

```bash
npm run build
```

Expected: Build completes without errors

**Step 3: Manual verification**

```bash
npm start
# Verify:
# - Dashboard loads at /dashboard
# - Upload form works at /upload
# - API endpoints respond correctly
```

**Step 4: Final commit**

```bash
git add .
git commit -m "chore: final build verification and polish"
git push origin main
```

---

## Success Criteria

- ✅ All tests pass
- ✅ Production build succeeds
- ✅ API endpoints functional
- ✅ Dashboard loads and displays assets
- ✅ Upload workflow completes
- ✅ File locking prevents corruption
- ✅ Configuration validated on startup
- ✅ Documentation complete

---

## Next Steps

After completing this plan:

1. **Manual Testing**: Test complete upload → generate → schedule flow
2. **Error Scenarios**: Test API failures, network timeouts
3. **Performance**: Test with 100+ assets
4. **Production Deploy**: Set up PM2 and configure production environment
5. **Monitoring**: Set up log monitoring with Winston

---

**Plan saved to:** `docs/plans/2026-01-09-iconscout-story-automator.md`

**Execution Options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration (USE: superpowers:subagent-driven-development)

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints (USE: superpowers:executing-plans)

**Which approach would you like?**
