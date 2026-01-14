import { POST, GET } from './route';
import { generatePreview } from '@/lib/preview';
import { getAsset } from '@/lib/history';
import { NextRequest } from 'next/server';

jest.mock('@/lib/preview');
jest.mock('@/lib/history');

describe('POST /api/assets/[assetId]/preview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate preview and return result', async () => {
    const mockAsset = {
      id: 'test-id',
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

    (getAsset as jest.Mock).mockResolvedValue(mockAsset);
    (generatePreview as jest.Mock).mockResolvedValue({
      success: true,
      previewUrl: '/uploads/test-id/preview-v1.png',
      generated_at: '2026-01-13T00:00:00Z',
      generation_time_ms: 1234
    });

    const request = new NextRequest('http://localhost/api/assets/test-id/preview', {
      method: 'POST',
      body: JSON.stringify({ version: 1 })
    });

    const response = await POST(request, {
      params: Promise.resolve({ assetId: 'test-id' })
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.previewUrl).toBe('/uploads/test-id/preview-v1.png');
    expect(data.generated_at).toBe('2026-01-13T00:00:00Z');
    expect(data.generation_time_ms).toBe(1234);
    expect(generatePreview).toHaveBeenCalledWith('test-id', 1);
  });

  it('should use active version if version not specified', async () => {
    const mockAsset = {
      id: 'test-id',
      active_version: 2,
      versions: [
        {
          version: 1,
          created_at: '2026-01-13T00:00:00Z',
          prompt_used: 'Test',
          file_path: '/uploads/test-id/v1.png'
        },
        {
          version: 2,
          created_at: '2026-01-13T00:05:00Z',
          prompt_used: 'Test 2',
          file_path: '/uploads/test-id/v2.png'
        }
      ]
    };

    (getAsset as jest.Mock).mockResolvedValue(mockAsset);
    (generatePreview as jest.Mock).mockResolvedValue({
      success: true,
      previewUrl: '/uploads/test-id/preview-v2.png',
      generated_at: '2026-01-13T00:00:00Z',
      generation_time_ms: 1234
    });

    const request = new NextRequest('http://localhost/api/assets/test-id/preview', {
      method: 'POST',
      body: JSON.stringify({})
    });

    const response = await POST(request, {
      params: Promise.resolve({ assetId: 'test-id' })
    });
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(generatePreview).toHaveBeenCalledWith('test-id', 2);
  });

  it('should return 404 if asset not found', async () => {
    (getAsset as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/assets/invalid-id/preview', {
      method: 'POST',
      body: JSON.stringify({})
    });

    const response = await POST(request, {
      params: Promise.resolve({ assetId: 'invalid-id' })
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Asset not found');
  });

  it('should return 404 if version not found', async () => {
    const mockAsset = {
      id: 'test-id',
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

    (getAsset as jest.Mock).mockResolvedValue(mockAsset);

    const request = new NextRequest('http://localhost/api/assets/test-id/preview', {
      method: 'POST',
      body: JSON.stringify({ version: 999 })
    });

    const response = await POST(request, {
      params: Promise.resolve({ assetId: 'test-id' })
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Version 999 not found');
  });

  it('should return 400 if assetId is invalid', async () => {
    const request = new NextRequest('http://localhost/api/assets/ /preview', {
      method: 'POST',
      body: JSON.stringify({ version: 1 })
    });

    const response = await POST(request, {
      params: Promise.resolve({ assetId: ' ' })
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid asset ID');
  });

  it('should return error if generation fails', async () => {
    const mockAsset = {
      id: 'test-id',
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

    (getAsset as jest.Mock).mockResolvedValue(mockAsset);
    (generatePreview as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Composition failed'
    });

    const request = new NextRequest('http://localhost/api/assets/test-id/preview', {
      method: 'POST',
      body: JSON.stringify({ version: 1 })
    });

    const response = await POST(request, {
      params: Promise.resolve({ assetId: 'test-id' })
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Composition failed');
  });
});

describe('GET /api/assets/[assetId]/preview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return preview status for active version', async () => {
    const mockAsset = {
      id: 'test-id',
      active_version: 1,
      versions: [
        {
          version: 1,
          created_at: '2026-01-13T00:00:00Z',
          prompt_used: 'Test',
          file_path: '/uploads/test-id/v1.png',
          preview_file_path: '/uploads/test-id/preview-v1.png',
          preview_generated_at: '2026-01-13T00:05:00Z',
          preview_generation_failed: false
        }
      ]
    };

    (getAsset as jest.Mock).mockResolvedValue(mockAsset);

    const request = new NextRequest('http://localhost/api/assets/test-id/preview', {
      method: 'GET'
    });

    const response = await GET(request, {
      params: Promise.resolve({ assetId: 'test-id' })
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.preview_file_path).toBe('/uploads/test-id/preview-v1.png');
    expect(data.preview_generated_at).toBe('2026-01-13T00:05:00Z');
    expect(data.preview_generation_failed).toBe(false);
    expect(data.is_stale).toBe(false);
  });

  it('should detect stale preview', async () => {
    const mockAsset = {
      id: 'test-id',
      active_version: 1,
      versions: [
        {
          version: 1,
          created_at: '2026-01-13T00:10:00Z',
          prompt_used: 'Test',
          file_path: '/uploads/test-id/v1.png',
          preview_file_path: '/uploads/test-id/preview-v1.png',
          preview_generated_at: '2026-01-13T00:05:00Z'
        }
      ]
    };

    (getAsset as jest.Mock).mockResolvedValue(mockAsset);

    const request = new NextRequest('http://localhost/api/assets/test-id/preview', {
      method: 'GET'
    });

    const response = await GET(request, {
      params: Promise.resolve({ assetId: 'test-id' })
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.is_stale).toBe(true);
  });

  it('should detect missing preview', async () => {
    const mockAsset = {
      id: 'test-id',
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

    (getAsset as jest.Mock).mockResolvedValue(mockAsset);

    const request = new NextRequest('http://localhost/api/assets/test-id/preview', {
      method: 'GET'
    });

    const response = await GET(request, {
      params: Promise.resolve({ assetId: 'test-id' })
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.preview_generated_at).toBeUndefined();
    expect(data.is_stale).toBe(true);
  });

  it('should return 404 if asset not found', async () => {
    (getAsset as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/assets/invalid-id/preview', {
      method: 'GET'
    });

    const response = await GET(request, {
      params: Promise.resolve({ assetId: 'invalid-id' })
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Asset not found');
  });

  it('should return 404 if active version not found', async () => {
    const mockAsset = {
      id: 'test-id',
      active_version: 2,
      versions: [
        {
          version: 1,
          created_at: '2026-01-13T00:00:00Z',
          prompt_used: 'Test',
          file_path: '/uploads/test-id/v1.png'
        }
      ]
    };

    (getAsset as jest.Mock).mockResolvedValue(mockAsset);

    const request = new NextRequest('http://localhost/api/assets/test-id/preview', {
      method: 'GET'
    });

    const response = await GET(request, {
      params: Promise.resolve({ assetId: 'test-id' })
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Active version not found');
  });

  it('should return 400 if assetId is invalid', async () => {
    const request = new NextRequest('http://localhost/api/assets/ /preview', {
      method: 'GET'
    });

    const response = await GET(request, {
      params: Promise.resolve({ assetId: ' ' })
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid asset ID');
  });
});
