# IconScout Story Automator (ISA) - Complete Technical Specification

## 1. Project Overview

**Goal:** An internal dashboard for the IconScout team to automate the creation and scheduling of "Freebie of the Day" Instagram Stories.

**Source of Truth:** This document defines the complete architecture, implementation details, and business logic for autonomous development.

**Deployment Target:** Self-hosted Node.js server with persistent local filesystem storage.

---

## 2. Technical Stack

### Core Framework
- **Framework:** Next.js 14+ (App Router)
- **Runtime:** Node.js (self-hosted server environment)
- **Styling:** Tailwind CSS
- **UI Components:** react-hot-toast for notifications

### AI & Image Processing
- **AI Provider:** OpenRouter API (accessing Gemini models)
- **AI Model:** Gemini 2.0 Pro (for both vision analysis and image generation)
- **Image Processing:** `sharp` library for server-side composition and SVG rasterization
- **Color Extraction:** `node-vibrant` (Vibrant.js) for dominant color extraction

### External APIs
- **Scheduling API:** Blotato API ([Reference](https://help.blotato.com/api/start))
  - Authentication: Bearer token (standard REST API assumptions)
  - Base URL: Configurable via environment variable

### Storage & State Management
- **Primary Storage:** Local filesystem (`/public/uploads/` for images)
- **State Persistence:** `history.json` file with file locking
- **File Locking:** `proper-lockfile` npm package for concurrent access safety
- **Version History:** Subdirectory structure per asset (`/uploads/{assetId}/v1.png, v2.png...`)

### Logging & Monitoring
- **Logging:** Winston logger with rotating file output (`app.log`, `error.log`)
- **Error Tracking:** Structured logs with timestamps, severity levels, and context

### Background Processing
- **Queue System:** Simple in-memory queue using Next.js API routes
- **Job Processing:** Sequential processing via Node.js event loop
- **Note:** Jobs do not persist across server restarts (acceptable for internal tool)

---

## 3. Environment Configuration

### Required Environment Variables
```bash
# API Credentials (hardcoded during development - no user input required)
OPENROUTER_API_KEY=<api-key>
BLOTATO_API_KEY=<api-key>
BLOTATO_API_BASE_URL=https://api.blotato.com

# Rate Limiting
OPENROUTER_MAX_CALLS_PER_MINUTE=20

# Application Settings
NODE_ENV=production
PORT=3000
```

### First-Run Experience
- **Auto-detection:** If configuration is incomplete (e.g., time zone not set), show inline banners on dashboard
- **Configuration Modal:** Click banner to open settings modal for gradual setup
- **API Keys:** Pre-configured during deployment - no user input required
- **Time Zone:** User selects from dropdown on first access, stored in local config

---

## 4. Core Workflow (Detailed Step-by-Step)

### Step 1: Data Ingestion & Upload

#### 1.1 Dual-Mode Upload Interface

**CSV Upload Mode:**
- **File Format:** Flexible CSV parsing supporting multiple date formats
  - Accepts: ISO 8601 (YYYY-MM-DD), MM/DD/YYYY, DD-MM-YYYY, DD/MM/YYYY
  - Headers: Recommended but not required if 3 columns detected
  - Columns: `date`, `asset_url`, `meta_description`
- **Parsing Logic:**
  - Attempt intelligent date parsing using date library (e.g., `date-fns`)
  - Show preview table before confirmation with detected date format
  - Allow row-by-row error correction if parsing fails

**Manual Entry Mode:**
- **Form Type:** Batch form with "Add Another" button
- **Fields:**
  - Date picker (with time zone selector)
  - Asset URL input (text field with URL validation)
  - Meta description textarea (multi-line)
- **Workflow:**
  - Click "+ Add Another Asset" to append additional form sections
  - Submit all entries at once as a batch
  - Show summary before final submission

#### 1.2 Deep Validation Pipeline
When URLs are submitted (CSV or manual):

1. **HEAD Request Check:**
   - Verify URL responds with 200 status code
   - Check `Content-Type` header is `image/*`

2. **Full Download & Verification:**
   - Download complete image file
   - Verify format using `sharp` (PNG, JPG, WebP, SVG)
   - Store in `/public/uploads/temp/` during validation
   - Check file size (reject if >10MB)

3. **Duplicate Detection:**
   - **URL Duplicate Check:** Query `history.json` for matching `asset_url`
   - **Date Duplicate Check:** Query `history.json` for matching scheduled date
   - If duplicates found:
     - Show warning modal: "Asset URL already uploaded" or "Date already scheduled"
     - Provide options: "Continue Anyway" or "Cancel"

4. **Initial State:**
   - All successfully validated items set to `Draft` status
   - Store metadata in `history.json`:
     ```json
     {
       "id": "uuid-v4",
       "date": "2024-01-15",
       "asset_url": "https://...",
       "meta_description": "A minimalist calendar icon",
       "status": "Draft",
       "created_at": "2024-01-08T10:00:00Z",
       "versions": []
     }
     ```

#### 1.3 Asset Format Support
- **Supported Formats:** PNG, JPG, WebP, SVG
- **SVG Handling:**
  - Convert to high-resolution PNG (2x scale: 2160x3840) using `sharp`
  - Preserve aspect ratio during rasterization
  - Cache converted PNG to avoid re-processing

---

### Step 2: AI Visual Generation & Composition

#### 2.1 Asset Analysis (Vision)

**Purpose:** Understand the asset visually to inform background generation prompt.

**Process:**
1. Send asset image to OpenRouter API with Gemini 2.0 Pro vision model
2. **Prompt Template:**
   ```
   Analyze this image and describe it in detail. Include:
   - What the image depicts (icon, illustration, graphic, etc.)
   - Visual style (minimalist, detailed, abstract, photorealistic, etc.)
   - Key visual elements or subjects
   - Mood or tone (professional, playful, serious, etc.)

   Provide a concise description in 2-3 sentences.
   ```
3. **Response:** Store AI-generated description as `asset_vision_description` in metadata
4. **Error Handling:**
   - If API fails: Show error toast, mark item as "Failed Vision Analysis"
   - User can manually retry or provide custom description
   - Error details logged to Winston with full API response

#### 2.2 Color Extraction

**Purpose:** Extract dominant colors from asset to guide background generation.

**Process:**
1. Use `node-vibrant` to analyze asset image
2. Extract 3-5 dominant colors (hex codes):
   - Vibrant color
   - Muted color
   - Dark vibrant
   - Light vibrant
   - If fewer than 5 unique colors detected, use available set
3. **Store:** `dominant_colors: ["#FF5733", "#33A1FF", "#1A1A1A"]` in metadata

#### 2.3 Background Generation Prompt Template

**Structure:** System prompt + User prompt split

**System Prompt:**
```
You are an expert background designer for Instagram Stories. Your task is to generate a 9:16 aspect ratio background design that complements the provided asset.

CRITICAL RULES:
- Generate ONLY the background design - DO NOT attempt to draw the asset, logo, text, or any specific objects
- The background should be abstract, gradient-based, or use organic shapes/patterns
- Respect Instagram Story safe zones: top 250px and bottom 180px should avoid critical visual elements
- The center 70% of the canvas (756x1344 pixels out of 1080x1920) is reserved for the asset overlay
- Design the background to enhance, not compete with, the asset that will be placed on top
- Output resolution: 1080x1920 pixels
```

**User Prompt Template:**
```
Create a background for an Instagram Story featuring this asset:

Asset Description: {asset_vision_description}
Meta Description: {meta_description}
Suggested Color Palette (use as guidance, not strict requirement): {dominant_colors}

Design a complementary background that enhances this asset while allowing it to remain the focal point.
```

**API Call:**
- **Model:** Gemini 2.0 Pro (via OpenRouter)
- **Parameters:**
  - `temperature`: 0.7 (creative but controlled)
  - `max_tokens`: 2048
- **Response:** Base64-encoded image or URL to generated image
- **Storage:** Save to `/public/uploads/{assetId}/background_raw.png`

**Error Handling:**
- **Failure Mode:** Immediate failure notification with manual retry (no automatic retries)
- **Error Modal:**
  - Title: "Background Generation Failed"
  - Message: User-friendly description (e.g., "OpenRouter API is unavailable")
  - **Details Toggle:** Expandable section showing technical error (stack trace, API response)
  - Action: "Retry" button

#### 2.4 Composition Engine

**Purpose:** Layer the original asset onto the AI-generated background.

**Process:**

1. **Load Components:**
   - Background: AI-generated image (`background_raw.png`)
   - Asset: Original uploaded asset (PNG/JPG/WebP or rasterized SVG)

2. **Canvas Dimensions:** 1080x1920 pixels (9:16 aspect ratio)

3. **Safe Zone Calculation:**
   - **Instagram UI Safe Zones:**
     - Top: 250px (profile picture, account name, timestamp)
     - Bottom: 180px (interaction buttons, swipe-up area)
   - **Asset Safe Zone (Center 70%):**
     - Width: 756px (1080 * 0.7)
     - Height: 1344px (1920 * 0.7)
     - X Offset: 162px ((1080 - 756) / 2)
     - Y Offset: 288px ((1920 - 1344) / 2)

4. **Asset Scaling Logic:**
   - Calculate asset dimensions while preserving aspect ratio
   - Scale asset to fit within 756x1344px safe zone
   - If asset is portrait: scale to max height 1344px
   - If asset is landscape: scale to max width 756px
   - If asset is square: scale to min(756px, 1344px)
   - Center asset within safe zone

5. **Composition Using `sharp`:**
   ```javascript
   await sharp(backgroundPath)
     .composite([
       {
         input: scaledAssetBuffer,
         top: assetY,
         left: assetX,
       }
     ])
     .toFile(`/public/uploads/${assetId}/v1.png`);
   ```

6. **Transparency Handling:**
   - PNG assets with transparency: Preserve alpha channel
   - JPG assets: No transparency handling needed
   - Ensure background is opaque (no transparency in final output)

7. **Version Management:**
   - Initial composition saved as `v1.png`
   - Store version metadata:
     ```json
     {
       "versions": [
         {
           "version": 1,
           "created_at": "2024-01-08T10:15:00Z",
           "prompt_used": "Create a background...",
           "file_path": "/uploads/{assetId}/v1.png"
         }
       ]
     }
     ```

**Note:** No logo overlay required - Instagram displays profile logo automatically in top-left corner.

#### 2.5 Review/Edit Interface (Gallery Grid)

**Layout: Rich Card Grid with Infinite Scroll**

**Card Components:**
- **Thumbnail:** Generated story visual (256x455px preview maintaining 9:16 ratio)
- **Date Badge:** Scheduled date in user's selected time zone
- **Status Badge:** Color-coded pill (Draft: gray, Ready: blue, Scheduled: green, Published: purple, Failed: red)
- **Meta Description:** Truncated snippet (first 60 characters) with "..." if longer
- **Prompt Preview:** "View Prompt" link (opens modal with full prompt text)
- **Action Buttons:**
  - "Edit" button (primary)
  - "Approve" button (success color)
  - "Delete" button (danger color)

**Gallery Features:**

1. **Filtering:**
   - Status filter dropdown (All, Draft, Ready, Scheduled, Published, Failed)
   - Date range picker (from/to dates)
   - Filters applied client-side after data fetch

2. **Search:**
   - Search bar above grid
   - Full-text search across `meta_description` field
   - Real-time filtering as user types
   - Case-insensitive matching

3. **Sorting:**
   - Default: Most recent first (by `created_at`)
   - Options: Date ascending/descending, Status

4. **Loading States:**
   - Items marked "Processing" show spinner overlay on thumbnail
   - Skeleton cards while initial data loads

5. **Auto-Polling:**
   - Gallery polls API every 5 seconds to check for status updates
   - Only poll if items in "Processing" or "Pending" status exist
   - Stop polling when all items are in terminal states

**Edit Function (Refinement Workflow):**

1. **User Action:** Click "Edit" button on card
2. **Modal Opens:**
   - Shows current visual thumbnail
   - Text area: "Describe changes" (e.g., "Make colors darker", "Add warm tones")
   - "Previous Versions" section: Horizontal thumbnail carousel of past versions (if any)
   - Actions: "Regenerate" or "Cancel"

3. **Regeneration Queue:**
   - Refinement requests processed sequentially (one at a time)
   - Queue indicator: "Position 2 of 5 in queue"
   - Current item shows "Regenerating..." status

4. **New Version Creation:**
   - Regenerated background appended as new version (e.g., `v2.png`)
   - Version metadata includes refinement prompt:
     ```json
     {
       "version": 2,
       "created_at": "2024-01-08T10:30:00Z",
       "prompt_used": "Original prompt...",
       "refinement_prompt": "Make colors darker",
       "file_path": "/uploads/{assetId}/v2.png"
     }
     ```
   - Card updates to show new version as active

5. **Version History Gallery:**
   - Displayed as thumbnail carousel in edit modal
   - Click any version thumbnail to revert to that version
   - Revert action updates `active_version` pointer in metadata (does not delete newer versions)

**Bulk Approval:**

1. **Selection:**
   - Each card has checkbox in top-right corner
   - Click checkbox or press `Space` key when card focused
   - Selected cards highlighted with border

2. **Bulk Actions Bar:**
   - Appears at bottom when items selected
   - Shows count: "3 items selected"
   - Actions:
     - "Approve Selected" (moves to Ready state)
     - "Delete Selected" (with confirmation modal)
     - "Clear Selection"

3. **Asynchronous Processing:**
   - Clicking "Approve Selected" immediately:
     - Changes status to "Ready (Processing)"
     - Adds items to background job queue
   - Background jobs handle final composition verification
   - Gallery auto-polls to show progress
   - Toast notification: "3 items approved and processing"

**Keyboard Shortcuts:**
- **Space:** Select/deselect focused card
- **A:** Approve all selected items
- **D:** Delete selected items (with confirmation)
- **Arrow Keys:** Navigate grid focus
- **Enter:** Open edit modal for focused card
- **?:** Show keyboard shortcuts help modal (overlay)

---

### Step 3: Scheduling & Go-Live

#### 3.1 Final Review Interface

**Layout: Calendar + List View**

**Calendar View:**
- Month view with days showing story count per date
- Click date to expand and see all stories scheduled for that day
- Color coding: Draft (gray), Ready (blue), Scheduled (green)
- Multi-story dates show stacked indicator (e.g., "3 stories")

**List View:**
- Table format with columns:
  - Thumbnail (small)
  - Date/Time (in selected time zone + UTC in parentheses)
  - Meta Description
  - Status
  - Actions (Schedule, Edit, Delete)
- Sortable by date, status
- Pagination: 50 items per page

#### 3.2 Time Zone Management

**User Time Zone Selection:**
- Dropdown in top-right of scheduling interface
- Shows common time zones + auto-detect browser time zone option
- Selected zone persists to user preferences (stored in localStorage)

**Display Format:**
- All dates/times shown in selected time zone
- UTC conversion shown in parentheses for clarity
- Example: "Jan 15, 2024 9:00 AM IST (3:30 AM UTC)"

**Blotato API Submission:**
- Always convert selected time to ISO 8601 UTC string
- Example: `"scheduledTime": "2024-01-15T03:30:00Z"`

#### 3.3 Scheduling Workflow

**User Action: Schedule Single Item**

1. **Prerequisites:**
   - Item status must be "Ready"
   - Date/time must be in future

2. **User Clicks "Schedule" Button:**
   - Opens confirmation modal:
     - Preview thumbnail
     - Scheduled time (in user TZ + UTC)
     - Warning if duplicate date detected: "Another story already scheduled for this date. Continue?"
     - Actions: "Confirm Schedule" or "Cancel"

3. **API Call to Blotato:**
   ```javascript
   POST /v2/posts
   Headers:
     Authorization: Bearer {BLOTATO_API_KEY}
     Content-Type: application/json
   Body:
     {
       "mediaType": "story",
       "mediaUrl": "https://yourdomain.com/uploads/{assetId}/v{n}.png",
       "scheduledTime": "2024-01-15T03:30:00Z"
     }
   ```

4. **Response Handling:**

   **Success (200 OK):**
   - Response includes `postId` from Blotato
   - Update metadata:
     ```json
     {
       "status": "Scheduled",
       "blotato_post_id": "blot_abc123",
       "scheduled_time": "2024-01-15T03:30:00Z",
       "scheduled_at": "2024-01-08T10:45:00Z"
     }
     ```
   - Show toast: "Scheduled successfully for Jan 15, 9:00 AM IST"
   - Update gallery card status

   **Failure (4xx/5xx or network error):**
   - **Automatic Retry with Exponential Backoff:**
     1. Wait 5 seconds → Retry #1
     2. If fail, wait 15 seconds → Retry #2
     3. If fail, wait 45 seconds → Retry #3
   - **All Retries Failed:**
     - Update status to "Schedule Failed"
     - Store error details in metadata:
       ```json
       {
         "status": "Schedule Failed",
         "error": {
           "message": "Network timeout",
           "details": "Full API response...",
           "failed_at": "2024-01-08T10:45:00Z",
           "retry_count": 3
         }
       }
       ```
     - Show error modal:
       - Title: "Scheduling Failed"
       - Message: "Unable to schedule story after 3 attempts"
       - Details toggle with technical error
       - Action: "Retry Scheduling" button

5. **User Can Manually Retry:**
   - Failed items show "Retry" button in gallery
   - Clicking "Retry" attempts scheduling again (with same backoff logic)

**User Action: Bulk Schedule**

1. Select multiple "Ready" items using checkboxes
2. Click "Schedule Selected" in bulk actions bar
3. Each item processed sequentially (to avoid rate limiting)
4. Progress modal shows:
   - "Scheduling 3 of 10 items..."
   - List of items with status (Pending, Success, Failed)
5. Summary toast at end: "8 scheduled successfully, 2 failed"

#### 3.4 History & Tracking

**State Machine:**
- `Draft` → `Ready` → `Scheduled` → `Published`
- Manual transitions allowed with validation:
  - Can move `Scheduled` back to `Draft` (unscheduling required)
  - Cannot move `Published` backward
  - Confirmation modal for destructive transitions

**Metadata Structure in `history.json`:**
```json
{
  "id": "uuid",
  "date": "2024-01-15",
  "asset_url": "https://...",
  "meta_description": "...",
  "status": "Scheduled",
  "created_at": "2024-01-08T10:00:00Z",
  "updated_at": "2024-01-08T10:45:00Z",
  "asset_vision_description": "A minimalist calendar icon...",
  "dominant_colors": ["#FF5733", "#33A1FF"],
  "active_version": 2,
  "versions": [
    {
      "version": 1,
      "created_at": "2024-01-08T10:15:00Z",
      "prompt_used": "...",
      "file_path": "/uploads/{assetId}/v1.png"
    },
    {
      "version": 2,
      "created_at": "2024-01-08T10:30:00Z",
      "prompt_used": "...",
      "refinement_prompt": "Make colors darker",
      "file_path": "/uploads/{assetId}/v2.png"
    }
  ],
  "blotato_post_id": "blot_abc123",
  "scheduled_time": "2024-01-15T03:30:00Z",
  "scheduled_at": "2024-01-08T10:45:00Z"
}
```

---

## 5. Post-Publishing & Management Dashboard

### 5.1 Dashboard Layout

**Top Section: Analytics Panel**
- **Key Metrics (Cards):**
  - Total Stories Created (all time)
  - Stories Scheduled This Month
  - Stories Published This Month
  - Success Rate (successful schedules / total attempts)
- **Charts (if time permits):**
  - Line chart: Stories published per week (last 12 weeks)
  - Pie chart: Status distribution (Draft, Ready, Scheduled, Published)

**Main Section: Unified Gallery/Table**
- Same gallery grid from Step 2, but includes all statuses
- Filter by status to view specific subsets
- Search functionality across meta_descriptions

**Sidebar: Quick Actions**
- "Upload New Assets" button
- "Export History" button (downloads `history.json`)
- "Settings" button (time zone, rate limits, API health check)

### 5.2 Status Definitions

- **Draft:** Uploaded, background generated, pending user approval
- **Ready:** Approved by user, awaiting scheduling action
- **Scheduled:** Successfully pushed to Blotato, awaiting publication time
- **Published:** Post time has passed, confirmed via Blotato API status check
- **Failed:** Error during processing (vision, generation, composition, or scheduling)
- **Archived:** Manually archived by user (hidden by default unless "Show Archived" toggled)

### 5.3 Unscheduling Workflow

**User Action:**
1. Click "Unschedule" button on card with "Scheduled" status
2. Confirmation modal:
   - "Are you sure you want to unschedule this story?"
   - "This will cancel the scheduled post on Blotato and move it back to Draft."
   - Actions: "Confirm Unschedule" or "Cancel"

**API Call:**
```javascript
DELETE /v2/posts/{postId}
Headers:
  Authorization: Bearer {BLOTATO_API_KEY}
```

**Response Handling:**
- **Success:**
  - Update status to `Draft`
  - Remove `blotato_post_id` and `scheduled_time` from metadata
  - Keep all version history and generated visuals intact
  - Toast: "Story unscheduled successfully"

- **Failure:**
  - Show error modal with retry option
  - If Blotato returns 404 (post not found), assume already deleted and proceed with local status update

### 5.4 Publication Verification (Automated)

**Background Polling Job:**
- **Frequency:** Every 5 minutes
- **Target:** Items with status "Scheduled" and `scheduled_time` in the past

**Process:**
1. Query Blotato API for each scheduled post:
   ```javascript
   GET /v2/posts/{postId}
   Headers:
     Authorization: Bearer {BLOTATO_API_KEY}
   ```

2. Check response `status` field:
   - If `"published"` or `"live"`: Update local status to `Published`
   - If `"scheduled"` and past due: Log warning but don't change (Blotato may be delayed)
   - If `"failed"`: Update status to `Schedule Failed` with error details

3. **Metadata Update:**
   ```json
   {
     "status": "Published",
     "published_at": "2024-01-15T03:30:00Z",
     "verified_at": "2024-01-15T03:35:00Z"
   }
   ```

4. **Logging:**
   - Winston logs each verification check with result
   - Failed verifications logged as warnings for manual review

---

## 6. Concurrency & Data Integrity

### 6.1 File Locking with `proper-lockfile`

**Purpose:** Prevent concurrent writes to `history.json` from corrupting data.

**Implementation:**
```javascript
const lockfile = require('proper-lockfile');

async function updateHistory(updateFn) {
  const lockPath = '/path/to/history.json';
  let release;

  try {
    // Acquire lock with stale detection
    release = await lockfile.lock(lockPath, {
      retries: {
        retries: 10,
        minTimeout: 100,
        maxTimeout: 2000,
      },
      stale: 10000, // 10 seconds
    });

    // Read current history
    const history = JSON.parse(fs.readFileSync(lockPath, 'utf8'));

    // Apply update
    const updatedHistory = updateFn(history);

    // Write atomically
    fs.writeFileSync(lockPath, JSON.stringify(updatedHistory, null, 2));

  } finally {
    // Always release lock
    if (release) await release();
  }
}
```

**Retry Logic:**
- If lock acquisition fails after 10 retries, show error to user
- Log lock contention events to Winston for monitoring

### 6.2 Atomic Operations

**Status Transitions:**
- All status changes wrapped in file lock
- Validation performed before write:
  - Check current status matches expected state
  - Reject invalid transitions (e.g., Published → Draft)

**Optimistic Updates:**
- UI updates optimistically (immediate feedback)
- If backend operation fails, revert UI state
- Show error toast and re-fetch data

---

## 7. Rate Limiting & Cost Control

### 7.1 OpenRouter API Rate Limiting

**Configuration:**
- Environment variable: `OPENROUTER_MAX_CALLS_PER_MINUTE` (default: 20)

**Implementation:**
- In-memory queue for OpenRouter API calls
- Token bucket algorithm:
  - Bucket capacity: `OPENROUTER_MAX_CALLS_PER_MINUTE`
  - Refill rate: 1 token per (60 / limit) seconds
- Requests exceeding limit queued and processed when tokens available

**User Feedback:**
- If request queued due to rate limit, show toast:
  - "Rate limit reached. Your request is queued (position 3)"
- Queue position updates in real-time

### 7.2 Blotato API Error Handling

**Assumed Rate Limits:**
- Not specified in requirements; handle dynamically
- If Blotato returns 429 (Too Many Requests):
  - Read `Retry-After` header
  - Wait specified duration before retry
  - Show user: "Blotato rate limit hit. Retrying in 30 seconds..."

---

## 8. Error Handling & Logging

### 8.1 User-Facing Error Messages

**Design Principle:** User-friendly messages with expandable technical details.

**Modal Structure:**
```
┌─────────────────────────────────────┐
│ [!] Background Generation Failed     │
│                                     │
│ We couldn't generate a background   │
│ for this asset. This may be due to │
│ an API issue or network problem.    │
│                                     │
│ [▼ Show Technical Details]          │
│                                     │
│ [Retry]  [Cancel]                   │
└─────────────────────────────────────┘
```

**Expanded Details:**
```
Error: OpenRouter API timeout
Status: 504 Gateway Timeout
Timestamp: 2024-01-08T10:45:23Z
Request ID: req_abc123

Full Response:
{
  "error": "upstream service timeout",
  ...
}
```

### 8.2 Winston Logging Configuration

**Log Files:**
- `logs/app.log` (info and above, rotated daily, keep 14 days)
- `logs/error.log` (errors only, rotated daily, keep 30 days)

**Log Levels:**
- `error`: API failures, exceptions, critical issues
- `warn`: Rate limits hit, retries triggered, validation warnings
- `info`: Successful operations, status transitions
- `debug`: (dev only) Detailed request/response data

**Log Format:**
```
2024-01-08T10:45:23.123Z [info] Background generated successfully {
  "assetId": "uuid",
  "version": 1,
  "processingTime": "12.4s"
}
```

**Structured Logging:**
- All logs include contextual metadata (assetId, userId, requestId)
- Enables filtering and analysis in log viewers

---

## 9. Preview & Safe Zones

### 9.1 Safe Zone Overlay Preview

**Trigger:** Click "Preview" button on gallery card

**Modal Display:**
- **Center:** Full-size story visual (720x1280 scaled preview)
- **Overlays:**
  - Semi-transparent red overlay on top 250px (Instagram UI safe zone)
  - Semi-transparent red overlay on bottom 180px
  - Yellow dashed border showing 70% asset safe zone (center rectangle)
- **Labels:**
  - "Instagram UI" label in top/bottom red zones
  - "Asset Safe Zone" label in center

**Purpose:**
- Educate users on safe zone constraints
- Verify asset positioning before scheduling

---

## 10. Export & Backup

### 10.1 Manual Export Functionality

**Trigger:** Click "Export History" button in dashboard sidebar

**Process:**
1. Read entire `history.json`
2. Generate download link for JSON file
3. Filename: `iconscout-history-export-{YYYY-MM-DD}.json`
4. Browser downloads file immediately

**Use Cases:**
- Manual backup before major operations
- Data analysis in external tools
- Migration to new system

**No Automatic Cleanup:**
- `history.json` grows indefinitely
- Users responsible for manual archival if needed
- Recommend monthly exports for long-term storage

---

## 11. Development Guidelines

### 11.1 Code Organization (Next.js App Router)

**Directory Structure:**
```
/app
  /api
    /assets
      /upload/route.ts
      /[id]/route.ts
    /backgrounds
      /generate/route.ts
    /schedule
      /route.ts
    /history/route.ts
  /dashboard
    /page.tsx
  /upload
    /page.tsx
  /layout.tsx
  /page.tsx

/components
  /AssetCard.tsx
  /GalleryGrid.tsx
  /ScheduleCalendar.tsx
  /EditModal.tsx

/lib
  /openrouter.ts
  /blotato.ts
  /history.ts (file locking utilities)
  /composition.ts (sharp processing)
  /queue.ts (in-memory job queue)

/public
  /uploads
    /{assetId}
      /v1.png
      /v2.png
  /temp

history.json
```

### 11.2 Testing Strategy

**Unit Tests (Jest):**
- File locking utilities
- Status transition validation
- Date parsing logic
- Color extraction

**Integration Tests:**
- API route handlers
- OpenRouter API mocking
- Blotato API mocking
- Image composition pipeline

**Manual Testing:**
- End-to-end workflow (upload → generate → schedule)
- Error scenario testing (API failures, network issues)
- Concurrent user simulation

### 11.3 Performance Considerations

**Image Processing:**
- Use `sharp` for all operations (fastest Node.js image library)
- Process images sequentially to avoid memory spikes
- Monitor memory usage with Winston logs

**API Calls:**
- Implement timeouts (30s for OpenRouter, 15s for Blotato)
- Use connection pooling for HTTP requests

**Frontend:**
- Lazy load gallery cards (intersection observer)
- Debounce search input (300ms)
- Use Next.js Image component for optimized thumbnails

---

## 12. Security Considerations

### 12.1 API Key Management
- API keys hardcoded in `.env` file during development
- `.env` added to `.gitignore` (never committed)
- Production deployment: Keys injected via environment variables
- No API keys exposed to client-side code

### 12.2 File Upload Security
- Validate file types using `sharp` (not just MIME type)
- Reject files >10MB
- Sanitize filenames (remove special characters)
- Store uploads outside webroot (or serve via authenticated route)

### 12.3 Input Validation
- Validate all dates (reject past dates for scheduling)
- URL validation (must be HTTPS, check domain against blocklist if needed)
- Meta description length limits (max 500 characters)

---

## 13. Deployment Instructions

### 13.1 Prerequisites
- Node.js 18+ installed
- Self-hosted server with persistent storage
- OpenRouter API key
- Blotato API key

### 13.2 Setup Steps
1. Clone repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure:
   ```
   OPENROUTER_API_KEY=your_key
   BLOTATO_API_KEY=your_key
   BLOTATO_API_BASE_URL=https://api.blotato.com
   OPENROUTER_MAX_CALLS_PER_MINUTE=20
   ```
4. Create directories:
   ```bash
   mkdir -p public/uploads logs
   touch history.json
   echo "[]" > history.json
   ```
5. Build: `npm run build`
6. Start: `npm start` (or use PM2 for process management)

### 13.3 Process Management (Recommended: PM2)
```bash
pm2 start npm --name "iconscout-isa" -- start
pm2 save
pm2 startup
```

---

## 14. Future Enhancements (Out of Scope for v1)

- Multi-user authentication with role-based access
- Integration with IconScout's asset API for direct asset browsing
- A/B testing support (schedule multiple variants)
- Analytics integration (track story views, engagement)
- Webhook support for Blotato events (real-time publication confirmation)
- Mobile app version for on-the-go management
- AI-generated captions/hashtags for stories

---

## 15. Appendix

### 15.1 Gemini 2.0 Pro Model Details
- **Model ID (OpenRouter):** `google/gemini-2.0-pro`
- **Vision Capabilities:** Native multimodal (image + text input)
- **Image Generation:** Text-to-image via same model
- **Context Window:** 128k tokens
- **Output:** Base64 images or URLs

### 15.2 Blotato API Reference
- **Documentation:** https://help.blotato.com/api/start
- **Authentication:** Bearer token in `Authorization` header
- **Key Endpoints:**
  - `POST /v2/posts` - Schedule new post
  - `GET /v2/posts/{postId}` - Get post status
  - `DELETE /v2/posts/{postId}` - Cancel scheduled post
- **Response Format:** JSON with `postId`, `status`, `scheduledTime`, etc.

### 15.3 Instagram Story Specifications
- **Aspect Ratio:** 9:16 (portrait)
- **Resolution:** 1080x1920 pixels (minimum), 1920x3840 (maximum)
- **Safe Zones:**
  - Top: 250px (14% of height)
  - Bottom: 180px (9% of height)
  - Horizontal: Full width usable
- **File Size:** Max 30MB
- **Format:** JPG or PNG (PNG recommended for quality)

---

**End of Specification**

This document represents the complete, implementation-ready specification for the IconScout Story Automator based on the comprehensive interview conducted on January 8, 2024. All architectural decisions, technical choices, and business logic are defined for autonomous development by Claude Code.
