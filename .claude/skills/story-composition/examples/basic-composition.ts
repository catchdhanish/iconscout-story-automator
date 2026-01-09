/**
 * Example: Basic Instagram Story Composition
 *
 * Demonstrates simple background + asset composition
 */

import { composeStory } from '../lib/compose-story';

async function main() {
  const result = await composeStory(
    './public/uploads/background.png',
    './public/uploads/asset.png',
    './public/uploads/output-v1.png'
  );

  console.log('Composition complete!');
  console.log(`Output: ${result.outputPath}`);
  console.log(`Asset positioned at (${result.asset.x}, ${result.asset.y})`);
  console.log(`Asset size: ${result.asset.width}x${result.asset.height}`);
  console.log(`Processing time: ${result.processingTime}ms`);
}

if (require.main === module) {
  main().catch(console.error);
}
