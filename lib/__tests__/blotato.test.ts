/**
 * Test suite for Blotato API client
 */

// Mock fs/promises module first, before any imports
jest.mock('fs/promises', () => ({
  access: jest.fn(),
}));

// Mock global fetch
global.fetch = jest.fn();

import { scheduleStory } from '../blotato';
import { config } from '../config';
import * as fs from 'fs/promises';

// Get references to the mocked functions
const mockFsAccess = fs.access as jest.Mock;

describe('scheduleStory', () => {
  const mockImagePath = '/path/to/test/image.png';
  const mockScheduledTime = new Date('2026-01-15T10:00:00Z');
  const originalApiKey = config.blotato.apiKey;
  const originalAccountId = config.blotato.accountId;

  beforeEach(() => {
    // Clear mock calls from previous tests
    (global.fetch as jest.Mock).mockClear();
    mockFsAccess.mockClear();

    // Set up environment variables
    process.env.BLOTATO_API_KEY = 'test-api-key';
    process.env.BLOTATO_ACCOUNT_ID = 'test-account-id';
    (config.blotato as any).apiKey = 'test-api-key';
    (config.blotato as any).accountId = 'test-account-id';
    (config.blotato as any).baseUrl = 'https://api.blotato.com';

    // Set up mock implementation - file exists by default
    mockFsAccess.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restore original config
    (config.blotato as any).apiKey = originalApiKey;
    (config.blotato as any).accountId = originalAccountId;
  });

  it('should successfully schedule a story', async () => {
    // Mock successful response (SINGLE call)
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        postId: 'blotato_post_12345',
        status: 'scheduled',
        scheduledTime: '2026-01-15T10:00:00.000Z',
      }),
    });

    const postId = await scheduleStory(mockImagePath, mockScheduledTime);

    expect(postId).toBe('blotato_post_12345');

    // Verify SINGLE API call was made
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Verify endpoint
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api.blotato.com/v2/posts');
    expect(options.method).toBe('POST');

    // Verify headers
    expect(options.headers['blotato-api-key']).toBe('test-api-key');
    expect(options.headers['Content-Type']).toBe('application/json');

    // Verify payload has "post" wrapper
    const body = JSON.parse(options.body);
    expect(body).toHaveProperty('post');
    expect(body.post.accountId).toBe('test-account-id');
    expect(body.post.scheduledTime).toBe('2026-01-15T10:00:00.000Z');
    expect(body.post.content.mediaUrls).toEqual([
      expect.stringContaining('/path/to/test/image.png')  // Public URL
    ]);
    expect(body.post.content.platform).toBe('instagram');
    expect(body.post.target.targetType).toBe('instagram');
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
    mockFsAccess.mockRejectedValueOnce(new Error('ENOENT: file not found'));

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

    // Should only call schedule endpoint once
    expect(global.fetch).toHaveBeenCalledTimes(1);
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
    ).rejects.toThrow('Schedule post timeout after 15 seconds');

    // Should only call schedule endpoint once
    expect(global.fetch).toHaveBeenCalledTimes(1);
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
    ).rejects.toThrow('Schedule post failed with HTTP 401: Invalid API key');

    // Should only call schedule endpoint once
    expect(global.fetch).toHaveBeenCalledTimes(1);
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
    ).rejects.toThrow('Schedule post failed with HTTP 500: Server error occurred');

    // Should only call schedule endpoint once
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should throw error when schedule response is missing postId', async () => {
    // Mock schedule response missing postId
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'scheduled',
        scheduledTime: '2026-01-15T10:00:00.000Z',
        // missing postId
      }),
    });

    await expect(
      scheduleStory(mockImagePath, mockScheduledTime)
    ).rejects.toThrow('Schedule response missing required field: postId');

    // Should only call schedule endpoint once
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should handle different image file types', async () => {
    const jpgPath = '/path/to/image.jpg';

    // Mock successful response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        postId: 'blotato_post_67890',
        status: 'scheduled',
        scheduledTime: '2026-01-15T10:00:00.000Z',
      }),
    });

    const postId = await scheduleStory(jpgPath, mockScheduledTime);

    expect(postId).toBe('blotato_post_67890');

    // Verify SINGLE API call was made
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Verify public URL contains the jpg path
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.post.content.mediaUrls).toEqual([
      expect.stringContaining('/path/to/image.jpg')
    ]);
  });

  it('should use custom base URL when BLOTATO_API_BASE_URL is set', async () => {
    // Temporarily change the baseUrl
    const tempBaseUrl = (config.blotato as any).baseUrl;
    Object.defineProperty(config.blotato, 'baseUrl', {
      value: 'https://custom.api.com',
      writable: true,
      configurable: true,
    });

    // Mock successful response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        postId: 'blotato_post_12345',
        status: 'scheduled',
        scheduledTime: '2026-01-15T10:00:00.000Z',
      }),
    });

    await scheduleStory(mockImagePath, mockScheduledTime);

    // Verify SINGLE API call was made
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Verify custom base URL used for schedule endpoint
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://custom.api.com/v2/posts');

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
    ).rejects.toThrow('Schedule post failed with HTTP 503: Service Unavailable');

    // Should only call schedule endpoint once
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
