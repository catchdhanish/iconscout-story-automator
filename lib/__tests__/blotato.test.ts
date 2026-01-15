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
    // Mock Step 1: Media upload response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        mediaUrl: 'https://media.blotato.com/test.png',
        mediaId: 'media_123',
      }),
    });

    // Mock Step 2: Schedule post response
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

    // Verify TWO API calls were made
    expect(global.fetch).toHaveBeenCalledTimes(2);

    // Verify Step 1: Media upload call
    const [uploadUrl, uploadOptions] = (global.fetch as jest.Mock).mock.calls[0];
    expect(uploadUrl).toBe('https://api.blotato.com/v2/media/upload');
    expect(uploadOptions.method).toBe('POST');
    expect(uploadOptions.headers['blotato-api-key']).toBe('test-api-key');
    expect(uploadOptions.body).toBeInstanceOf(FormData);
    const uploadFormData = uploadOptions.body as FormData;
    expect(uploadFormData.get('file')).toBeInstanceOf(Blob);

    // Verify Step 2: Schedule post call
    const [scheduleUrl, scheduleOptions] = (global.fetch as jest.Mock).mock.calls[1];
    expect(scheduleUrl).toBe('https://api.blotato.com/v2/posts');
    expect(scheduleOptions.method).toBe('POST');
    expect(scheduleOptions.headers['blotato-api-key']).toBe('test-api-key');
    expect(scheduleOptions.headers['Content-Type']).toBe('application/json');

    // Verify JSON body contents
    const bodyData = JSON.parse(scheduleOptions.body);
    expect(bodyData.accountId).toBe('test-account-id');
    expect(bodyData.scheduledTime).toBe('2026-01-15T10:00:00.000Z');
    expect(bodyData.mediaUrls).toEqual(['https://media.blotato.com/test.png']);
    expect(bodyData.content.platform).toBe('instagram');
    expect(bodyData.target.targetType).toBe('story');
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

  it('should throw error on network failure during upload', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    await expect(
      scheduleStory(mockImagePath, mockScheduledTime)
    ).rejects.toThrow('Network error');

    // Should only call upload, not schedule
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should throw error on network failure during scheduling', async () => {
    // Mock successful upload
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        mediaUrl: 'https://media.blotato.com/test.png',
        mediaId: 'media_123',
      }),
    });

    // Mock network failure on schedule
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    await expect(
      scheduleStory(mockImagePath, mockScheduledTime)
    ).rejects.toThrow('Network error');

    // Both calls should have been attempted
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should throw error on timeout during upload', async () => {
    // Mock abort error for timeout during upload
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
    ).rejects.toThrow('Media upload timeout after 15 seconds');

    // Should only call upload
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should throw error on timeout during scheduling', async () => {
    // Mock successful upload
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        mediaUrl: 'https://media.blotato.com/test.png',
        mediaId: 'media_123',
      }),
    });

    // Mock abort error for timeout during scheduling
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

    // Both calls should have been attempted
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should throw error on 401 unauthorized response during upload', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Invalid API key',
    });

    await expect(
      scheduleStory(mockImagePath, mockScheduledTime)
    ).rejects.toThrow('Media upload failed with HTTP 401: Invalid API key');

    // Should only call upload
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should throw error on 401 unauthorized response during scheduling', async () => {
    // Mock successful upload
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        mediaUrl: 'https://media.blotato.com/test.png',
        mediaId: 'media_123',
      }),
    });

    // Mock 401 on schedule
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Invalid API key',
    });

    await expect(
      scheduleStory(mockImagePath, mockScheduledTime)
    ).rejects.toThrow('Schedule post failed with HTTP 401: Invalid API key');

    // Both calls should have been attempted
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should throw error on 500 server error during upload', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Server error occurred',
    });

    await expect(
      scheduleStory(mockImagePath, mockScheduledTime)
    ).rejects.toThrow('Media upload failed with HTTP 500: Server error occurred');

    // Should only call upload
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should throw error on 500 server error during scheduling', async () => {
    // Mock successful upload
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        mediaUrl: 'https://media.blotato.com/test.png',
        mediaId: 'media_123',
      }),
    });

    // Mock 500 on schedule
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Server error occurred',
    });

    await expect(
      scheduleStory(mockImagePath, mockScheduledTime)
    ).rejects.toThrow('Schedule post failed with HTTP 500: Server error occurred');

    // Both calls should have been attempted
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should throw error when upload response is missing mediaUrl', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        mediaId: 'media_123',
        // missing mediaUrl
      }),
    });

    await expect(
      scheduleStory(mockImagePath, mockScheduledTime)
    ).rejects.toThrow('Media upload response missing required field: mediaUrl');

    // Should only call upload
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should throw error when schedule response is missing postId', async () => {
    // Mock successful upload
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        mediaUrl: 'https://media.blotato.com/test.png',
        mediaId: 'media_123',
      }),
    });

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

    // Both calls should have been attempted
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should handle different image file types', async () => {
    const jpgPath = '/path/to/image.jpg';

    // Mock Step 1: Media upload response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        mediaUrl: 'https://media.blotato.com/test.jpg',
        mediaId: 'media_456',
      }),
    });

    // Mock Step 2: Schedule post response
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

    // Verify TWO API calls were made
    expect(global.fetch).toHaveBeenCalledTimes(2);

    // Verify file name in upload FormData
    const [, uploadOptions] = (global.fetch as jest.Mock).mock.calls[0];
    const formData = uploadOptions.body as FormData;
    const imageFile = formData.get('file') as File;
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

    // Mock Step 1: Media upload response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        mediaUrl: 'https://media.custom.com/test.png',
        mediaId: 'media_789',
      }),
    });

    // Mock Step 2: Schedule post response
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

    // Verify TWO API calls were made
    expect(global.fetch).toHaveBeenCalledTimes(2);

    // Verify custom base URL used for both endpoints
    const [uploadUrl] = (global.fetch as jest.Mock).mock.calls[0];
    expect(uploadUrl).toBe('https://custom.api.com/v2/media/upload');

    const [scheduleUrl] = (global.fetch as jest.Mock).mock.calls[1];
    expect(scheduleUrl).toBe('https://custom.api.com/v2/posts');

    // Restore baseUrl
    Object.defineProperty(config.blotato, 'baseUrl', {
      value: tempBaseUrl,
      writable: true,
      configurable: true,
    });
  });

  it('should handle error when response text fails during upload', async () => {
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
    ).rejects.toThrow('Media upload failed with HTTP 503: Service Unavailable');

    // Should only call upload
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should handle error when response text fails during scheduling', async () => {
    // Mock successful upload
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        mediaUrl: 'https://media.blotato.com/test.png',
        mediaId: 'media_123',
      }),
    });

    // Mock schedule error
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

    // Both calls should have been attempted
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
