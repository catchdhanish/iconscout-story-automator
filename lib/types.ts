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
  created_at: string;
  prompt_used: string;
  refinement_prompt?: string;
  file_path: string;
}

/**
 * Tracks errors that occur during asset operations
 */
export interface AssetError {
  message: string;
  details: string;
  failed_at: string;
  retry_count: number;
}

/**
 * Complete metadata for an asset including all versions and scheduling information
 */
export interface AssetMetadata {
  id: string;
  date: string;
  asset_url: string;
  meta_description: string;
  status: Status;
  created_at: string;
  updated_at?: string;
  asset_vision_description?: string;
  dominant_colors?: string[];
  active_version?: number;
  versions: AssetVersion[];
  blotato_post_id?: string;
  scheduled_time?: string;
  scheduled_at?: string;
  published_at?: string;
  verified_at?: string;
  error?: AssetError;
}

/**
 * Wrapper structure for the history JSON file
 */
export interface HistoryData {
  assets: AssetMetadata[];
}
