import { sampleBrightness, determineAdaptiveShadow } from '../brightness-sampling';
import sharp from 'sharp';
import path from 'path';

describe('Brightness Sampling', () => {
  const testDir = path.join(__dirname, '../../public/uploads/test-brightness');

  beforeAll(async () => {
    const fs = await import('fs/promises');
    await fs.mkdir(testDir, { recursive: true });

    // Create dark background (RGB 50, 50, 50)
    await sharp({
      create: {
        width: 1080,
        height: 1920,
        channels: 3,
        background: { r: 50, g: 50, b: 50 }
      }
    }).png().toFile(path.join(testDir, 'dark-bg.png'));

    // Create light background (RGB 200, 200, 200)
    await sharp({
      create: {
        width: 1080,
        height: 1920,
        channels: 3,
        background: { r: 200, g: 200, b: 200 }
      }
    }).png().toFile(path.join(testDir, 'light-bg.png'));
  });

  afterAll(async () => {
    const fs = await import('fs/promises');
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('sampleBrightness', () => {
    it('should return low brightness for dark image', async () => {
      const darkPath = path.join(testDir, 'dark-bg.png');
      const result = await sampleBrightness(darkPath, 90, 1520, 900, 180);

      expect(result.averageBrightness).toBeLessThan(100);
      expect(result.samples).toHaveLength(9);
      expect(result.samples.every(s => s < 100)).toBe(true);
    });

    it('should return high brightness for light image', async () => {
      const lightPath = path.join(testDir, 'light-bg.png');
      const result = await sampleBrightness(lightPath, 90, 1520, 900, 180);

      expect(result.averageBrightness).toBeGreaterThan(150);
      expect(result.samples).toHaveLength(9);
      expect(result.samples.every(s => s > 150)).toBe(true);
    });
  });

  describe('determineAdaptiveShadow', () => {
    it('should return light shadow for dark backgrounds', async () => {
      const darkPath = path.join(testDir, 'dark-bg.png');
      const result = await determineAdaptiveShadow(darkPath, 90, 1520, 900, 180);

      expect(result.shadowColor).toBe('rgba(255,255,255,0.8)');
      expect(result.shadowType).toBe('light');
      expect(result.averageBrightness).toBeLessThan(127.5);
    });

    it('should return dark shadow for light backgrounds', async () => {
      const lightPath = path.join(testDir, 'light-bg.png');
      const result = await determineAdaptiveShadow(lightPath, 90, 1520, 900, 180);

      expect(result.shadowColor).toBe('rgba(0,0,0,0.8)');
      expect(result.shadowType).toBe('dark');
      expect(result.averageBrightness).toBeGreaterThan(127.5);
    });
  });
});
