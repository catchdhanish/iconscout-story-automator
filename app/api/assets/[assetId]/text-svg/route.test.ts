/**
 * Tests for GET /api/assets/[assetId]/text-svg endpoint
 * Tests text SVG generation with positioning and shadow metadata
 */

import { NextRequest } from 'next/server';
import { GET } from './route';

// Mock dependencies
jest.mock('@/lib/history', () => ({
  readHistory: jest.fn(),
}));

jest.mock('@/lib/text-overlay', () => ({
  generateTextSVG: jest.fn(),
}));

jest.mock('@/lib/config', () => ({
  config: {
    textOverlay: {
      defaultContent: 'Get this exclusive premium asset for free (today only!) - link in bio',
      positioning: {
        tier1Y: 1560,
        tier2Y: 1520,
        tier3Y: 1480,
        maxWidth: 900,
      },
      font: {
        size: 42,
        weight: '700',
      }
    }
  }
}));

import { readHistory } from '@/lib/history';
import { generateTextSVG } from '@/lib/text-overlay';

describe('GET /api/assets/[assetId]/text-svg', () => {
  const mockReadHistory = readHistory as jest.MockedFunction<typeof readHistory>;
  const mockGenerateTextSVG = generateTextSVG as jest.MockedFunction<typeof generateTextSVG>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate SVG with asset text_overlay_analytics', async () => {
    const mockAsset = {
      id: 'test-asset-id',
      text_overlay_content: 'Custom asset text',
      text_overlay_analytics: {
        position_tier_used: 2,
        shadow_type: 'dark',
        lines_count: 2,
        applied_at: '2024-01-01T00:00:00.000Z',
      },
    };

    mockReadHistory.mockResolvedValue({
      assets: [mockAsset as any],
    });

    mockGenerateTextSVG.mockReturnValue('<svg>Mock SVG</svg>');

    const request = new NextRequest('http://localhost:3000/api/assets/test-asset-id/text-svg');
    const response = await GET(request, { params: { assetId: 'test-asset-id' } });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({
      svg: '<svg>Mock SVG</svg>',
      position_y: 1520, // tier2Y
      position_tier: 2,
      shadow_color: '#000000', // dark shadow
    });

    expect(mockGenerateTextSVG).toHaveBeenCalledWith({
      text: 'Custom asset text',
      x: 540,
      y: 1520,
      fontSize: 42,
      fontWeight: '700',
      color: '#FFFFFF',
      shadowColor: '#000000',
      maxWidth: 900,
    });
  });

  it('should support custom content via query parameter', async () => {
    const mockAsset = {
      id: 'test-asset-id',
      text_overlay_content: 'Original text',
      text_overlay_analytics: {
        position_tier_used: 1,
        shadow_type: 'light',
        lines_count: 1,
        applied_at: '2024-01-01T00:00:00.000Z',
      },
    };

    mockReadHistory.mockResolvedValue({
      assets: [mockAsset as any],
    });

    mockGenerateTextSVG.mockReturnValue('<svg>Custom SVG</svg>');

    const request = new NextRequest('http://localhost:3000/api/assets/test-asset-id/text-svg?content=Override%20text');
    const response = await GET(request, { params: { assetId: 'test-asset-id' } });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({
      svg: '<svg>Custom SVG</svg>',
      position_y: 1560, // tier1Y
      position_tier: 1,
      shadow_color: '#FFFFFF', // light shadow
    });

    expect(mockGenerateTextSVG).toHaveBeenCalledWith({
      text: 'Override text',
      x: 540,
      y: 1560,
      fontSize: 42,
      fontWeight: '700',
      color: '#FFFFFF',
      shadowColor: '#FFFFFF',
      maxWidth: 900,
    });
  });

  it('should return 404 if asset not found', async () => {
    mockReadHistory.mockResolvedValue({
      assets: [],
    });

    const request = new NextRequest('http://localhost:3000/api/assets/nonexistent/text-svg');
    const response = await GET(request, { params: { assetId: 'nonexistent' } });

    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data).toEqual({
      error: 'Asset not found',
    });

    expect(mockGenerateTextSVG).not.toHaveBeenCalled();
  });

  it('should use default values if text_overlay_analytics is missing', async () => {
    const mockAsset = {
      id: 'test-asset-id',
      text_overlay_content: 'Asset text',
      // No text_overlay_analytics
    };

    mockReadHistory.mockResolvedValue({
      assets: [mockAsset as any],
    });

    mockGenerateTextSVG.mockReturnValue('<svg>Default SVG</svg>');

    const request = new NextRequest('http://localhost:3000/api/assets/test-asset-id/text-svg');
    const response = await GET(request, { params: { assetId: 'test-asset-id' } });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({
      svg: '<svg>Default SVG</svg>',
      position_y: 1520, // default to tier2Y
      position_tier: 2,
      shadow_color: '#000000', // default to dark
    });

    expect(mockGenerateTextSVG).toHaveBeenCalledWith({
      text: 'Asset text',
      x: 540,
      y: 1520,
      fontSize: 42,
      fontWeight: '700',
      color: '#FFFFFF',
      shadowColor: '#000000',
      maxWidth: 900,
    });
  });

  it('should use default content if text_overlay_content is missing', async () => {
    const mockAsset = {
      id: 'test-asset-id',
      text_overlay_analytics: {
        position_tier_used: 3,
        shadow_type: 'dark',
        lines_count: 2,
        applied_at: '2024-01-01T00:00:00.000Z',
      },
    };

    mockReadHistory.mockResolvedValue({
      assets: [mockAsset as any],
    });

    mockGenerateTextSVG.mockReturnValue('<svg>Default content SVG</svg>');

    const request = new NextRequest('http://localhost:3000/api/assets/test-asset-id/text-svg');
    const response = await GET(request, { params: { assetId: 'test-asset-id' } });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.svg).toBe('<svg>Default content SVG</svg>');

    expect(mockGenerateTextSVG).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Get this exclusive premium asset for free (today only!) - link in bio',
        y: 1480, // tier3Y
        shadowColor: '#000000',
      })
    );
  });

  it('should return 500 if an unexpected error occurs', async () => {
    const { readHistory } = require('@/lib/history');
    (readHistory as jest.Mock).mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/assets/test-id/text-svg');
    const response = await GET(request, { params: { assetId: 'test-id' } });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to generate text SVG');
  });
});
