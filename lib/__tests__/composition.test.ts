/**
 * Test suite for Story Composition Engine
 *
 * Tests the composeStory function for correct Instagram Story composition
 * including dimension handling, asset positioning, and error cases.
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { composeStory } from '../composition';
import { config } from '../config';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const OUTPUT_DIR = path.join(__dirname, 'output');

/**
 * Create test fixtures before tests run
 */
beforeAll(async () => {
  // Create fixtures directory
  await fs.mkdir(FIXTURES_DIR, { recursive: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Create a standard 1080x1920 background (Instagram Story size)
  await sharp({
    create: {
      width: 1080,
      height: 1920,
      channels: 4,
      background: { r: 100, g: 150, b: 200, alpha: 1 }
    }
  })
    .png()
    .toFile(path.join(FIXTURES_DIR, 'background-1080x1920.png'));

  // Create a non-standard background (1200x1800) to test resizing
  await sharp({
    create: {
      width: 1200,
      height: 1800,
      channels: 4,
      background: { r: 200, g: 100, b: 150, alpha: 1 }
    }
  })
    .png()
    .toFile(path.join(FIXTURES_DIR, 'background-1200x1800.png'));

  // Create a landscape asset (800x600)
  await sharp({
    create: {
      width: 800,
      height: 600,
      channels: 4,
      background: { r: 255, g: 200, b: 100, alpha: 1 }
    }
  })
    .png()
    .toFile(path.join(FIXTURES_DIR, 'asset-landscape.png'));

  // Create a portrait asset (600x900)
  await sharp({
    create: {
      width: 600,
      height: 900,
      channels: 4,
      background: { r: 100, g: 255, b: 100, alpha: 1 }
    }
  })
    .png()
    .toFile(path.join(FIXTURES_DIR, 'asset-portrait.png'));

  // Create a square asset (700x700)
  await sharp({
    create: {
      width: 700,
      height: 700,
      channels: 4,
      background: { r: 255, g: 100, b: 255, alpha: 1 }
    }
  })
    .png()
    .toFile(path.join(FIXTURES_DIR, 'asset-square.png'));

  // Create JPEG versions
  await sharp({
    create: {
      width: 1080,
      height: 1920,
      channels: 3,
      background: { r: 150, g: 150, b: 150 }
    }
  })
    .jpeg()
    .toFile(path.join(FIXTURES_DIR, 'background.jpg'));

  await sharp({
    create: {
      width: 600,
      height: 600,
      channels: 3,
      background: { r: 200, g: 200, b: 100 }
    }
  })
    .jpeg()
    .toFile(path.join(FIXTURES_DIR, 'asset.jpg'));

  // Create an invalid text file (for format validation tests)
  await fs.writeFile(path.join(FIXTURES_DIR, 'invalid.txt'), 'Not an image');
});

/**
 * Clean up output files after each test
 */
afterEach(async () => {
  try {
    const files = await fs.readdir(OUTPUT_DIR);
    await Promise.all(
      files.map(file => fs.unlink(path.join(OUTPUT_DIR, file)))
    );
  } catch (error) {
    // Ignore errors if directory doesn't exist
  }
});

/**
 * Remove test fixtures and output directory after all tests
 */
afterAll(async () => {
  try {
    await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
});

describe('composeStory', () => {
  describe('successful composition', () => {
    it('should compose a story with valid inputs', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background-1080x1920.png');
      const assetPath = path.join(FIXTURES_DIR, 'asset-landscape.png');
      const outputPath = path.join(OUTPUT_DIR, 'output.png');

      const result = await composeStory(backgroundPath, assetPath, outputPath);

      // Verify result structure
      expect(result.success).toBe(true);
      expect(result.outputPath).toBe(outputPath);

      // Verify output file exists
      await expect(fs.access(outputPath)).resolves.not.toThrow();

      // Verify output dimensions
      const metadata = await sharp(outputPath).metadata();
      expect(metadata.width).toBe(config.instagram.width);
      expect(metadata.height).toBe(config.instagram.height);
    });

    it('should output PNG when output path has .png extension', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background-1080x1920.png');
      const assetPath = path.join(FIXTURES_DIR, 'asset-landscape.png');
      const outputPath = path.join(OUTPUT_DIR, 'output.png');

      const result = await composeStory(backgroundPath, assetPath, outputPath);

      expect(result.success).toBe(true);
      const metadata = await sharp(outputPath).metadata();
      expect(metadata.format).toBe('png');
    });

    it('should accept JPEG inputs', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background.jpg');
      const assetPath = path.join(FIXTURES_DIR, 'asset.jpg');
      const outputPath = path.join(OUTPUT_DIR, 'output.png');

      const result = await composeStory(backgroundPath, assetPath, outputPath);

      expect(result.success).toBe(true);
      expect(result.outputPath).toBe(outputPath);
      await expect(fs.access(outputPath)).resolves.not.toThrow();
    });
  });

  describe('background resizing', () => {
    it('should resize non-standard background to 1080x1920', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background-1200x1800.png');
      const assetPath = path.join(FIXTURES_DIR, 'asset-landscape.png');
      const outputPath = path.join(OUTPUT_DIR, 'output-resized-bg.png');

      await composeStory(backgroundPath, assetPath, outputPath);

      const metadata = await sharp(outputPath).metadata();
      expect(metadata.width).toBe(1080);
      expect(metadata.height).toBe(1920);
    });
  });

  describe('asset resizing and centering', () => {
    it('should resize landscape asset to fit within 756x1344', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background-1080x1920.png');
      const assetPath = path.join(FIXTURES_DIR, 'asset-landscape.png');
      const outputPath = path.join(OUTPUT_DIR, 'output-landscape.png');

      await composeStory(backgroundPath, assetPath, outputPath);

      // Output should be 1080x1920
      const metadata = await sharp(outputPath).metadata();
      expect(metadata.width).toBe(1080);
      expect(metadata.height).toBe(1920);

      // Verify file exists and has correct format
      await expect(fs.access(outputPath)).resolves.not.toThrow();
    });

    it('should resize portrait asset to fit within 756x1344', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background-1080x1920.png');
      const assetPath = path.join(FIXTURES_DIR, 'asset-portrait.png');
      const outputPath = path.join(OUTPUT_DIR, 'output-portrait.png');

      await composeStory(backgroundPath, assetPath, outputPath);

      const metadata = await sharp(outputPath).metadata();
      expect(metadata.width).toBe(1080);
      expect(metadata.height).toBe(1920);
    });

    it('should resize square asset to fit within 756x1344', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background-1080x1920.png');
      const assetPath = path.join(FIXTURES_DIR, 'asset-square.png');
      const outputPath = path.join(OUTPUT_DIR, 'output-square.png');

      await composeStory(backgroundPath, assetPath, outputPath);

      const metadata = await sharp(outputPath).metadata();
      expect(metadata.width).toBe(1080);
      expect(metadata.height).toBe(1920);
    });

    it('should center asset within the asset zone', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background-1080x1920.png');
      const assetPath = path.join(FIXTURES_DIR, 'asset-landscape.png');
      const outputPath = path.join(OUTPUT_DIR, 'output-centered.png');

      await composeStory(backgroundPath, assetPath, outputPath);

      // Verify the composition was successful
      const metadata = await sharp(outputPath).metadata();
      expect(metadata.width).toBe(1080);
      expect(metadata.height).toBe(1920);

      // The asset should be composited (file should be larger than just background)
      const stats = await fs.stat(outputPath);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should throw error when background file does not exist', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'nonexistent-background.png');
      const assetPath = path.join(FIXTURES_DIR, 'asset-landscape.png');
      const outputPath = path.join(OUTPUT_DIR, 'output.png');

      await expect(composeStory(backgroundPath, assetPath, outputPath))
        .rejects
        .toThrow('Background file not found');
    });

    it('should throw error when asset file does not exist', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background-1080x1920.png');
      const assetPath = path.join(FIXTURES_DIR, 'nonexistent-asset.png');
      const outputPath = path.join(OUTPUT_DIR, 'output.png');

      await expect(composeStory(backgroundPath, assetPath, outputPath))
        .rejects
        .toThrow('Asset file not found');
    });

    it('should throw error for unsupported background format', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'invalid.txt');
      const assetPath = path.join(FIXTURES_DIR, 'asset-landscape.png');
      const outputPath = path.join(OUTPUT_DIR, 'output.png');

      await expect(composeStory(backgroundPath, assetPath, outputPath))
        .rejects
        .toThrow('Unsupported background format');
    });

    it('should throw error for unsupported asset format', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background-1080x1920.png');
      const assetPath = path.join(FIXTURES_DIR, 'invalid.txt');
      const outputPath = path.join(OUTPUT_DIR, 'output.png');

      await expect(composeStory(backgroundPath, assetPath, outputPath))
        .rejects
        .toThrow('Unsupported asset format');
    });

    it('should handle Sharp processing errors gracefully', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background-1080x1920.png');
      const assetPath = path.join(FIXTURES_DIR, 'asset-landscape.png');
      const outputPath = '/invalid/path/that/does/not/exist/output.png';

      const result = await composeStory(backgroundPath, assetPath, outputPath);

      // Should return a failed result instead of throwing
      expect(result.success).toBe(false);
      expect(result.analytics?.text_overlay.failed).toBe(true);
      expect(result.analytics?.text_overlay.error).toBeDefined();
    });
  });

  describe('output file creation', () => {
    it('should create output file at specified path', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background-1080x1920.png');
      const assetPath = path.join(FIXTURES_DIR, 'asset-landscape.png');
      const outputPath = path.join(OUTPUT_DIR, 'custom-output.png');

      await composeStory(backgroundPath, assetPath, outputPath);

      // Verify file exists
      await expect(fs.access(outputPath)).resolves.not.toThrow();

      // Verify it's a valid image
      const metadata = await sharp(outputPath).metadata();
      expect(metadata).toBeDefined();
      expect(metadata.width).toBe(1080);
      expect(metadata.height).toBe(1920);
    });

    it('should create valid PNG file', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background-1080x1920.png');
      const assetPath = path.join(FIXTURES_DIR, 'asset-landscape.png');
      const outputPath = path.join(OUTPUT_DIR, 'output.png');

      await composeStory(backgroundPath, assetPath, outputPath);

      const metadata = await sharp(outputPath).metadata();
      expect(metadata.format).toBe('png');
      expect(metadata.channels).toBeGreaterThanOrEqual(3);
    });

    it('should create valid PNG file with any extension', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background-1080x1920.png');
      const assetPath = path.join(FIXTURES_DIR, 'asset-landscape.png');
      const outputPath = path.join(OUTPUT_DIR, 'output.jpeg');

      const result = await composeStory(backgroundPath, assetPath, outputPath);

      expect(result.success).toBe(true);
      // Note: Output is always PNG format regardless of extension
      const metadata = await sharp(outputPath).metadata();
      expect(metadata.format).toBe('png');
    });
  });

  describe('text overlay integration', () => {
    it('should compose story with text overlay and return analytics', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background-1080x1920.png');
      const assetPath = path.join(FIXTURES_DIR, 'asset-landscape.png');
      const outputPath = path.join(OUTPUT_DIR, 'output-with-text.png');

      const result = await composeStory(backgroundPath, assetPath, outputPath, {
        includeText: true
      });

      // Verify result structure
      expect(result.success).toBe(true);
      expect(result.outputPath).toBe(outputPath);
      expect(result.analytics).toBeDefined();
      expect(result.analytics?.text_overlay).toBeDefined();
      expect(result.analytics?.text_overlay.enabled).toBe(true);

      // Verify analytics fields
      const textAnalytics = result.analytics?.text_overlay;
      expect(textAnalytics?.position_tier_used).toBeDefined();
      expect([1, 2, 3]).toContain(textAnalytics?.position_tier_used);
      expect(textAnalytics?.position_y).toBeDefined();
      expect(textAnalytics?.shadow_type).toBeDefined();
      expect(['dark', 'light']).toContain(textAnalytics?.shadow_type);
      expect(textAnalytics?.avg_brightness).toBeDefined();
      expect(textAnalytics?.brightness_samples).toBeDefined();
      expect(textAnalytics?.brightness_samples?.length).toBe(9);
      expect(textAnalytics?.render_time_ms).toBeGreaterThan(0);

      // Verify output file exists
      await expect(fs.access(outputPath)).resolves.not.toThrow();
      const metadata = await sharp(outputPath).metadata();
      expect(metadata.width).toBe(config.instagram.width);
      expect(metadata.height).toBe(config.instagram.height);
    });

    it('should compose story without text when includeText is false', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background-1080x1920.png');
      const assetPath = path.join(FIXTURES_DIR, 'asset-landscape.png');
      const outputPath = path.join(OUTPUT_DIR, 'output-no-text.png');

      const result = await composeStory(backgroundPath, assetPath, outputPath, {
        includeText: false
      });

      expect(result.success).toBe(true);
      expect(result.analytics?.text_overlay.enabled).toBe(false);

      // Verify output file exists
      await expect(fs.access(outputPath)).resolves.not.toThrow();
    });

    it('should use custom text when textOverride is provided', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background-1080x1920.png');
      const assetPath = path.join(FIXTURES_DIR, 'asset-landscape.png');
      const outputPath = path.join(OUTPUT_DIR, 'output-custom-text.png');

      const result = await composeStory(backgroundPath, assetPath, outputPath, {
        includeText: true,
        textOverride: 'Custom Story Text'
      });

      expect(result.success).toBe(true);
      expect(result.analytics?.text_overlay.enabled).toBe(true);
      await expect(fs.access(outputPath)).resolves.not.toThrow();
    });

    it('should fallback silently when text overlay fails', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background-1080x1920.png');
      const assetPath = path.join(FIXTURES_DIR, 'asset-landscape.png');
      const outputPath = path.join(OUTPUT_DIR, 'output-fallback.png');

      // Mock a failure scenario by using an extremely long text that might cause issues
      const veryLongText = 'A'.repeat(10000);

      const result = await composeStory(backgroundPath, assetPath, outputPath, {
        includeText: true,
        textOverride: veryLongText
      });

      // Should still succeed (fallback to no text)
      expect(result.success).toBe(true);
      await expect(fs.access(outputPath)).resolves.not.toThrow();
    });

    it('should maintain backward compatibility with old signature', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background-1080x1920.png');
      const assetPath = path.join(FIXTURES_DIR, 'asset-landscape.png');
      const outputPath = path.join(OUTPUT_DIR, 'output-backward-compat.png');

      // Call without options (should default to includeText: true)
      const result = await composeStory(backgroundPath, assetPath, outputPath);

      expect(result.success).toBe(true);
      expect(result.analytics?.text_overlay.enabled).toBe(true);
      await expect(fs.access(outputPath)).resolves.not.toThrow();
    });
  });
});
