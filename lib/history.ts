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

const HISTORY_PATH = config.paths.history;

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
function initializeHistoryFile(): void {
  if (!existsSync(HISTORY_PATH)) {
    const dir = dirname(HISTORY_PATH);
    mkdirSync(dir, { recursive: true });
    writeFileSync(HISTORY_PATH, JSON.stringify({ assets: [] }, null, 2));
  }
}

/**
 * Read history.json with file locking
 * @returns Promise resolving to history data
 * @throws Error if file operation fails or lock cannot be acquired
 */
export async function readHistory(): Promise<HistoryData> {
  initializeHistoryFile();

  let release: (() => Promise<void>) | undefined;

  try {
    // Acquire lock
    release = await lockfile.lock(HISTORY_PATH, LOCK_OPTIONS);

    // Read file
    const content = readFileSync(HISTORY_PATH, 'utf8');

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
 * Write history.json with file locking
 * @param data - History data to write
 * @throws Error if file operation fails or lock cannot be acquired
 */
export async function updateHistory(data: HistoryData): Promise<void> {
  initializeHistoryFile();

  let release: (() => Promise<void>) | undefined;

  try {
    // Validate data
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid history data: data must be an object');
    }

    if (!Array.isArray(data.assets)) {
      throw new Error('Invalid history data: assets must be an array');
    }

    // Acquire lock
    release = await lockfile.lock(HISTORY_PATH, LOCK_OPTIONS);

    // Write atomically
    writeFileSync(HISTORY_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    throw new Error(`Failed to update history: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (release) await release();
  }
}

/**
 * Add a new asset to history
 * @param asset - Asset metadata to add
 * @throws Error if asset already exists or operation fails
 */
export async function addAsset(asset: AssetMetadata): Promise<void> {
  initializeHistoryFile();

  let release: (() => Promise<void>) | undefined;

  try {
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

    // Acquire lock
    release = await lockfile.lock(HISTORY_PATH, LOCK_OPTIONS);

    // Read current history
    const content = readFileSync(HISTORY_PATH, 'utf8');
    const history: HistoryData = content && content.trim() !== ''
      ? JSON.parse(content)
      : { assets: [] };

    // Check if asset already exists
    if (history.assets.some(a => a.id === asset.id)) {
      throw new Error(`Asset with id ${asset.id} already exists`);
    }

    // Add asset
    history.assets.push(asset);

    // Write atomically
    writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      throw error;
    }
    throw new Error(`Failed to add asset: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (release) await release();
  }
}

/**
 * Update asset status and optionally other fields
 * @param id - Asset ID
 * @param status - New status
 * @param updates - Optional additional fields to update
 * @throws Error if asset not found or operation fails
 */
export async function updateAssetStatus(
  id: string,
  status: Status,
  updates?: Partial<AssetMetadata>
): Promise<void> {
  initializeHistoryFile();

  let release: (() => Promise<void>) | undefined;

  try {
    // Validate inputs
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid id: must be a non-empty string');
    }

    if (!status || typeof status !== 'string') {
      throw new Error('Invalid status: must be a non-empty string');
    }

    // Acquire lock
    release = await lockfile.lock(HISTORY_PATH, LOCK_OPTIONS);

    // Read current history
    const content = readFileSync(HISTORY_PATH, 'utf8');
    const history: HistoryData = JSON.parse(content);

    // Find asset
    const assetIndex = history.assets.findIndex(a => a.id === id);
    if (assetIndex === -1) {
      throw new Error(`Asset with id ${id} not found`);
    }

    // Update asset
    history.assets[assetIndex] = {
      ...history.assets[assetIndex],
      ...updates,
      status,
      updated_at: new Date().toISOString()
    };

    // Write atomically
    writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    throw new Error(`Failed to update asset status: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (release) await release();
  }
}

/**
 * Get an asset by ID
 * @param id - Asset ID
 * @returns Promise resolving to asset metadata or null if not found
 * @throws Error if operation fails
 */
export async function getAsset(id: string): Promise<AssetMetadata | null> {
  initializeHistoryFile();

  let release: (() => Promise<void>) | undefined;

  try {
    // Validate input
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid id: must be a non-empty string');
    }

    // Acquire lock
    release = await lockfile.lock(HISTORY_PATH, LOCK_OPTIONS);

    // Read current history
    const content = readFileSync(HISTORY_PATH, 'utf8');
    const history: HistoryData = content && content.trim() !== ''
      ? JSON.parse(content)
      : { assets: [] };

    // Find and return asset
    const asset = history.assets.find(a => a.id === id);
    return asset || null;
  } catch (error) {
    throw new Error(`Failed to get asset: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (release) await release();
  }
}

/**
 * Delete an asset by ID
 * @param id - Asset ID
 * @throws Error if asset not found or operation fails
 */
export async function deleteAsset(id: string): Promise<void> {
  initializeHistoryFile();

  let release: (() => Promise<void>) | undefined;

  try {
    // Validate input
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid id: must be a non-empty string');
    }

    // Acquire lock
    release = await lockfile.lock(HISTORY_PATH, LOCK_OPTIONS);

    // Read current history
    const content = readFileSync(HISTORY_PATH, 'utf8');
    const history: HistoryData = JSON.parse(content);

    // Find asset
    const assetIndex = history.assets.findIndex(a => a.id === id);
    if (assetIndex === -1) {
      throw new Error(`Asset with id ${id} not found`);
    }

    // Remove asset
    history.assets.splice(assetIndex, 1);

    // Write atomically
    writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    throw new Error(`Failed to delete asset: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (release) await release();
  }
}
