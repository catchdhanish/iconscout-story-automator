/**
 * Example: Batch Instagram Story Composition
 *
 * Process multiple stories concurrently
 */

import { composeBatch } from '../lib/compose-story';
import { readFileSync } from 'fs';

interface HistoryItem {
  id: string;
  active_version: number;
  versions: Array<{ file_path: string }>;
}

async function main() {
  const history: HistoryItem[] = JSON.parse(
    readFileSync('./history.json', 'utf8')
  );

  const items = history
    .filter(item => item.active_version > 0)
    .map(item => ({
      background: `./public/uploads/${item.id}/background_raw.png`,
      asset: `./public/uploads${item.versions[item.active_version - 1].file_path}`,
      output: `./public/uploads/${item.id}/v${item.active_version}.png`
    }));

  console.log(`Processing ${items.length} stories...`);

  const results = await composeBatch(items, 5);

  console.log(`\nCompleted ${results.length} compositions`);
  console.log(
    `Total time: ${results.reduce((sum, r) => sum + r.processingTime, 0)}ms`
  );
}

if (require.main === module) {
  main().catch(console.error);
}
