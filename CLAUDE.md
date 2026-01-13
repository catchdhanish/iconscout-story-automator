# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**IconScout Story Automator (ISA)** - An internal dashboard for automating the creation and scheduling of "Freebie of the Day" Instagram Stories. The system uses AI to generate backgrounds, composes story visuals, and schedules posts via the Blotato API.

**Key Technologies:**
- Next.js 14+ (App Router)
- OpenRouter API with Gemini 2.0 Pro (vision analysis & image generation)
- Sharp (image processing)
- Blotato API (Instagram scheduling)
- Local filesystem storage with file locking

## Development Commands

### Initial Setup
```bash
# Install dependencies
npm install

# Create required directories and initialize history
mkdir -p public/uploads public/temp logs
echo "[]" > history.json

# Copy environment template and configure
cp .env.example .env
# Edit .env with actual API keys
```

### Development
```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Run tests in watch mode
npm test -- --watch
```

### Production Deployment (PM2 Recommended)
```bash
pm2 start npm --name "iconscout-isa" -- start
pm2 save
pm2 startup
```

## Core Architecture

### Data Flow Pipeline

1. **Asset Ingestion** → 2. **AI Processing** → 3. **Composition** → 4. **Scheduling**

**Step 1: Asset Upload & Validation**
- CSV batch upload or manual entry
- Deep validation: HEAD request → full download → format verification via Sharp
- Duplicate detection (URL and date)
- Initial status: `Draft`

**Step 2: AI Vision & Background Generation**
- Vision analysis: Asset analyzed by Gemini 2.0 Pro to generate description
- Color extraction: Dominant colors extracted via `node-vibrant`
- Background generation: AI generates 1080x1920px background using vision description + colors
- Prompt engineering: System + user prompt split with strict "no asset drawing" rules

**Step 3: Image Composition**
- Three-layer composition using Sharp:
  1. Background layer (1080x1920px)
  2. Asset overlay (centered in safe zone)
  3. Text overlay (promotional message)
- Safe zone calculations:
  - Top 250px (Instagram UI)
  - Bottom 180px (interaction area)
  - Center 70% (756x1344px) for asset
- Asset scaling preserves aspect ratio, centered in safe zone
- Text overlay with adaptive positioning:
  - Font: DM Sans Variable (700 weight, 42px)
  - Positioning: Tiered (Y=1560/1520/1480px) based on asset bottom edge
  - Shadow: Adaptive (dark/light) using 9-point brightness sampling
  - Max width: 900px (90px margins)
  - Default text: "Get this exclusive premium asset for free (today only!) - link in bio"
  - Configuration: TEXT_OVERLAY_ENABLED, DEFAULT_TEXT_OVERLAY_CONTENT, TEXT_OVERLAY_CONCURRENCY
  - Analytics tracking: tier, shadow type, brightness samples, render time
- Version management: Each regeneration creates new version (v1.png, v2.png...)

**Step 4: Scheduling & Publication**
- Status progression: `Draft` → `Ready` → `Scheduled` → `Published`
- Time zone management: User TZ → UTC conversion for Blotato API
- Retry logic: 3 automatic retries with exponential backoff (5s, 15s, 45s)
- Background polling: Check Blotato every 5 minutes for publication confirmation

### State Management

**Primary Storage:** `history.json` (root level)
- File locking via `proper-lockfile` prevents concurrent write corruption
- Contains all asset metadata, status, versions, scheduling info

**Metadata Structure:**
```json
{
  "id": "uuid",
  "date": "YYYY-MM-DD",
  "asset_url": "https://...",
  "meta_description": "...",
  "status": "Draft|Ready|Scheduled|Published|Failed",
  "created_at": "ISO 8601 timestamp",
  "asset_vision_description": "AI-generated description",
  "dominant_colors": ["#hex1", "#hex2"],
  "active_version": 2,
  "versions": [
    {
      "version": 1,
      "created_at": "timestamp",
      "prompt_used": "...",
      "refinement_prompt": "optional",
      "file_path": "/uploads/{assetId}/v1.png"
    }
  ],
  "blotato_post_id": "blot_abc123",
  "scheduled_time": "ISO 8601 UTC",
  "error": { /* if failed */ }
}
```

### File Organization

```
/app
  /api
    /assets        - Upload, validation, metadata operations
    /backgrounds   - AI generation endpoints
    /schedule      - Blotato scheduling operations
    /history       - History export and queries
  /dashboard       - Main gallery/management UI
  /upload          - CSV/manual upload interface

/components
  /AssetCard       - Gallery card with preview, status, actions
  /GalleryGrid     - Infinite scroll grid with filtering/search
  /ScheduleCalendar - Calendar + list view
  /EditModal       - Version history, refinement UI

/lib
  /openrouter      - Gemini API client with rate limiting
  /blotato         - Blotato API client with retry logic
  /history         - File locking utilities for history.json
  /composition     - Sharp image processing pipeline
  /queue           - In-memory job queue

/public/uploads
  /{assetId}       - Per-asset directory
    /v1.png        - Version files
    /background_raw.png
  /temp            - Temporary validation storage
```

