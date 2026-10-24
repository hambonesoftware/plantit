import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlantMarkdown } from '../../frontend/parsers/plantMarkdown.js';
import { collectPlantFiles } from '../../frontend/services/plantImportFiles.js';
import { makeZip } from './zipFixture.mjs';

const plant = `# Hoya Example

Family: Apocynaceae
Last Watered: 2026-10-20
Last Repotted: 2024-12-01
Water Average Days: 8
Notion Page ID: aabbccddeeff00112233445566778899
Notes: Purchased as a cutting and doing well.

## Care History

- 2026-10-12 - Watered: Shower
- 2026-10-20 - Watered: Hose
- 2024-12-01 - Repotted: new soil
- 2026-10-21 - Note: flower buds appeared
`;

test('converted PlantIt Markdown preserves ISO care events and original metadata', () => {
  const result = parsePlantMarkdown(plant, 'hoya.md');
  assert.equal(result.waterAverage, '8');
  assert.equal(result.notionPageId, 'aabbccddeeff00112233445566778899');
  assert.equal(result.notes, 'Purchased as a cutting and doing well.');
  assert.equal(result.lastWatered, '2026-10-20');
  assert.deepEqual(result.activityLog.map(entry => entry.type), ['water', 'water', 'repot', 'note']);
  assert.deepEqual(result.activityLog.filter(entry => entry.type === 'water').map(entry => entry.date), ['2026-10-12', '2026-10-20']);
});

test('original Notion month-name history is treated as watering history', () => {
  const source = `# Lithops

Family: Aizoaceae
Last Watered: October 20, 2026

Last watered:

September 7, 2026
October 3, 2026 Hose
October 20, 2026
`;
  const result = parsePlantMarkdown(source);
  assert.equal(result.lastWatered, '2026-10-20');
  assert.deepEqual(result.activityLog.map(entry => entry.type), ['water', 'water', 'water']);
});

test('compressed ZIP imports only plant pages and preserves their contents', async () => {
  const zip = makeZip([
    ['PlantIt-Import/Hoya.md', plant],
    ['PlantIt-Import/Lithops.txt', '# Lithops\n\nFamily: Aizoaceae\n'],
    ['README-IMPORT.txt', 'Instructions, not a plant'],
    ['PlantIt-Photos/photo.jpeg', Buffer.from([1, 2, 3, 4])],
  ]);
  const result = await collectPlantFiles([new File([zip], 'plants.zip')]);
  assert.equal(result.plants.length, 2);
  assert.equal(result.skippedImages, 1);
  assert.equal(result.plants[0].contents, plant);
  assert.equal(result.plants[1].name, 'PlantIt-Import/Lithops.txt');
});

test('text files can be selected directly without an extension MIME filter', async () => {
  const result = await collectPlantFiles([new File([plant], 'Hoya.txt', { type: 'text/plain' })]);
  assert.equal(result.plants.length, 1);
  assert.equal(parsePlantMarkdown(result.plants[0].contents).activityLog.length, 4);
});

test('invalid ZIP and unsupported file formats fail without partial results', async () => {
  await assert.rejects(collectPlantFiles([new File(['not a zip'], 'bad.zip')]), /ZIP/);
  await assert.rejects(collectPlantFiles([new File(['whatever'], 'bad.exe')]), /not a/);
  const zip = makeZip([['Hoya.md', plant]]);
  zip[zip.length - 25] ^= 0xff;
  await assert.rejects(collectPlantFiles([new File([zip], 'corrupt.zip')]), /ZIP|integrity|damaged|UTF-8/);
});
