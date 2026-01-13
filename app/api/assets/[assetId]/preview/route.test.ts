import { POST } from './route';
import { generatePreview } from '@/lib/preview';
import { NextRequest } from 'next/server';

jest.mock('@/lib/preview');
jest.mock('@/lib/history');

describe('POST /api/assets/[assetId]/preview', () => {
  it('should generate preview and return result', async () => {
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

    const response = await POST(request, { params: { assetId: 'test-id' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.previewUrl).toBe('/uploads/test-id/preview-v1.png');
    expect(generatePreview).toHaveBeenCalledWith('test-id', 1);
  });

  it('should use active version if version not specified', async () => {
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

    // Mock readHistory to return asset with active_version
    const { readHistory } = require('@/lib/history');
    (readHistory as jest.Mock).mockResolvedValue({
      assets: [{ id: 'test-id', active_version: 2 }]
    });

    const response = await POST(request, { params: { assetId: 'test-id' } });
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(generatePreview).toHaveBeenCalledWith('test-id', 2);
  });

  it('should return error if generation fails', async () => {
    (generatePreview as jest.Mock).mockResolvedValue({
      success: false,
      error: 'Composition failed'
    });

    const request = new NextRequest('http://localhost/api/assets/test-id/preview', {
      method: 'POST',
      body: JSON.stringify({ version: 1 })
    });

    const response = await POST(request, { params: { assetId: 'test-id' } });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Composition failed');
  });
});
