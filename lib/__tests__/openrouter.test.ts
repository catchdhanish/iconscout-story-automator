/**
 * Test suite for OpenRouter API client
 */

import { generateBackground } from '../openrouter';
import { config } from '../config';

// Mock fetch globally
global.fetch = jest.fn();

describe('OpenRouter API Client', () => {
  const mockSystemPrompt = 'You are an expert background designer';
  const mockUserPrompt = 'Create a gradient background with blue and purple colors';
  const originalApiKey = config.openrouter.apiKey;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Restore API key
    (config.openrouter as any).apiKey = originalApiKey || 'test-api-key';
  });

  afterEach(() => {
    // Restore original API key
    (config.openrouter as any).apiKey = originalApiKey;
  });

  describe('generateBackground', () => {
    it('should successfully generate background', async () => {
      // Mock successful API response
      const mockResponse = {
        id: 'gen-123',
        model: 'google/gemini-2.0-flash-exp:free',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'A vibrant gradient background with smooth transitions from deep blue to purple'
            },
            finish_reason: 'stop'
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      });

      const result = await generateBackground(mockSystemPrompt, mockUserPrompt);

      // Verify result
      expect(result).toBe('A vibrant gradient background with smooth transitions from deep blue to purple');

      // Verify fetch was called correctly
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': expect.stringContaining('Bearer'),
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://iconscout.com',
            'X-Title': 'IconScout Story Automator'
          },
          body: expect.stringContaining('google/gemini-2.5-flash-image'),
          signal: expect.any(AbortSignal)
        })
      );

      // Verify request body
      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body).toEqual({
        model: 'google/gemini-2.5-flash-image',
        messages: [
          { role: 'system', content: mockSystemPrompt },
          { role: 'user', content: mockUserPrompt }
        ],
        temperature: 0.7
      });
    });

    it('should throw error when API key is missing', async () => {
      // Remove API key
      (config.openrouter as any).apiKey = '';

      await expect(
        generateBackground(mockSystemPrompt, mockUserPrompt)
      ).rejects.toThrow('OPENROUTER_API_KEY environment variable is required');

      // Verify fetch was not called
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should throw error on network failure', async () => {
      // Mock network error
      (global.fetch as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(
        generateBackground(mockSystemPrompt, mockUserPrompt)
      ).rejects.toThrow('Network error: Failed to fetch');
    });

    it('should throw error on timeout', async () => {
      // Mock timeout by delaying response beyond timeout period
      (global.fetch as any).mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          }, 100);
        });
      });

      await expect(
        generateBackground(mockSystemPrompt, mockUserPrompt)
      ).rejects.toThrow(/Request timeout after \d+ms/);
    });

    it('should throw error on 401 unauthorized response', async () => {
      // Mock 401 response
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key'
      });

      await expect(
        generateBackground(mockSystemPrompt, mockUserPrompt)
      ).rejects.toThrow('OpenRouter API error: 401 - Invalid API key');
    });

    it('should throw error on 500 server error response', async () => {
      // Mock 500 response
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error'
      });

      await expect(
        generateBackground(mockSystemPrompt, mockUserPrompt)
      ).rejects.toThrow('OpenRouter API error: 500 - Internal server error');
    });

    it('should throw error on invalid response format (missing choices)', async () => {
      // Mock response without choices
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'gen-123',
          model: 'google/gemini-2.0-flash-exp:free'
        })
      });

      await expect(
        generateBackground(mockSystemPrompt, mockUserPrompt)
      ).rejects.toThrow('Invalid response format: missing choices array');
    });

    it('should throw error on invalid response format (empty choices array)', async () => {
      // Mock response with empty choices array
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'gen-123',
          model: 'google/gemini-2.0-flash-exp:free',
          choices: []
        })
      });

      await expect(
        generateBackground(mockSystemPrompt, mockUserPrompt)
      ).rejects.toThrow('Invalid response format: missing choices array');
    });

    it('should throw error on invalid response format (missing message content)', async () => {
      // Mock response without message content
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'gen-123',
          model: 'google/gemini-2.0-flash-exp:free',
          choices: [
            {
              message: {
                role: 'assistant'
              }
            }
          ]
        })
      });

      await expect(
        generateBackground(mockSystemPrompt, mockUserPrompt)
      ).rejects.toThrow('Invalid response format: no content found');
    });
  });
});
