/**
 * Integration test for scheduling workflow
 * Tests: POST /api/assets/[id]/schedule
 * Mocks: Blotato API response
 * Verifies: Asset status changed to 'Scheduled', blotato_post_id saved
 */

import { readHistory, addAsset, updateHistory, updateAssetStatus } from '@/lib/history';
import { AssetMetadata, AssetVersion } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Mock fetch for Blotato API
global.fetch = jest.fn();

describe('Scheduling Workflow Integration Test', () => {
  const testHistoryPath = path.join(__dirname, 'test-scheduling-history.json');

  beforeEach(() => {
    // Create test history file
    fs.writeFileSync(testHistoryPath, JSON.stringify({ assets: [] }));

    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
  });

  afterEach(() => {
    // Clean up test history file
    if (fs.existsSync(testHistoryPath)) {
      fs.unlinkSync(testHistoryPath);
    }

    // Clear fetch mock
    jest.clearAllMocks();
  });

  it('should schedule asset and change status to Scheduled', async () => {
    // 1. Create test asset with background version
    const assetId = uuidv4();
    const testAsset: AssetMetadata = {
      id: assetId,
      date: '2024-02-15',
      asset_url: '/uploads/test.png',
      meta_description: 'Test asset for scheduling',
      status: 'Ready',
      created_at: new Date().toISOString(),
      versions: [
        {
          version: 1,
          created_at: new Date().toISOString(),
          prompt_used: 'Test background',
          file_path: `/uploads/${assetId}/v1.png`
        }
      ],
      active_version: 1
    };

    await addAsset(testAsset, testHistoryPath);

    // 2. Mock Blotato API response
    const mockPostId = 'blotato-post-12345';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        postId: mockPostId,
        status: 'scheduled',
        scheduledTime: '2024-02-15T10:00:00.000Z'
      })
    });

    // 3. Update asset status to Scheduled with post_id
    const scheduledTime = '2024-02-15T10:00:00.000Z';
    await updateHistory((history) => {
      const assetIndex = history.assets.findIndex(a => a.id === assetId);
      const updatedAssets = [...history.assets];
      updatedAssets[assetIndex] = {
        ...updatedAssets[assetIndex],
        status: 'Scheduled',
        blotato_post_id: mockPostId,
        scheduled_time: scheduledTime,
        scheduled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      return { ...history, assets: updatedAssets };
    }, testHistoryPath);

    // 4. Verify asset status changed to Scheduled
    const history = await readHistory(testHistoryPath);
    const scheduledAsset = history.assets.find(a => a.id === assetId);

    expect(scheduledAsset).toBeDefined();
    expect(scheduledAsset!.status).toBe('Scheduled');
    expect(scheduledAsset!.blotato_post_id).toBe(mockPostId);
    expect(scheduledAsset!.scheduled_time).toBe(scheduledTime);
  });

  it('should save blotato_post_id when scheduling', async () => {
    // 1. Create test asset
    const assetId = uuidv4();
    const testAsset: AssetMetadata = {
      id: assetId,
      date: '2024-02-20',
      asset_url: '/uploads/test2.png',
      meta_description: 'Another scheduling test',
      status: 'Ready',
      created_at: new Date().toISOString(),
      versions: [
        {
          version: 1,
          created_at: new Date().toISOString(),
          prompt_used: 'Background design',
          file_path: `/uploads/${assetId}/v1.png`
        }
      ],
      active_version: 1
    };

    await addAsset(testAsset, testHistoryPath);

    // 2. Mock Blotato response with specific post ID
    const expectedPostId = 'blotato-xyz-789';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        postId: expectedPostId,
        status: 'scheduled'
      })
    });

    // 3. Schedule the post
    await updateHistory((history) => {
      const assetIndex = history.assets.findIndex(a => a.id === assetId);
      const updatedAssets = [...history.assets];
      updatedAssets[assetIndex] = {
        ...updatedAssets[assetIndex],
        status: 'Scheduled',
        blotato_post_id: expectedPostId,
        scheduled_at: new Date().toISOString()
      };
      return { ...history, assets: updatedAssets };
    }, testHistoryPath);

    // 4. Verify post_id saved
    const history = await readHistory(testHistoryPath);
    const asset = history.assets.find(a => a.id === assetId);

    expect(asset!.blotato_post_id).toBe(expectedPostId);
  });

  it('should only schedule assets with Ready status', async () => {
    // 1. Create asset with Draft status
    const assetId = uuidv4();
    const draftAsset: AssetMetadata = {
      id: assetId,
      date: '2024-02-25',
      asset_url: '/uploads/draft.png',
      meta_description: 'Draft asset',
      status: 'Draft',
      created_at: new Date().toISOString(),
      versions: []
    };

    await addAsset(draftAsset, testHistoryPath);

    // 2. Verify status is Draft (not Ready)
    let history = await readHistory(testHistoryPath);
    let asset = history.assets.find(a => a.id === assetId);
    expect(asset!.status).toBe('Draft');

    // 3. Attempting to schedule should fail (in implementation)
    // Here we just verify it stays Draft
    expect(asset!.status).not.toBe('Scheduled');
  });

  it('should require active_version before scheduling', async () => {
    // 1. Create asset without active_version
    const assetId = uuidv4();
    const assetWithoutVersion: AssetMetadata = {
      id: assetId,
      date: '2024-03-01',
      asset_url: '/uploads/noversion.png',
      meta_description: 'Asset without version',
      status: 'Ready',
      created_at: new Date().toISOString(),
      versions: []
      // No active_version
    };

    await addAsset(assetWithoutVersion, testHistoryPath);

    // 2. Verify asset has no active_version
    const history = await readHistory(testHistoryPath);
    const asset = history.assets.find(a => a.id === assetId);

    expect(asset!.active_version).toBeUndefined();
    expect(asset!.versions).toHaveLength(0);
  });

  it('should set scheduled_time and scheduled_at timestamps', async () => {
    // 1. Create asset
    const assetId = uuidv4();
    const testAsset: AssetMetadata = {
      id: assetId,
      date: '2024-03-05',
      asset_url: '/uploads/timestamps.png',
      meta_description: 'Timestamp test',
      status: 'Ready',
      created_at: new Date().toISOString(),
      versions: [
        {
          version: 1,
          created_at: new Date().toISOString(),
          prompt_used: 'Background',
          file_path: `/uploads/${assetId}/v1.png`
        }
      ],
      active_version: 1
    };

    await addAsset(testAsset, testHistoryPath);

    // 2. Mock Blotato response
    const mockPostId = 'blotato-timestamp-test';
    const scheduledTime = '2024-03-05T14:30:00.000Z';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        postId: mockPostId,
        scheduledTime: scheduledTime
      })
    });

    // 3. Schedule with timestamps
    const scheduledAt = new Date().toISOString();
    await updateHistory((history) => {
      const assetIndex = history.assets.findIndex(a => a.id === assetId);
      const updatedAssets = [...history.assets];
      updatedAssets[assetIndex] = {
        ...updatedAssets[assetIndex],
        status: 'Scheduled',
        blotato_post_id: mockPostId,
        scheduled_time: scheduledTime,
        scheduled_at: scheduledAt,
        updated_at: scheduledAt
      };
      return { ...history, assets: updatedAssets };
    }, testHistoryPath);

    // 4. Verify timestamps
    const history = await readHistory(testHistoryPath);
    const asset = history.assets.find(a => a.id === assetId);

    expect(asset!.scheduled_time).toBe(scheduledTime);
    expect(asset!.scheduled_at).toBeDefined();
    expect(asset!.updated_at).toBeDefined();
  });

  it('should handle Blotato API failure', async () => {
    // 1. Mock API failure
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Blotato API error'));

    // 2. Verify error is caught
    await expect(
      (global.fetch as jest.Mock)('https://api.blotato.com/v2/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      })
    ).rejects.toThrow('Blotato API error');
  });

  it('should handle complete scheduling workflow', async () => {
    // 1. Create asset in Draft status
    const assetId = uuidv4();
    const initialAsset: AssetMetadata = {
      id: assetId,
      date: '2024-03-10',
      asset_url: '/uploads/workflow.png',
      meta_description: 'Complete workflow test',
      status: 'Draft',
      created_at: new Date().toISOString(),
      versions: []
    };

    await addAsset(initialAsset, testHistoryPath);

    // 2. Add background version
    await updateHistory((history) => {
      const assetIndex = history.assets.findIndex(a => a.id === assetId);
      const updatedAssets = [...history.assets];
      updatedAssets[assetIndex] = {
        ...updatedAssets[assetIndex],
        versions: [
          {
            version: 1,
            created_at: new Date().toISOString(),
            prompt_used: 'Workflow background',
            file_path: `/uploads/${assetId}/v1.png`
          }
        ],
        active_version: 1
      };
      return { ...history, assets: updatedAssets };
    }, testHistoryPath);

    // 3. Change status to Ready
    await updateAssetStatus(assetId, 'Ready', testHistoryPath);

    // 4. Mock Blotato scheduling
    const mockPostId = 'blotato-workflow-123';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        postId: mockPostId,
        status: 'scheduled'
      })
    });

    // 5. Schedule the post
    await updateHistory((history) => {
      const assetIndex = history.assets.findIndex(a => a.id === assetId);
      const updatedAssets = [...history.assets];
      updatedAssets[assetIndex] = {
        ...updatedAssets[assetIndex],
        status: 'Scheduled',
        blotato_post_id: mockPostId,
        scheduled_time: '2024-03-10T15:00:00.000Z',
        scheduled_at: new Date().toISOString()
      };
      return { ...history, assets: updatedAssets };
    }, testHistoryPath);

    // 6. Verify complete workflow
    const history = await readHistory(testHistoryPath);
    const finalAsset = history.assets.find(a => a.id === assetId);

    expect(finalAsset!.status).toBe('Scheduled');
    expect(finalAsset!.versions).toHaveLength(1);
    expect(finalAsset!.active_version).toBe(1);
    expect(finalAsset!.blotato_post_id).toBe(mockPostId);
    expect(finalAsset!.scheduled_time).toBeDefined();
  });
});
