/**
 * History management utility with file locking
 * Provides thread-safe operations for reading and writing history.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname } from 'path';
import { mkdirSync } from 'fs';
import lockfile from 'proper-lockfile';
import { config } from './config';
import type { HistoryData, AssetMetadata, Status } from './types';

/**
 * Lock options for proper-lockfile
 */
const LOCK_OPTIONS = {
  retries: { retries: 10, minTimeout: 100, maxTimeout: 2000 },
  stale: 10000
};

/**
 * Initialize history file if it doesn't exist
 */
function initializeHistoryFile(path: string): void {
  if (!existsSync(path)) {
    const dir = dirname(path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, JSON.stringify({ assets: [] }, null, 2));
  }
}

/**
 * Internal read function without locking
 * @param path - Path to history file
 * @returns History data
 */
function readHistoryInternal(path: string): HistoryData {
  const content = readFileSync(path, 'utf8');

  if (!content || content.trim() === '') {
    return { assets: [] };
  }

  const data = JSON.parse(content);

  // Validate structure
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid history data structure');
  }

  // Ensure assets array exists
  if (!Array.isArray(data.assets)) {
    return { assets: [] };
  }

  return data;
}

/**
 * Read history.json with file locking
 * @param path - Path to history file (defaults to config.paths.history)
 * @returns Promise resolving to history data
 * @throws Error if file operation fails or lock cannot be acquired
 */
export async function readHistory(path: string = config.paths.history): Promise<HistoryData> {
  initializeHistoryFile(path);

  let release: (() => Promise<void>) | undefined;

  try {
    // Acquire lock
    release = await lockfile.lock(path, LOCK_OPTIONS);

    // Read file
    return readHistoryInternal(path);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse history.json: ${error.message}`);
    }
    throw new Error(`Failed to read history: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (release) await release();
  }
}

/**
 * Update history.json with file locking using a callback function
 * @param updateFn - Function that takes current history and returns updated history
 * @param path - Path to history file (defaults to config.paths.history)
 * @throws Error if file operation fails or lock cannot be acquired
 */
export async function updateHistory(
  updateFn: (history: HistoryData) => HistoryData,
  path: string = config.paths.history
): Promise<void> {
  initializeHistoryFile(path);

  let release: (() => Promise<void>) | undefined;

  try {
    // Acquire lock
    release = await lockfile.lock(path, LOCK_OPTIONS);

    // Read current history
    const currentHistory = readHistoryInternal(path);

    // Apply update function
    const newHistory = updateFn(currentHistory);

    // Validate new data
    if (!newHistory || typeof newHistory !== 'object') {
      throw new Error('Invalid history data: data must be an object');
    }

    if (!Array.isArray(newHistory.assets)) {
      throw new Error('Invalid history data: assets must be an array');
    }

    // Write atomically
    writeFileSync(path, JSON.stringify(newHistory, null, 2));
  } catch (error) {
    throw new Error(`Failed to update history: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (release) await release();
  }
}

/**
 * Add a new asset to history
 * @param asset - Asset metadata to add
 * @param path - Path to history file (defaults to config.paths.history)
 * @throws Error if asset already exists or operation fails
 */
export async function addAsset(
  asset: AssetMetadata,
  path: string = config.paths.history
): Promise<void> {
  // Validate asset
  if (!asset || typeof asset !== 'object') {
    throw new Error('Invalid asset data: asset must be an object');
  }

  if (!asset.id || typeof asset.id !== 'string') {
    throw new Error('Invalid asset data: id is required and must be a string');
  }

  if (!asset.status || typeof asset.status !== 'string') {
    throw new Error('Invalid asset data: status is required and must be a string');
  }

  if (!Array.isArray(asset.versions)) {
    throw new Error('Invalid asset data: versions must be an array');
  }

  try {
    await updateHistory((history) => {
      // Check if asset already exists
      if (history.assets.some(a => a.id === asset.id)) {
        throw new Error(`Asset with id ${asset.id} already exists`);
      }

      // Add asset
      return {
        ...history,
        assets: [...history.assets, asset]
      };
    }, path);
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      throw error;
    }
    throw new Error(`Failed to add asset: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Update asset status
 * @param assetId - Asset ID
 * @param status - New status
 * @param path - Path to history file (defaults to config.paths.history)
 * @throws Error if asset not found or operation fails
 */
export async function updateAssetStatus(
  assetId: string,
  status: Status,
  path: string = config.paths.history
): Promise<void> {
  // Validate inputs
  if (!assetId || typeof assetId !== 'string') {
    throw new Error('Invalid id: must be a non-empty string');
  }

  if (!status || typeof status !== 'string') {
    throw new Error('Invalid status: must be a non-empty string');
  }

  try {
    await updateHistory((history) => {
      // Find asset
      const assetIndex = history.assets.findIndex(a => a.id === assetId);
      if (assetIndex === -1) {
        throw new Error(`Asset with id ${assetId} not found`);
      }

      // Update asset
      const updatedAssets = [...history.assets];
      updatedAssets[assetIndex] = {
        ...updatedAssets[assetIndex],
        status,
        updated_at: new Date().toISOString()
      };

      return {
        ...history,
        assets: updatedAssets
      };
    }, path);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    throw new Error(`Failed to update asset status: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get an asset by ID
 * @param assetId - Asset ID
 * @param path - Path to history file (defaults to config.paths.history)
 * @returns Promise resolving to asset metadata or null if not found
 * @throws Error if operation fails
 */
export async function getAsset(
  assetId: string,
  path: string = config.paths.history
): Promise<AssetMetadata | null> {
  // Validate input
  if (!assetId || typeof assetId !== 'string') {
    throw new Error('Invalid id: must be a non-empty string');
  }

  try {
    const history = await readHistory(path);

    // Find and return asset
    const asset = history.assets.find(a => a.id === assetId);
    return asset || null;
  } catch (error) {
    throw new Error(`Failed to get asset: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Delete an asset by ID
 * @param assetId - Asset ID
 * @param path - Path to history file (defaults to config.paths.history)
 * @throws Error if asset not found or operation fails
 */
export async function deleteAsset(
  assetId: string,
  path: string = config.paths.history
): Promise<void> {
  // Validate input
  if (!assetId || typeof assetId !== 'string') {
    throw new Error('Invalid id: must be a non-empty string');
  }

  try {
    await updateHistory((history) => {
      // Find asset
      const assetIndex = history.assets.findIndex(a => a.id === assetId);
      if (assetIndex === -1) {
        throw new Error(`Asset with id ${assetId} not found`);
      }

      // Remove asset
      return {
        ...history,
        assets: history.assets.filter(a => a.id !== assetId)
      };
    }, path);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    throw new Error(`Failed to delete asset: ${error instanceof Error ? error.message : String(error)}`);
  }
}
