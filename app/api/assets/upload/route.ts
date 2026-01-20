import { NextRequest, NextResponse } from 'next/server';
import { addAsset } from '@/lib/history';
import { AssetMetadata } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import { config } from '@/lib/config';
import { uploadToS3, localPathToS3Key } from '@/lib/s3';

const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB
const ALLOWED_TYPES = ['image/png', 'image/jpg', 'image/jpeg'];
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

/**
 * POST /api/assets/upload
 * Handles multipart/form-data uploads for assets
 *
 * Request:
 * - assetFile: Image file (PNG, JPG, JPEG)
 * - metaDescription: String description
 * - date: Optional date string in YYYY-MM-DD format (defaults to current date)
 *
 * Response:
 * - success: true/false
 * - asset: AssetMetadata (on success)
 * - error: Error message (on failure)
 */
export async function POST(request: NextRequest) {
  try {
    // Parse FormData
    const formData = await request.formData();
    const assetFile = formData.get('assetFile') as File | null;
    const metaDescription = formData.get('metaDescription') as string | null;
    const date = formData.get('date') as string | null;

    // Validate assetFile exists
    if (!assetFile) {
      return NextResponse.json(
        { success: false, error: 'Missing assetFile' },
        { status: 400 }
      );
    }

    // Validate metaDescription exists
    if (!metaDescription || metaDescription.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Missing metaDescription' },
        { status: 400 }
      );
    }

    // Validate file format
    if (!ALLOWED_TYPES.includes(assetFile.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid file format. Allowed types: PNG, JPG, JPEG. Received: ${assetFile.type}`
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (assetFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large. Maximum size: 30MB. Received: ${(assetFile.size / 1024 / 1024).toFixed(2)}MB`
        },
        { status: 400 }
      );
    }

    // Generate unique asset ID
    const assetId = uuidv4();

    // Get file extension
    const extension = assetFile.name.split('.').pop() || 'png';

    // Create filename: {uuid}.{ext}
    const filename = `${assetId}.${extension}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    // Ensure uploads directory exists
    try {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }

    // Save file to disk
    try {
      const arrayBuffer = await assetFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await fs.writeFile(filePath, buffer);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        { status: 500 }
      );
    }

    // Upload to S3 if storage mode is hybrid or s3
    let assetUrl = `/uploads/${filename}`;
    if (config.storage?.mode === 'hybrid' || config.storage?.mode === 's3') {
      try {
        const s3Key = localPathToS3Key(`/uploads/${filename}`);
        const s3Url = await uploadToS3(filePath, s3Key, assetFile.type);
        assetUrl = s3Url;
        console.log(`[Upload] Uploaded to S3: ${s3Url}`);
      } catch (s3Error) {
        console.error('[Upload] S3 upload failed:', s3Error);
        // In hybrid mode, fall back to local URL
        // In s3 mode, this is a critical error
        if (config.storage?.mode === 's3') {
          return NextResponse.json(
            {
              success: false,
              error: `Failed to upload to S3: ${s3Error instanceof Error ? s3Error.message : 'Unknown error'}`
            },
            { status: 500 }
          );
        }
      }
    }

    // Process date field: validate if provided, otherwise use current date
    let assetDate: string;
    if (date && date.trim()) {
      // Validate YYYY-MM-DD format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
        return NextResponse.json(
          { success: false, error: 'Invalid date format. Use YYYY-MM-DD format.' },
          { status: 400 }
        );
      }
      assetDate = date.trim();
    } else {
      // Default to current date
      assetDate = new Date().toISOString().split('T')[0];
    }

    // Create AssetMetadata object
    const asset: AssetMetadata = {
      id: assetId,
      date: assetDate,
      asset_url: assetUrl,
      meta_description: metaDescription.trim(),
      status: 'Draft',
      created_at: new Date().toISOString(),
      versions: []
    };

    // Add asset to history
    try {
      await addAsset(asset);
    } catch (error) {
      // If history update fails, try to clean up the uploaded file
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        // Ignore cleanup errors
      }

      return NextResponse.json(
        {
          success: false,
          error: `Failed to update history: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        { status: 500 }
      );
    }

    // Return success response
    return NextResponse.json(
      {
        success: true,
        asset: asset
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    );
  }
}
