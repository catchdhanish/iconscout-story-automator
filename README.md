# IconScout Story Automator

A comprehensive dashboard application for automating the creation and scheduling of "Freebie of the Day" Instagram Stories for the IconScout team. This tool streamlines the entire workflow from asset upload through AI-powered composition to automated scheduling.

## Overview

The IconScout Story Automator is an internal dashboard that simplifies and automates the process of creating Instagram Stories with AI-generated backgrounds. It handles asset management, intelligent image analysis, background generation using advanced AI models, story composition, and scheduling through the Blotato API.

## Features

- **Asset Upload and Management** - Secure upload and version control for images with metadata tracking
- **AI-Powered Background Generation** - Uses OpenRouter (Gemini 2.0 Pro) for intelligent background creation
- **Story Composition** - Automatically composes story layouts with dominant color extraction and styling
- **Automated Scheduling** - Integrates with Blotato API for direct Instagram Story scheduling
- **Dashboard Interface** - User-friendly gallery view and upload interface
- **Version Control** - Maintains multiple versions of generated backgrounds per asset
- **History Tracking** - Complete audit trail with file-based persistence and file locking
- **Error Handling** - Comprehensive error tracking and retry mechanism

## Prerequisites

Before you begin, ensure you have the following:

- **Node.js** 18 or higher
- **npm** or **yarn** package manager
- **OpenRouter API Key** - Get it from [https://openrouter.ai/keys](https://openrouter.ai/keys)
- **Blotato API Key** - Get it from [https://my.blotato.com/settings/api](https://my.blotato.com/settings/api)
- **Instagram Account** - Connected to your Blotato account
- **Disk Space** - For storing uploaded images and generated backgrounds

## Installation

Follow these steps to set up the project locally:

```bash
# Clone the repository
git clone https://github.com/catchdhanish/iconscout-story-automator.git
cd iconscout-story-automator

# Install dependencies
npm install

# Create environment configuration
cp .env.example .env

# Edit .env with your API keys and configuration
nano .env
# or use your preferred editor

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`

## Configuration

All configuration is managed through environment variables. Copy `.env.example` to `.env` and fill in the required values:

### Blotato API Configuration

```
BLOTATO_API_KEY=<your-blotato-api-key-here>
```
- Get your API key from: https://my.blotato.com/settings/api
- This is required for Instagram Story scheduling functionality

```
BLOTATO_API_BASE_URL=https://api.blotato.com
```
- Base URL for Blotato API requests (default provided)

```
BLOTATO_ACCOUNT_ID=<your-instagram-account-id-here>
```
- Your Instagram account ID registered with Blotato
- Used for scheduling stories to the correct account

### OpenRouter API Configuration

```
OPENROUTER_API_KEY=<your-openrouter-api-key-here>
```
- Get your API key from: https://openrouter.ai/keys
- Required for AI-powered background generation

```
OPENROUTER_MAX_CALLS_PER_MINUTE=20
```
- Rate limit for OpenRouter API calls
- Adjust based on your API plan

### Application Configuration

```
NEXT_PUBLIC_BASE_URL=<your-domain-here>
```
- Public URL of your deployed application
- Used for generating asset URLs in responses

```
NODE_ENV=production
```
- Set to `development` for development, `production` for deployment

```
PORT=3000
```
- Port the application runs on

### Security Configuration

```
CRON_SECRET=<generate-a-secure-random-string>
```
- Secret token for securing cron job endpoints
- Generate a secure random string for production use
- Example: `openssl rand -base64 32`

## Usage

### Dashboard

1. **Open the Dashboard** - Navigate to `http://localhost:3000` in your browser
2. **View Assets** - Browse all uploaded assets in the gallery
3. **Filter and Search** - Use the interface to find specific assets
4. **View Asset Details** - Click on an asset to see its metadata, versions, and scheduling status

### Uploading Assets

1. **Navigate to Upload Page** - Click "Upload" or go to `/upload`
2. **Select Image File** - Choose a PNG or JPG image (max 30MB)
3. **Add Description** - Provide a meta description for the asset
4. **Set Date** - Optionally set a specific date (defaults to today)
5. **Submit** - Upload the asset to the system

### Generating Backgrounds

1. **Select an Asset** - Choose an asset from the dashboard
2. **Generate Background** - Request AI-powered background generation
3. **Review Versions** - View multiple generated background versions
4. **Select Version** - Choose the best version for publishing
5. **Refine if Needed** - Request refinements using custom prompts

### Scheduling Stories

1. **Navigate to Asset** - Open an asset in the dashboard
2. **Confirm Composition** - Review the story composition preview
3. **Schedule** - Click "Schedule" and set the publish time
4. **Confirm** - The story will be scheduled on Instagram via Blotato

## API Endpoints

### Assets Management

#### POST `/api/assets/upload`
Upload a new asset with metadata.

**Request:**
- `Content-Type: multipart/form-data`
- `assetFile` (File) - Image file (PNG, JPG, JPEG) - max 30MB
- `metaDescription` (string) - Description of the asset
- `date` (string, optional) - Date in YYYY-MM-DD format (defaults to today)

**Response:**
```json
{
  "success": true,
  "asset": {
    "id": "uuid",
    "date": "2025-01-09",
    "asset_url": "/uploads/{id}/original.png",
    "meta_description": "Asset description",
    "status": "Draft",
    "created_at": "2025-01-09T10:30:00Z",
    "versions": [],
    "active_version": null
  }
}
```

#### GET `/api/assets`
Retrieve all assets with pagination support.

**Query Parameters:**
- `page` (number, optional) - Page number (default: 1)
- `limit` (number, optional) - Items per page (default: 10)

**Response:**
```json
{
  "success": true,
  "assets": [...],
  "total": 50,
  "page": 1,
  "limit": 10
}
```

#### GET `/api/assets/[assetId]`
Retrieve a specific asset with full metadata.

**Response:**
```json
{
  "success": true,
  "asset": {
    "id": "uuid",
    "date": "2025-01-09",
    "status": "Ready",
    "versions": [{...}],
    "blotato_post_id": "post_id",
    "scheduled_time": "2025-01-09T12:00:00Z"
  }
}
```

#### DELETE `/api/assets/[assetId]`
Delete an asset and all its versions.

**Response:**
```json
{
  "success": true,
  "message": "Asset deleted successfully"
}
```

### Background Generation

#### POST `/api/assets/[assetId]/background`
Generate or refine an AI background for an asset.

**Request Body:**
```json
{
  "action": "generate" | "refine",
  "refinement_prompt": "Optional prompt for refinement"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Background generation started",
  "job_id": "job_uuid"
}
```

### Scheduling

#### POST `/api/assets/[assetId]/schedule`
Schedule the asset as an Instagram Story.

**Request Body:**
```json
{
  "scheduled_time": "2025-01-09T12:00:00Z",
  "caption": "Optional caption text"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Story scheduled successfully",
  "blotato_post_id": "post_id",
  "scheduled_at": "2025-01-09T12:00:00Z"
}
```

## Project Architecture

### Directory Structure

```
/app
  /api           - Next.js API routes for backend endpoints
    /assets      - Asset management endpoints
  /components    - React components (AssetCard, etc.)
  /layout.tsx    - Root layout component
  /page.tsx      - Dashboard home page
  /upload        - Asset upload page
/components
  /AssetCard.tsx - Reusable asset card component
/lib
  /api           - API client utilities
  /history.ts    - History and persistence management
  /types.ts      - TypeScript type definitions
  /blotato.ts    - Blotato API client
  /composition.ts - Story composition logic
  /openrouter.ts - OpenRouter API client
  /config.ts     - Configuration utilities
  /utils         - Utility functions
/public
  /uploads       - Asset images and generated backgrounds storage
/__tests__       - Test suite (Jest)
```

### Key Components

- **Frontend**: Next.js App Router with React components
- **Backend**: Next.js API routes with Node.js runtime
- **Storage**: Local filesystem with file locking for concurrent access
- **AI Integration**: OpenRouter API for Gemini model access
- **External APIs**: Blotato for Instagram scheduling
- **Logging**: Winston logger with rotating file output

## Development

### Available Scripts

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm lint

# Run tests
npm test
```

### Development Server

```bash
npm run dev
```

- Starts Next.js dev server at `http://localhost:3000`
- Hot module reloading enabled
- Check console for any errors

### Code Quality

- **TypeScript** - Full type safety throughout the codebase
- **ESLint** - Configured for Next.js best practices
- **Prettier** - Code formatting (if configured)

## Testing

The project includes a comprehensive test suite using Jest and React Testing Library.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Test Structure

Tests are located in `/__tests__` directory and cover:
- API endpoint functionality
- File upload and validation
- Background generation logic
- History and persistence
- Error handling and edge cases

### Test Coverage

Key areas tested:
- Asset upload validation (file type, size)
- API response formats
- History file operations
- Blotato API integration
- OpenRouter API calls
- Composition generation

## Deployment

### Prerequisites for Deployment

- Node.js 18+ runtime environment
- Environment variables configured
- Persistent storage for assets (filesystem or cloud storage)
- API keys for Blotato and OpenRouter

### Deployment Steps

#### Using Vercel (Recommended for Next.js)

1. **Prepare Repository**
   ```bash
   git push origin main
   ```

2. **Deploy to Vercel**
   - Connect repository at https://vercel.com
   - Add environment variables from `.env`
   - Deploy

3. **Configure Storage** (for persistent file storage)
   - Use Vercel KV for distributed caching
   - Or implement cloud storage integration (AWS S3, Google Cloud Storage)

#### Using Self-Hosted Server

1. **Build Production Bundle**
   ```bash
   npm run build
   ```

2. **Set Environment Variables**
   ```bash
   export NODE_ENV=production
   export BLOTATO_API_KEY=<your-key>
   export OPENROUTER_API_KEY=<your-key>
   # ... other variables
   ```

3. **Start Server**
   ```bash
   npm start
   ```

4. **Use Process Manager** (recommended)
   ```bash
   npm install -g pm2
   pm2 start npm --name "story-automator" -- start
   pm2 save
   ```

#### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t story-automator .
docker run -p 3000:3000 -e NODE_ENV=production story-automator
```

### Environment Configuration for Production

Before deploying, ensure all environment variables are set:

```bash
# Check all required variables
grep "process.env\." app/**/*.ts lib/**/*.ts | sort -u
```

### Monitoring

- Check Winston logs at `logs/app.log` and `logs/error.log`
- Monitor API response times and error rates
- Track history.json file size and access patterns
- Verify file lock cleanup

## Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Use a different port
PORT=3001 npm run dev
```

**File Permission Errors**
```bash
# Ensure uploads directory exists and is writable
mkdir -p public/uploads
chmod 755 public/uploads
```

**API Key Issues**
- Verify API keys in `.env` file
- Check API key validity in respective dashboards
- Ensure rate limits not exceeded

**Background Generation Failures**
- Check OpenRouter API status and rate limits
- Verify API key has sufficient credits
- Check logs in `logs/error.log`

### Debug Mode

Enable detailed logging:
```bash
DEBUG=* npm run dev
```

## License

ISC - See LICENSE file for details

## Support

For issues and feature requests, visit the [GitHub repository](https://github.com/catchdhanish/iconscout-story-automator/issues)

## Contributing

This is an internal IconScout project. For contributions, contact the development team.

---

**Last Updated:** January 2025
**Version:** 1.0.0
