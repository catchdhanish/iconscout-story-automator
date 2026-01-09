/**
 * Test suite for history management utility
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import type { AssetMetadata, HistoryData } from '../types';

const TEST_HISTORY_PATH = join(process.cwd(), 'test-history.json');

// Mock config to use test history file
jest.mock('../config', () => ({
  config: {
    paths: {
      history: join(process.cwd(), 'test-history.json')
    }
  }
}));

import {
  readHistory,
  updateHistory,
  addAsset,
  updateAssetStatus,
  getAsset,
  deleteAsset
} from '../history';

describe('History Management', () => {
  beforeEach(() => {
    // Clean up test file before each test
    if (existsSync(TEST_HISTORY_PATH)) {
      unlinkSync(TEST_HISTORY_PATH);
    }
  });

  afterEach(() => {
    // Clean up test file after each test
    if (existsSync(TEST_HISTORY_PATH)) {
      unlinkSync(TEST_HISTORY_PATH);
    }
  });

  describe('readHistory', () => {
    it('should return empty assets array for empty file', async () => {
      const history = await readHistory();
      expect(history).toEqual({ assets: [] });
      expect(existsSync(TEST_HISTORY_PATH)).toBe(true);
    });

    it('should read existing data from file', async () => {
      const testData: HistoryData = {
        assets: [
          {
            id: 'test-1',
            date: '2026-01-09',
            asset_url: 'https://example.com/asset.svg',
            meta_description: 'Test asset',
            status: 'Draft',
            created_at: '2026-01-09T10:00:00Z',
            versions: []
          }
        ]
      };

      // Create directory if it doesn't exist
      const dir = dirname(TEST_HISTORY_PATH);
      mkdirSync(dir, { recursive: true });

      writeFileSync(TEST_HISTORY_PATH, JSON.stringify(testData, null, 2));

      const history = await readHistory();
      expect(history).toEqual(testData);
      expect(history.assets).toHaveLength(1);
      expect(history.assets[0].id).toBe('test-1');
    });

    it('should handle corrupted JSON gracefully', async () => {
      // Create directory if it doesn't exist
      const dir = dirname(TEST_HISTORY_PATH);
      mkdirSync(dir, { recursive: true });

      writeFileSync(TEST_HISTORY_PATH, '{ invalid json }');

      await expect(readHistory()).rejects.toThrow('Failed to parse history.json');
    });

    it('should return empty assets if data.assets is not an array', async () => {
      // Create directory if it doesn't exist
      const dir = dirname(TEST_HISTORY_PATH);
      mkdirSync(dir, { recursive: true });

      writeFileSync(TEST_HISTORY_PATH, JSON.stringify({ assets: null }, null, 2));

      const history = await readHistory();
      expect(history).toEqual({ assets: [] });
    });
  });

  describe('updateHistory', () => {
    it('should write history data to file', async () => {
      const testData: HistoryData = {
        assets: [
          {
            id: 'test-1',
            date: '2026-01-09',
            asset_url: 'https://example.com/asset.svg',
            meta_description: 'Test asset',
            status: 'Draft',
            created_at: '2026-01-09T10:00:00Z',
            versions: []
          }
        ]
      };

      await updateHistory(() => testData);

      const content = readFileSync(TEST_HISTORY_PATH, 'utf8');
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(testData);
    });

    it('should throw error for invalid data structure', async () => {
      await expect(updateHistory(() => null as any)).rejects.toThrow('Invalid history data: data must be an object');
    });

    it('should throw error if assets is not an array', async () => {
      await expect(updateHistory(() => ({ assets: 'not-an-array' } as any))).rejects.toThrow('Invalid history data: assets must be an array');
    });
  });

  describe('addAsset', () => {
    it('should create new asset correctly', async () => {
      const asset: AssetMetadata = {
        id: 'test-1',
        date: '2026-01-09',
        asset_url: 'https://example.com/asset.svg',
        meta_description: 'Test asset',
        status: 'Draft',
        created_at: '2026-01-09T10:00:00Z',
        versions: []
      };

      await addAsset(asset);

      const history = await readHistory();
      expect(history.assets).toHaveLength(1);
      expect(history.assets[0]).toEqual(asset);
    });

    it('should add multiple assets', async () => {
      const asset1: AssetMetadata = {
        id: 'test-1',
        date: '2026-01-09',
        asset_url: 'https://example.com/asset1.svg',
        meta_description: 'Test asset 1',
        status: 'Draft',
        created_at: '2026-01-09T10:00:00Z',
        versions: []
      };

      const asset2: AssetMetadata = {
        id: 'test-2',
        date: '2026-01-09',
        asset_url: 'https://example.com/asset2.svg',
        meta_description: 'Test asset 2',
        status: 'Ready',
        created_at: '2026-01-09T10:01:00Z',
        versions: []
      };

      await addAsset(asset1);
      await addAsset(asset2);

      const history = await readHistory();
      expect(history.assets).toHaveLength(2);
      expect(history.assets[0].id).toBe('test-1');
      expect(history.assets[1].id).toBe('test-2');
    });

    it('should throw error if asset already exists', async () => {
      const asset: AssetMetadata = {
        id: 'test-1',
        date: '2026-01-09',
        asset_url: 'https://example.com/asset.svg',
        meta_description: 'Test asset',
        status: 'Draft',
        created_at: '2026-01-09T10:00:00Z',
        versions: []
      };

      await addAsset(asset);
      await expect(addAsset(asset)).rejects.toThrow('Asset with id test-1 already exists');
    });

    it('should throw error for invalid asset data', async () => {
      await expect(addAsset(null as any)).rejects.toThrow('Invalid asset data: asset must be an object');
      await expect(addAsset({ id: '' } as any)).rejects.toThrow('Invalid asset data: id is required and must be a string');
      await expect(addAsset({ id: 'test-1' } as any)).rejects.toThrow('Invalid asset data: status is required and must be a string');
      await expect(addAsset({ id: 'test-1', status: 'Draft' } as any)).rejects.toThrow('Invalid asset data: versions must be an array');
    });
  });

  describe('updateAssetStatus', () => {
    it('should update asset status', async () => {
      const asset: AssetMetadata = {
        id: 'test-1',
        date: '2026-01-09',
        asset_url: 'https://example.com/asset.svg',
        meta_description: 'Test asset',
        status: 'Draft',
        created_at: '2026-01-09T10:00:00Z',
        versions: []
      };

      await addAsset(asset);
      await updateAssetStatus('test-1', 'Ready');

      const history = await readHistory();
      expect(history.assets[0].status).toBe('Ready');
      expect(history.assets[0].updated_at).toBeDefined();
    });

    it('should throw error if asset not found', async () => {
      await expect(updateAssetStatus('nonexistent', 'Ready')).rejects.toThrow('Asset with id nonexistent not found');
    });

    it('should throw error for invalid inputs', async () => {
      await expect(updateAssetStatus('', 'Ready')).rejects.toThrow('Invalid id: must be a non-empty string');
      await expect(updateAssetStatus('test-1', '' as any)).rejects.toThrow('Invalid status: must be a non-empty string');
    });
  });

  describe('getAsset', () => {
    it('should retrieve asset by ID', async () => {
      const asset: AssetMetadata = {
        id: 'test-1',
        date: '2026-01-09',
        asset_url: 'https://example.com/asset.svg',
        meta_description: 'Test asset',
        status: 'Draft',
        created_at: '2026-01-09T10:00:00Z',
        versions: []
      };

      await addAsset(asset);

      const retrieved = await getAsset('test-1');
      expect(retrieved).toEqual(asset);
    });

    it('should return null for nonexistent asset', async () => {
      const retrieved = await getAsset('nonexistent');
      expect(retrieved).toBeNull();
    });

    it('should throw error for invalid ID', async () => {
      await expect(getAsset('')).rejects.toThrow('Invalid id: must be a non-empty string');
    });
  });

  describe('deleteAsset', () => {
    it('should remove asset from history', async () => {
      const asset: AssetMetadata = {
        id: 'test-1',
        date: '2026-01-09',
        asset_url: 'https://example.com/asset.svg',
        meta_description: 'Test asset',
        status: 'Draft',
        created_at: '2026-01-09T10:00:00Z',
        versions: []
      };

      await addAsset(asset);
      await deleteAsset('test-1');

      const history = await readHistory();
      expect(history.assets).toHaveLength(0);
    });

    it('should remove correct asset when multiple exist', async () => {
      const asset1: AssetMetadata = {
        id: 'test-1',
        date: '2026-01-09',
        asset_url: 'https://example.com/asset1.svg',
        meta_description: 'Test asset 1',
        status: 'Draft',
        created_at: '2026-01-09T10:00:00Z',
        versions: []
      };

      const asset2: AssetMetadata = {
        id: 'test-2',
        date: '2026-01-09',
        asset_url: 'https://example.com/asset2.svg',
        meta_description: 'Test asset 2',
        status: 'Ready',
        created_at: '2026-01-09T10:01:00Z',
        versions: []
      };

      await addAsset(asset1);
      await addAsset(asset2);
      await deleteAsset('test-1');

      const history = await readHistory();
      expect(history.assets).toHaveLength(1);
      expect(history.assets[0].id).toBe('test-2');
    });

    it('should throw error if asset not found', async () => {
      await expect(deleteAsset('nonexistent')).rejects.toThrow('Asset with id nonexistent not found');
    });

    it('should throw error for invalid ID', async () => {
      await expect(deleteAsset('')).rejects.toThrow('Invalid id: must be a non-empty string');
    });
  });

  describe('concurrent access handling', () => {
    it('should handle multiple simultaneous operations', async () => {
      // Create multiple assets concurrently
      const assets: AssetMetadata[] = Array.from({ length: 5 }, (_, i) => ({
        id: `test-${i}`,
        date: '2026-01-09',
        asset_url: `https://example.com/asset${i}.svg`,
        meta_description: `Test asset ${i}`,
        status: 'Draft',
        created_at: '2026-01-09T10:00:00Z',
        versions: []
      }));

      // Add all assets concurrently
      await Promise.all(assets.map(asset => addAsset(asset)));

      const history = await readHistory();
      expect(history.assets).toHaveLength(5);
    });

    it('should handle concurrent reads', async () => {
      const asset: AssetMetadata = {
        id: 'test-1',
        date: '2026-01-09',
        asset_url: 'https://example.com/asset.svg',
        meta_description: 'Test asset',
        status: 'Draft',
        created_at: '2026-01-09T10:00:00Z',
        versions: []
      };

      await addAsset(asset);

      // Perform multiple concurrent reads
      const results = await Promise.all([
        readHistory(),
        readHistory(),
        readHistory(),
        getAsset('test-1'),
        getAsset('test-1')
      ]);

      expect(results[0].assets).toHaveLength(1);
      expect(results[1].assets).toHaveLength(1);
      expect(results[2].assets).toHaveLength(1);
      expect(results[3]).toEqual(asset);
      expect(results[4]).toEqual(asset);
    });

    it('should handle concurrent updates to different assets', async () => {
      const assets: AssetMetadata[] = Array.from({ length: 3 }, (_, i) => ({
        id: `test-${i}`,
        date: '2026-01-09',
        asset_url: `https://example.com/asset${i}.svg`,
        meta_description: `Test asset ${i}`,
        status: 'Draft',
        created_at: '2026-01-09T10:00:00Z',
        versions: []
      }));

      // Add assets sequentially
      for (const asset of assets) {
        await addAsset(asset);
      }

      // Update all assets concurrently
      await Promise.all([
        updateAssetStatus('test-0', 'Ready'),
        updateAssetStatus('test-1', 'Scheduled'),
        updateAssetStatus('test-2', 'Published')
      ]);

      const history = await readHistory();
      expect(history.assets[0].status).toBe('Ready');
      expect(history.assets[1].status).toBe('Scheduled');
      expect(history.assets[2].status).toBe('Published');
    });

    it('should handle mixed concurrent operations', async () => {
      const asset1: AssetMetadata = {
        id: 'test-1',
        date: '2026-01-09',
        asset_url: 'https://example.com/asset1.svg',
        meta_description: 'Test asset 1',
        status: 'Draft',
        created_at: '2026-01-09T10:00:00Z',
        versions: []
      };

      const asset2: AssetMetadata = {
        id: 'test-2',
        date: '2026-01-09',
        asset_url: 'https://example.com/asset2.svg',
        meta_description: 'Test asset 2',
        status: 'Draft',
        created_at: '2026-01-09T10:01:00Z',
        versions: []
      };

      await addAsset(asset1);

      // Perform mixed operations concurrently
      await Promise.all([
        addAsset(asset2),
        updateAssetStatus('test-1', 'Ready'),
        getAsset('test-1'),
        readHistory()
      ]);

      const history = await readHistory();
      expect(history.assets).toHaveLength(2);
      expect(history.assets[0].status).toBe('Ready');
    });
  });
});
