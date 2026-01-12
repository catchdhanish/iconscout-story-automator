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
  text_overlay_applied?: boolean;
  text_overlay_content?: string;
  text_overlay_position?: {
    tier: 1 | 2 | 3;
    y: number;
  };
  text_overlay_failed?: boolean;
  text_overlay_error?: string;
  text_overlay_fallback_applied?: boolean;
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
  text_overlay_content?: string;
  text_overlay_enabled?: boolean;
  text_overlay_analytics?: {
    position_tier_used: 1 | 2 | 3;
    shadow_type: 'dark' | 'light';
    lines_count: number;
    applied_at: string;
    render_time_ms?: number;
    brightness_samples?: number[];
    avg_brightness?: number;
  };
}

/**
 * Wrapper structure for the history JSON file
 */
export interface HistoryData {
  assets: AssetMetadata[];
}
