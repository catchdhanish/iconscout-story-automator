/**
 * Tests for configuration utility
 */

import { validateConfig } from '../config';

describe('Configuration Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it('should throw error when OPENROUTER_API_KEY is missing', () => {
    // Set BLOTATO_API_KEY but clear OPENROUTER_API_KEY
    process.env.BLOTATO_API_KEY = 'test-blotato-key';
    delete process.env.OPENROUTER_API_KEY;

    // Re-import config to get updated environment
    jest.isolateModules(() => {
      const { validateConfig: validate } = require('../config');
      expect(() => validate()).toThrow('Missing required environment variables: OPENROUTER_API_KEY');
    });
  });

  it('should throw error when BLOTATO_API_KEY is missing', () => {
    // Set OPENROUTER_API_KEY but clear BLOTATO_API_KEY
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    delete process.env.BLOTATO_API_KEY;

    // Re-import config to get updated environment
    jest.isolateModules(() => {
      const { validateConfig: validate } = require('../config');
      expect(() => validate()).toThrow('Missing required environment variables: BLOTATO_API_KEY');
    });
  });

  it('should throw error when both API keys are missing', () => {
    // Clear both environment variables
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.BLOTATO_API_KEY;

    // Re-import config to get updated environment
    jest.isolateModules(() => {
      const { validateConfig: validate } = require('../config');
      expect(() => validate()).toThrow('Missing required environment variables: OPENROUTER_API_KEY, BLOTATO_API_KEY');
    });
  });

  it('should not throw error when all required environment variables are set', () => {
    // Set both required environment variables
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    process.env.BLOTATO_API_KEY = 'test-blotato-key';

    // Re-import config to get updated environment
    jest.isolateModules(() => {
      const { validateConfig: validate } = require('../config');
      expect(() => validate()).not.toThrow();
    });
  });
});
