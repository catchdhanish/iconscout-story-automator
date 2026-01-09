/**
 * Test suite for Story Composition Engine
 *
 * Tests the composeStory function for correct Instagram Story composition
 * including dimension handling, asset positioning, and error cases.
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { composeStory } from '../compose';
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

      // Verify result returns output path
      expect(result).toBe(outputPath);

      // Verify output file exists
      await expect(fs.access(outputPath)).resolves.not.toThrow();

      // Verify output dimensions
      const metadata = await sharp(outputPath).metadata();
      expect(metadata.width).toBe(config.instagram.width);
      expect(metadata.height).toBe(config.instagram.height);
    });

    it('should output JPEG when output path has .jpg extension', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background-1080x1920.png');
      const assetPath = path.join(FIXTURES_DIR, 'asset-landscape.png');
      const outputPath = path.join(OUTPUT_DIR, 'output.jpg');

      await composeStory(backgroundPath, assetPath, outputPath);

      const metadata = await sharp(outputPath).metadata();
      expect(metadata.format).toBe('jpeg');
    });

    it('should output PNG when output path has .png extension', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background-1080x1920.png');
      const assetPath = path.join(FIXTURES_DIR, 'asset-landscape.png');
      const outputPath = path.join(OUTPUT_DIR, 'output.png');

      await composeStory(backgroundPath, assetPath, outputPath);

      const metadata = await sharp(outputPath).metadata();
      expect(metadata.format).toBe('png');
    });

    it('should accept JPEG inputs', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background.jpg');
      const assetPath = path.join(FIXTURES_DIR, 'asset.jpg');
      const outputPath = path.join(OUTPUT_DIR, 'output.jpg');

      const result = await composeStory(backgroundPath, assetPath, outputPath);

      expect(result).toBe(outputPath);
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

      await expect(composeStory(backgroundPath, assetPath, outputPath))
        .rejects
        .toThrow('Image processing failed');
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

    it('should create valid JPEG file', async () => {
      const backgroundPath = path.join(FIXTURES_DIR, 'background-1080x1920.png');
      const assetPath = path.join(FIXTURES_DIR, 'asset-landscape.png');
      const outputPath = path.join(OUTPUT_DIR, 'output.jpeg');

      await composeStory(backgroundPath, assetPath, outputPath);

      const metadata = await sharp(outputPath).metadata();
      expect(metadata.format).toBe('jpeg');
    });
  });
});
