import { getPreviewPath, isPreviewStale, generatePreview } from '../preview';
import path from 'path';
import type { AssetVersion } from '../types';
import { readHistory, updateHistory } from '../history';
import * as composition from '../composition';

// Mock dependencies
jest.mock('../history');
jest.mock('../composition');
jest.mock('fs/promises');

describe('getPreviewPath', () => {
  it('should return correct preview path for asset and version', () => {
    const result = getPreviewPath('test-asset-id', 2);

    expect(result).toBe(
      path.join(process.cwd(), 'public/uploads/test-asset-id/preview-v2.png')
    );
  });

  it('should handle asset IDs with special characters', () => {
    const result = getPreviewPath('abc-123-def', 1);

    expect(result).toContain('abc-123-def/preview-v1.png');
  });
});

describe('isPreviewStale', () => {
  it('should return true if preview is older than version', () => {
    const version: AssetVersion = {
      version: 1,
      created_at: '2026-01-13T00:10:00Z',
      prompt_used: 'Test',
      file_path: '/test/v1.png',
      preview_generated_at: '2026-01-13T00:05:00Z' // 5 minutes before
    };

    expect(isPreviewStale(version)).toBe(true);
  });

  it('should return false if preview is newer than version', () => {
    const version: AssetVersion = {
      version: 1,
      created_at: '2026-01-13T00:05:00Z',
      prompt_used: 'Test',
      file_path: '/test/v1.png',
      preview_generated_at: '2026-01-13T00:10:00Z' // 5 minutes after
    };

    expect(isPreviewStale(version)).toBe(false);
  });

  it('should return true if preview_generated_at is missing', () => {
    const version: AssetVersion = {
      version: 1,
      created_at: '2026-01-13T00:05:00Z',
      prompt_used: 'Test',
      file_path: '/test/v1.png'
    };

    expect(isPreviewStale(version)).toBe(true);
  });
});

describe('generatePreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate preview and update metadata', async () => {
    const mockAsset = {
      id: 'test-id',
      asset_url: '/uploads/test-id.png',
      active_version: 1,
      versions: [
        {
          version: 1,
          created_at: '2026-01-13T00:00:00Z',
          prompt_used: 'Test',
          file_path: '/uploads/test-id/v1.png'
        }
      ]
    };

    const mockHistory = {
      assets: [mockAsset]
    };

    (readHistory as jest.Mock).mockResolvedValue(mockHistory);

    // Mock updateHistory to actually execute the callback
    (updateHistory as jest.Mock).mockImplementation(async (callback) => {
      callback(mockHistory);
    });

    (composition.composeStory as jest.Mock).mockResolvedValue({
      success: true,
      outputPath: '/test/preview-v1.png',
      processingTime: 1234
    });

    const result = await generatePreview('test-id', 1);

    expect(result.success).toBe(true);
    expect(result.previewUrl).toBe('/uploads/test-id/preview-v1.png');
    expect(composition.composeStory).toHaveBeenCalledWith(
      expect.stringContaining('v1.png'),
      expect.stringContaining('test-id.png'),
      expect.stringContaining('preview-v1.png'),
      { includeText: false }
    );
    expect(updateHistory).toHaveBeenCalled();
  });

  it('should handle missing asset', async () => {
    const mockHistory = {
      assets: []
    };

    (readHistory as jest.Mock).mockResolvedValue(mockHistory);

    // Mock updateHistory to execute callback and let it throw
    (updateHistory as jest.Mock).mockImplementation(async (callback) => {
      callback(mockHistory);
    });

    const result = await generatePreview('missing-id', 1);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Asset not found');
  });

  it('should retry once on failure then mark as failed', async () => {
    const mockAsset = {
      id: 'test-id',
      asset_url: '/uploads/test-id.png',
      active_version: 1,
      versions: [
        {
          version: 1,
          created_at: '2026-01-13T00:00:00Z',
          prompt_used: 'Test',
          file_path: '/uploads/test-id/v1.png'
        }
      ]
    };

    const mockHistory = {
      assets: [mockAsset]
    };

    (readHistory as jest.Mock).mockResolvedValue(mockHistory);

    // Mock updateHistory to execute callback
    (updateHistory as jest.Mock).mockImplementation(async (callback) => {
      callback(mockHistory);
    });

    (composition.composeStory as jest.Mock)
      .mockRejectedValueOnce(new Error('Composition failed'))
      .mockRejectedValueOnce(new Error('Composition failed again'));

    const result = await generatePreview('test-id', 1);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Composition failed again');
    expect(composition.composeStory).toHaveBeenCalledTimes(2); // Initial + retry
    expect(updateHistory).toHaveBeenCalled(); // Updates with failure flag
  });
});
