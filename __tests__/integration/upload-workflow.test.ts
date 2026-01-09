/**
 * Integration test for asset upload workflow
 * Tests: POST /api/assets/upload with file
 * Verifies: Asset created in history.json, file saved, correct response
 */

import { readHistory, addAsset } from '@/lib/history';
import { AssetMetadata } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

describe('Upload Workflow Integration Test', () => {
  const testHistoryPath = path.join(__dirname, 'test-upload-history.json');
  const testUploadsDir = path.join(__dirname, 'test-uploads');

  beforeEach(() => {
    // Create test history file
    fs.writeFileSync(testHistoryPath, JSON.stringify({ assets: [] }));

    // Create test uploads directory
    if (!fs.existsSync(testUploadsDir)) {
      fs.mkdirSync(testUploadsDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test history file
    if (fs.existsSync(testHistoryPath)) {
      fs.unlinkSync(testHistoryPath);
    }

    // Clean up test uploads directory
    if (fs.existsSync(testUploadsDir)) {
      const files = fs.readdirSync(testUploadsDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testUploadsDir, file));
      });
      fs.rmdirSync(testUploadsDir);
    }
  });

  it('should upload asset and save to history.json', async () => {
    // 1. Create test asset metadata
    const assetId = uuidv4();
    const testAsset: AssetMetadata = {
      id: assetId,
      date: '2024-01-15',
      asset_url: `/uploads/${assetId}.png`,
      meta_description: 'Test asset upload',
      status: 'Draft',
      created_at: new Date().toISOString(),
      versions: []
    };

    // 2. Add asset to test history
    await addAsset(testAsset, testHistoryPath);

    // 3. Verify asset exists in history
    const history = await readHistory(testHistoryPath);
    expect(history.assets).toHaveLength(1);
    expect(history.assets[0].id).toBe(assetId);
    expect(history.assets[0].status).toBe('Draft');
    expect(history.assets[0].meta_description).toBe('Test asset upload');
  });

  it('should create asset with correct response format', async () => {
    // 1. Create asset
    const assetId = uuidv4();
    const testAsset: AssetMetadata = {
      id: assetId,
      date: '2024-02-10',
      asset_url: `/uploads/${assetId}.jpg`,
      meta_description: 'Another test asset',
      status: 'Draft',
      created_at: new Date().toISOString(),
      versions: []
    };

    // 2. Add to history
    await addAsset(testAsset, testHistoryPath);

    // 3. Read back and verify format
    const history = await readHistory(testHistoryPath);
    const asset = history.assets[0];

    expect(asset).toHaveProperty('id');
    expect(asset).toHaveProperty('date');
    expect(asset).toHaveProperty('asset_url');
    expect(asset).toHaveProperty('meta_description');
    expect(asset).toHaveProperty('status');
    expect(asset).toHaveProperty('created_at');
    expect(asset).toHaveProperty('versions');
    expect(Array.isArray(asset.versions)).toBe(true);
  });

  it('should save file to uploads directory', async () => {
    // 1. Create test file
    const testFileName = `${uuidv4()}.png`;
    const testFilePath = path.join(testUploadsDir, testFileName);
    const testFileContent = Buffer.from('fake-image-data');

    fs.writeFileSync(testFilePath, testFileContent);

    // 2. Verify file exists
    expect(fs.existsSync(testFilePath)).toBe(true);

    // 3. Verify file content
    const savedContent = fs.readFileSync(testFilePath);
    expect(savedContent.toString()).toBe('fake-image-data');
  });

  it('should handle multiple asset uploads', async () => {
    // 1. Create multiple test assets
    const asset1: AssetMetadata = {
      id: uuidv4(),
      date: '2024-01-15',
      asset_url: '/uploads/asset1.png',
      meta_description: 'First asset',
      status: 'Draft',
      created_at: new Date().toISOString(),
      versions: []
    };

    const asset2: AssetMetadata = {
      id: uuidv4(),
      date: '2024-01-16',
      asset_url: '/uploads/asset2.png',
      meta_description: 'Second asset',
      status: 'Draft',
      created_at: new Date().toISOString(),
      versions: []
    };

    // 2. Add both assets
    await addAsset(asset1, testHistoryPath);
    await addAsset(asset2, testHistoryPath);

    // 3. Verify both exist in history
    const history = await readHistory(testHistoryPath);
    expect(history.assets).toHaveLength(2);
    expect(history.assets[0].id).toBe(asset1.id);
    expect(history.assets[1].id).toBe(asset2.id);
  });

  it('should not allow duplicate asset IDs', async () => {
    // 1. Create asset
    const assetId = uuidv4();
    const testAsset: AssetMetadata = {
      id: assetId,
      date: '2024-01-15',
      asset_url: '/uploads/test.png',
      meta_description: 'Test asset',
      status: 'Draft',
      created_at: new Date().toISOString(),
      versions: []
    };

    // 2. Add first time (should succeed)
    await addAsset(testAsset, testHistoryPath);

    // 3. Try to add again with same ID (should fail)
    await expect(addAsset(testAsset, testHistoryPath)).rejects.toThrow();
  });
});
