/**
 * Core type definitions for the Instagram Story automation system
 */

/**
 * Status of an asset in the system lifecycle
 */
export type Status = 'Draft' | 'Ready' | 'Scheduled' | 'Published' | 'Failed' | 'Archived';

/**
 * Represents a version of a generated background for an asset
 */
export interface AssetVersion {
  version: number;
  backgroundPath: string;
  prompt: string;
  generatedAt: string;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
}

/**
 * Tracks errors that occur during asset operations
 */
export interface AssetError {
  timestamp: string;
  message: string;
  operation: string;
  stackTrace?: string;
}

/**
 * Complete metadata for an asset including all versions and scheduling information
 */
export interface AssetMetadata {
  id: string;
  iconPath: string;
  originalIconPath: string;
  currentVersion: number;
  versions: AssetVersion[];
  status: Status;
  scheduledFor?: string;
  publishedAt?: string;
  blotato_post_id?: string;
  errors?: AssetError[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Wrapper structure for the history JSON file
 */
export interface HistoryData {
  assets: AssetMetadata[];
}
