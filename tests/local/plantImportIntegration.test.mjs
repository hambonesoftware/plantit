import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { localRequest } from '../../frontend/services/localData.js';
import { importPlantMarkdownFiles } from '../../frontend/services/importExport.js';
import { makeZip } from './zipFixture.mjs';

let permitImport = true;
globalThis.window = {
  dispatchEvent() {},
  confirm() { return permitImport; },
};

const hoya = `# Hoya rosita

Family: Apocynaceae
Last Watered: 2026-10-20
Notion Page ID: 11111111222222223333333344444444
Notes: My healthy Hoya.

## Care History
- 2026-10-12 - Watered: Hose
- 2026-10-20 - Watered
- 2025-03-22 - Repotted
`;
const lithops = `# Lithops Unknown

Family: Aizoaceae
Notion Page ID: 55555555666666667777777788888888

## Care History
- 2026-08-02 - Watered
`;
const zip = makeZip([
  ['PlantIt-Import/Hoya.md', hoya],
  ['PlantIt-Import/Lithops.md', lithops],
  ['README-IMPORT.txt', 'Instructions should never create a plant.'],
]);
const file = () => new File([zip], 'plantit.zip', { type: 'application/zip' });

test('ZIP import commits all records and histories in one operation', async () => {
  const status = { textContent: '' };
  const result = await importPlantMarkdownFiles([file()], status);
  assert.deepEqual({ created: result.created, updated: result.updated, careEvents: result.careEvents }, { created: 2, updated: 0, careEvents: 4 });
  assert.match(status.textContent, /2 created/);
  const bundle = await localRequest('/export');
  assert.equal(bundle.payload.villages.length, 1);
  assert.equal(bundle.payload.plants.length, 2);
  const first = bundle.payload.plants.find(value => value.displayName === 'Hoya rosita');
  assert.deepEqual(first.wateringHistory, ['2026-10-12', '2026-10-20']);
  assert.equal(first.notes, 'My healthy Hoya.');
  assert.equal(first.activityLog.length, 3);
});

test('repeat ZIP imports update the same plants and do not duplicate history', async () => {
  const result = await importPlantMarkdownFiles([file()]);
  assert.equal(result.created, 0);
  assert.equal(result.updated, 2);
  const bundle = await localRequest('/export');
  assert.equal(bundle.payload.plants.length, 2);
  assert.equal(bundle.payload.plants.find(value => value.displayName === 'Hoya rosita').activityLog.length, 3);
});

test('cancelled and corrupt imports leave the collection intact', async () => {
  permitImport = false;
  const cancelled = await importPlantMarkdownFiles([new File(['# New plant'], 'New.md')]);
  assert.equal(cancelled.cancelled, true);
  permitImport = true;
  await assert.rejects(importPlantMarkdownFiles([new File(['bad zip'], 'bad.zip')]), /ZIP/);
  const bundle = await localRequest('/export');
  assert.equal(bundle.payload.plants.length, 2);
});
