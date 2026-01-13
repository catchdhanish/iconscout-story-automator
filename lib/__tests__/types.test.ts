import type { AssetVersion, BulkApproveRequest, BulkApproveResponse } from '../types';

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

describe('Bulk approval types', () => {
  it('should support BulkApproveRequest structure', () => {
    const request: BulkApproveRequest = {
      assetIds: ['id1', 'id2', 'id3']
    };

    expect(request.assetIds).toHaveLength(3);
  });

  it('should support BulkApproveResponse structure', () => {
    const response: BulkApproveResponse = {
      success: true,
      approved: ['id1', 'id2'],
      failed: [
        { id: 'id3', reason: 'Missing background' }
      ],
      summary: {
        total_selected: 3,
        total_approved: 2,
        total_failed: 1
      }
    };

    expect(response.approved).toHaveLength(2);
    expect(response.failed).toHaveLength(1);
    expect(response.summary.total_approved).toBe(2);
  });
});
