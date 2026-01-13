import type { AssetVersion } from '../types';

describe('AssetVersion with preview fields', () => {
  it('should support optional preview fields', () => {
    const version: AssetVersion = {
      version: 1,
      created_at: '2026-01-13T00:00:00Z',
      prompt_used: 'Test prompt',
      file_path: '/uploads/test/v1.png',
      preview_file_path: '/uploads/test/preview-v1.png',
      preview_generated_at: '2026-01-13T00:01:00Z',
      preview_generation_time_ms: 1234,
      preview_generation_failed: false
    };

    expect(version.preview_file_path).toBe('/uploads/test/preview-v1.png');
    expect(version.preview_generation_time_ms).toBe(1234);
  });

  it('should allow preview fields to be undefined', () => {
    const version: AssetVersion = {
      version: 1,
      created_at: '2026-01-13T00:00:00Z',
      prompt_used: 'Test prompt',
      file_path: '/uploads/test/v1.png'
    };

    expect(version.preview_file_path).toBeUndefined();
  });
});
