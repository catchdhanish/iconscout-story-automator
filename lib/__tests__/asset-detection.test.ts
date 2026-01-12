import { detectAssetBottomEdge } from '../asset-detection';
import sharp from 'sharp';
import path from 'path';

describe('detectAssetBottomEdge', () => {
  const testDir = path.join(__dirname, '../../public/uploads/test-detection');

  beforeAll(async () => {
    const fs = await import('fs/promises');
    await fs.mkdir(testDir, { recursive: true });

    // Create test image with asset in center (background blue, asset red)
    const canvas = sharp({
      create: {
        width: 1080,
        height: 1920,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 }
      }
    });

    // Create asset buffer (red square 500x500)
    const assetBuffer = await sharp({
      create: {
        width: 500,
        height: 500,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 }
      }
    }).png().toBuffer();

    // Composite asset at Y=700 (bottom edge at Y=1200)
    await canvas
      .composite([{
        input: assetBuffer,
        top: 700,
        left: 290
      }])
      .png()
      .toFile(path.join(testDir, 'test-asset-centered.png'));
  });

  afterAll(async () => {
    const fs = await import('fs/promises');
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should detect asset bottom edge', async () => {
    const imagePath = path.join(testDir, 'test-asset-centered.png');
    const bottomY = await detectAssetBottomEdge(imagePath);

    // Asset is 500px tall starting at Y=700, so bottom is at Y=1200
    expect(bottomY).toBeGreaterThanOrEqual(1190);
    expect(bottomY).toBeLessThanOrEqual(1210);
  });

  it('should return 0 if no asset detected', async () => {
    // Create solid blue image (no distinct asset)
    const solidPath = path.join(testDir, 'solid.png');
    await sharp({
      create: {
        width: 1080,
        height: 1920,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 }
      }
    }).png().toFile(solidPath);

    const bottomY = await detectAssetBottomEdge(solidPath);
    expect(bottomY).toBe(0);
  });
});