## Critical Implementation Details

### Safe Zone Mathematics
- Canvas: 1080x1920 pixels (9:16)
- Asset safe zone: 70% center = 756x1344px
- X offset: (1080 - 756) / 2 = 162px
- Y offset: (1920 - 1344) / 2 = 288px
- Asset scaled to fit within safe zone, aspect ratio preserved

### File Locking Pattern
```javascript
const lockfile = require('proper-lockfile');

async function updateHistory(updateFn) {
  const lockPath = '/path/to/history.json';
  let release;

  try {
    release = await lockfile.lock(lockPath, {
      retries: { retries: 10, minTimeout: 100, maxTimeout: 2000 },
      stale: 10000
    });

    const history = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const updated = updateFn(history);
    fs.writeFileSync(lockPath, JSON.stringify(updated, null, 2));
  } finally {
    if (release) await release();
  }
}
```

### Rate Limiting
- OpenRouter: Token bucket algorithm, configurable via `OPENROUTER_MAX_CALLS_PER_MINUTE` (default: 20)
- Blotato: Handle 429 responses dynamically, respect `Retry-After` header
- Queue position shown to users when rate limited

### Error Handling Philosophy
- User-facing: Friendly message + expandable technical details
- Logging: Winston with rotating files (`app.log`, `error.log`)
- Retries: Automatic for network/API failures, manual for validation errors
- State preservation: Failed items retain all data for manual retry

## API Integration Details

### OpenRouter (Gemini 2.0 Pro)
- Model ID: `google/gemini-2.0-pro`
- Vision analysis: Multimodal input (image + text)
- Image generation: Text-to-image with 1080x1920 output
- Temperature: 0.7 for background generation
- Timeout: 30 seconds

### Blotato API
- Base URL: Configurable via `BLOTATO_API_BASE_URL`
- Authentication: Bearer token in `Authorization` header
- Key endpoints:
  - `POST /v2/posts` - Schedule story
  - `GET /v2/posts/{postId}` - Check status
  - `DELETE /v2/posts/{postId}` - Unschedule
- Timeout: 15 seconds

## Testing Strategy

**Unit Tests:**
- File locking utilities
- Status transition validation
- Date parsing (multiple formats)
- Color extraction

**Integration Tests:**
- API route handlers
- Mock OpenRouter/Blotato responses
- Image composition pipeline
- Concurrent access to history.json

**Manual Testing Checklist:**
- Upload → Generate → Schedule flow
- Network failure scenarios
- Concurrent user simulation
- Rate limit behavior

## Security Considerations

- API keys: Store in `.env`, never commit (ensure `.gitignore` includes `.env`)
- File uploads: Validate via Sharp (not MIME type), reject >10MB
- Input validation:
  - Dates must be future for scheduling
  - URLs must be HTTPS
  - Meta descriptions max 500 chars
- Filename sanitization: Remove special characters before storage

## Environment Variables

Required in `.env`:
```bash
OPENROUTER_API_KEY=<key>
BLOTATO_API_KEY=<key>
BLOTATO_API_BASE_URL=https://api.blotato.com
OPENROUTER_MAX_CALLS_PER_MINUTE=20
NODE_ENV=production
PORT=3000
```

## Common Development Patterns

### Adding a New Status State
1. Update status type definition in types
2. Add transition validation in `lib/history.ts`
3. Update status badge styling in `AssetCard.tsx`
4. Add filtering option in gallery
5. Update state machine diagram in documentation

### Adding a New AI Refinement Option
1. Extend refinement prompt template in `lib/openrouter.ts`
2. Add UI control in `EditModal.tsx`
3. Store refinement parameters in version metadata
4. Update version history display

### Modifying Image Composition
1. All changes go through `lib/composition.ts`
2. Test with various aspect ratios (portrait, landscape, square)
3. Verify safe zone calculations with overlay preview
4. Update version number when composition algorithm changes

## Reference: Instagram Story Specifications

- Aspect ratio: 9:16 (portrait)
- Resolution: 1080x1920 pixels (target), up to 1920x3840 (max)
- Safe zones:
  - Top: 250px (profile, timestamp)
  - Bottom: 180px (interaction buttons)
- Format: PNG recommended (preserves quality)
- Max file size: 30MB

## Source of Truth

`SPEC.md` (root directory) contains the complete technical specification. Refer to it for detailed requirements, API contracts, and business logic. This CLAUDE.md provides development-focused guidance and architecture overview.
