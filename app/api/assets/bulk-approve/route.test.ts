import { POST } from './route';
import { NextRequest } from 'next/server';
import * as historyLib from '@/lib/history';
import fs from 'fs';
import path from 'path';

// Mock dependencies
jest.mock('@/lib/history');
jest.mock('fs');

describe('POST /api/assets/bulk-approve', () => {
  const mockUpdateHistory = historyLib.updateHistory as jest.MockedFunction<typeof historyLib.updateHistory>;
  const mockReadHistory = historyLib.readHistory as jest.MockedFunction<typeof historyLib.readHistory>;
  const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should approve all valid Draft assets', async () => {
    const mockAssets = [
      {
        id: 'asset-1',
        status: 'Draft',
        active_version: 1,
        versions: [{ version: 1, file_path: '/uploads/asset-1/v1.png' }],
        asset_url: 'https://example.com/asset1.png',
        date: '2026-01-20',
        created_at: '2026-01-13T10:00:00Z'
      },
      {
        id: 'asset-2',
        status: 'Draft',
        active_version: 2,
        versions: [
          { version: 1, file_path: '/uploads/asset-2/v1.png' },
          { version: 2, file_path: '/uploads/asset-2/v2.png' }
        ],
        asset_url: 'https://example.com/asset2.png',
        date: '2026-01-21',
        created_at: '2026-01-13T10:00:00Z'
      }
    ];

    mockReadHistory.mockResolvedValue({ assets: mockAssets });
    mockExistsSync.mockReturnValue(true); // All files exist

    let updateCallCount = 0;
    mockUpdateHistory.mockImplementation(async (updateFn) => {
      updateCallCount++;
      const updated = await updateFn({ assets: [...mockAssets] });
      // Simulate the update
      const asset = updated.assets.find((a: any) => a.id === `asset-${updateCallCount}`);
      if (asset) {
        asset.status = 'Ready';
        asset.updated_at = new Date().toISOString();
      }
      return updated;
    });

    const request = new NextRequest('http://localhost:3000/api/assets/bulk-approve', {
      method: 'POST',
      body: JSON.stringify({
        assetIds: ['asset-1', 'asset-2']
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.approved).toEqual(['asset-1', 'asset-2']);
    expect(data.failed).toEqual([]);
    expect(data.summary.total).toBe(2);
    expect(data.summary.approved).toBe(2);
    expect(data.summary.failed).toBe(0);
    expect(mockUpdateHistory).toHaveBeenCalledTimes(2);
  });

  it('should filter out non-Draft assets automatically', async () => {
    const mockAssets = [
      {
        id: 'asset-1',
        status: 'Draft',
        active_version: 1,
        versions: [{ version: 1, file_path: '/uploads/asset-1/v1.png' }],
        asset_url: 'https://example.com/asset1.png',
        date: '2026-01-20',
        created_at: '2026-01-13T10:00:00Z'
      },
      {
        id: 'asset-2',
        status: 'Ready', // Already approved
        active_version: 1,
        versions: [{ version: 1, file_path: '/uploads/asset-2/v1.png' }],
        asset_url: 'https://example.com/asset2.png',
        date: '2026-01-21',
        created_at: '2026-01-13T10:00:00Z'
      },
      {
        id: 'asset-3',
        status: 'Scheduled', // Already scheduled
        active_version: 1,
        versions: [{ version: 1, file_path: '/uploads/asset-3/v1.png' }],
        asset_url: 'https://example.com/asset3.png',
        date: '2026-01-22',
        created_at: '2026-01-13T10:00:00Z'
      }
    ];

    mockReadHistory.mockResolvedValue({ assets: mockAssets });
    mockExistsSync.mockReturnValue(true);

    mockUpdateHistory.mockImplementation(async (updateFn) => {
      const updated = await updateFn({ assets: [...mockAssets] });
      const asset = updated.assets.find((a: any) => a.id === 'asset-1');
      if (asset) {
        asset.status = 'Ready';
        asset.updated_at = new Date().toISOString();
      }
      return updated;
    });

    const request = new NextRequest('http://localhost:3000/api/assets/bulk-approve', {
      method: 'POST',
      body: JSON.stringify({
        assetIds: ['asset-1', 'asset-2', 'asset-3']
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.approved).toEqual(['asset-1']);
    expect(data.failed).toEqual([]);
    expect(data.summary.total).toBe(1); // Only Draft asset counted
    expect(data.summary.approved).toBe(1);
    expect(data.summary.failed).toBe(0);
    expect(mockUpdateHistory).toHaveBeenCalledTimes(1); // Only called for Draft asset
  });

  it('should enforce 50 asset limit', async () => {
    const assetIds = Array.from({ length: 51 }, (_, i) => `asset-${i + 1}`);

    // Mock readHistory to avoid actual file read (though it shouldn't be called)
    mockReadHistory.mockResolvedValue({ assets: [] });

    const request = new NextRequest('http://localhost:3000/api/assets/bulk-approve', {
      method: 'POST',
      body: JSON.stringify({ assetIds })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('50 assets');
    expect(mockReadHistory).not.toHaveBeenCalled(); // Should fail before reading history
  });

  it('should retry failed approvals up to 3 times', async () => {
    const mockAssets = [
      {
        id: 'asset-1',
        status: 'Draft',
        active_version: 1,
        versions: [{ version: 1, file_path: '/uploads/asset-1/v1.png' }],
        asset_url: 'https://example.com/asset1.png',
        date: '2026-01-20',
        created_at: '2026-01-13T10:00:00Z'
      }
    ];

    mockReadHistory.mockResolvedValue({ assets: mockAssets });
    mockExistsSync.mockReturnValue(true);

    let attemptCount = 0;
    mockUpdateHistory.mockImplementation(async (updateFn) => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error('Lock conflict');
      }
      const updated = await updateFn({ assets: [...mockAssets] });
      const asset = updated.assets.find((a: any) => a.id === 'asset-1');
      if (asset) {
        asset.status = 'Ready';
        asset.updated_at = new Date().toISOString();
      }
      return updated;
    });

    const request = new NextRequest('http://localhost:3000/api/assets/bulk-approve', {
      method: 'POST',
      body: JSON.stringify({
        assetIds: ['asset-1']
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.approved).toEqual(['asset-1']);
    expect(data.failed).toEqual([]);
    expect(attemptCount).toBe(3); // Failed twice, succeeded on third attempt
  });
});
