/**
 * Test suite for Blotato API client
 */

// Mock fs/promises module first, before any imports
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

// Mock global fetch
global.fetch = jest.fn();

import { scheduleStory } from '../blotato';
import { config } from '../config';
import * as fs from 'fs/promises';

// Get references to the mocked functions
const mockFsReadFile = fs.readFile as jest.Mock;

describe('scheduleStory', () => {
  const mockImagePath = '/path/to/test/image.png';
  const mockScheduledTime = new Date('2026-01-15T10:00:00Z');
  const mockImageBuffer = Buffer.from('fake-image-data');
  const originalApiKey = config.blotato.apiKey;
  const originalAccountId = config.blotato.accountId;

  beforeEach(() => {
    // Clear mock calls from previous tests
    (global.fetch as jest.Mock).mockClear();
    mockFsReadFile.mockClear();

    // Set up environment variables
    process.env.BLOTATO_API_KEY = 'test-api-key';
    process.env.BLOTATO_ACCOUNT_ID = 'test-account-id';
    (config.blotato as any).apiKey = 'test-api-key';
    (config.blotato as any).accountId = 'test-account-id';
    (config.blotato as any).baseUrl = 'https://api.blotato.com';

    // Set up mock implementation for this test
    mockFsReadFile.mockResolvedValue(mockImageBuffer);
  });

  afterEach(() => {
    // Restore original config
    (config.blotato as any).apiKey = originalApiKey;
    (config.blotato as any).accountId = originalAccountId;
  });

  it('should successfully schedule a story', async () => {
    // Mock successful API response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          post_id: 'blotato_post_12345',
          scheduled_time: '2026-01-15T10:00:00Z',
          status: 'scheduled',
        },
      }),
    });

    const postId = await scheduleStory(mockImagePath, mockScheduledTime);

    expect(postId).toBe('blotato_post_12345');

    // Verify API call
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api.blotato.com/v1/instagram/stories/schedule');
    expect(options.method).toBe('POST');
    expect(options.headers['Authorization']).toBe('Bearer test-api-key');

    // Verify FormData contents
    const formData = options.body as FormData;
    expect(formData.get('account_id')).toBe('test-account-id');
    expect(formData.get('scheduled_time')).toBe('2026-01-15T10:00:00.000Z');
    expect(formData.get('image')).toBeInstanceOf(Blob);
  });

  it('should throw error when API key is missing', async () => {
    // Temporarily remove the apiKey from config
    const tempApiKey = (config.blotato as any).apiKey;
    Object.defineProperty(config.blotato, 'apiKey', {
      value: '',
      writable: true,
      configurable: true,
    });

    await expect(
      scheduleStory(mockImagePath, mockScheduledTime)
    ).rejects.toThrow('BLOTATO_API_KEY is not configured');

    // Restore apiKey
    Object.defineProperty(config.blotato, 'apiKey', {
      value: tempApiKey,
      writable: true,
      configurable: true,
    });
  });

  it('should throw error when account ID is missing', async () => {
    // Temporarily remove the accountId from config
    const tempAccountId = (config.blotato as any).accountId;
    Object.defineProperty(config.blotato, 'accountId', {
      value: '',
      writable: true,
      configurable: true,
    });

    await expect(
      scheduleStory(mockImagePath, mockScheduledTime)
    ).rejects.toThrow('BLOTATO_ACCOUNT_ID is not configured');

    // Restore accountId
    Object.defineProperty(config.blotato, 'accountId', {
      value: tempAccountId,
      writable: true,
      configurable: true,
    });
  });

  it('should throw error when image file is missing', async () => {
    mockFsReadFile.mockRejectedValueOnce(new Error('ENOENT: file not found'));

    await expect(
      scheduleStory(mockImagePath, mockScheduledTime)
    ).rejects.toThrow('Image file not found: /path/to/test/image.png');

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should throw error on network failure', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    await expect(
      scheduleStory(mockImagePath, mockScheduledTime)
    ).rejects.toThrow('Network error');
  });

  it('should throw error on timeout', async () => {
    // Mock abort error for timeout
    (global.fetch as jest.Mock).mockImplementationOnce(() => {
      return new Promise((_, reject) => {
        setTimeout(() => {
          const error = new Error('The operation was aborted');
          error.name = 'AbortError';
          reject(error);
        }, 100);
      });
    });

    await expect(
      scheduleStory(mockImagePath, mockScheduledTime)
    ).rejects.toThrow('Request timeout after 15 seconds');
  });

  it('should throw error on 401 unauthorized response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Invalid API key',
    });

    await expect(
      scheduleStory(mockImagePath, mockScheduledTime)
    ).rejects.toThrow('HTTP 401: Invalid API key');
  });

  it('should throw error on 500 server error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Server error occurred',
    });

    await expect(
      scheduleStory(mockImagePath, mockScheduledTime)
    ).rejects.toThrow('HTTP 500: Server error occurred');
  });

  it('should throw error when response has success: false', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: false,
        error: 'Scheduling failed',
      }),
    });

    await expect(
      scheduleStory(mockImagePath, mockScheduledTime)
    ).rejects.toThrow('API returned success: false');
  });

  it('should throw error when response is missing post_id', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          scheduled_time: '2026-01-15T10:00:00Z',
          status: 'scheduled',
          // missing post_id
        },
      }),
    });

    await expect(
      scheduleStory(mockImagePath, mockScheduledTime)
    ).rejects.toThrow('Response missing required field: data.post_id');
  });

  it('should throw error when response is missing data object', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        // missing data object
      }),
    });

    await expect(
      scheduleStory(mockImagePath, mockScheduledTime)
    ).rejects.toThrow('Response missing required field: data.post_id');
  });

  it('should handle different image file types', async () => {
    const jpgPath = '/path/to/image.jpg';

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          post_id: 'blotato_post_67890',
          scheduled_time: '2026-01-15T10:00:00Z',
          status: 'scheduled',
        },
      }),
    });

    const postId = await scheduleStory(jpgPath, mockScheduledTime);

    expect(postId).toBe('blotato_post_67890');

    // Verify file name in FormData
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    const formData = options.body as FormData;
    const imageFile = formData.get('image') as File;
    expect(imageFile.name).toBe('image.jpg');
  });

  it('should use custom base URL when BLOTATO_API_BASE_URL is set', async () => {
    // Temporarily change the baseUrl
    const tempBaseUrl = (config.blotato as any).baseUrl;
    Object.defineProperty(config.blotato, 'baseUrl', {
      value: 'https://custom.api.com',
      writable: true,
      configurable: true,
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          post_id: 'blotato_post_12345',
          scheduled_time: '2026-01-15T10:00:00Z',
          status: 'scheduled',
        },
      }),
    });

    await scheduleStory(mockImagePath, mockScheduledTime);

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://custom.api.com/v1/instagram/stories/schedule');

    // Restore baseUrl
    Object.defineProperty(config.blotato, 'baseUrl', {
      value: tempBaseUrl,
      writable: true,
      configurable: true,
    });
  });

  it('should handle error when response text fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      text: async () => {
        throw new Error('Failed to read response');
      },
    });

    await expect(
      scheduleStory(mockImagePath, mockScheduledTime)
    ).rejects.toThrow('HTTP 503: Service Unavailable');
  });
});
