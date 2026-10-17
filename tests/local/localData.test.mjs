import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { localRequest as request, validateBackup, withWorkspace, LocalDataError } from '../../frontend/services/localData.js';
const villageInput = { name: 'Kitchen', climate: 'Indoor', healthScore: 0.7 };
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP8kAAAAASUVORK5CYII=';
const makeVillage = async () => (await request('/villages', { method: 'POST', body: villageInput })).village;
const makePlant = async villageId => (await request('/plants', { method: 'POST', body: { villageId, displayName: 'Fern', species: 'Fern', stage: 'mature', healthScore: 0.6, notes: '<script>example</script>', imageUrl: photo } })).plant;
beforeEach(async () => withWorkspace(true, state => Object.assign(state, { villages: [], plants: [], dismissals: [], lastBackupAt: null, legacyMigrated: true })));

test('fresh collection is empty and data operations never use fetch', async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Network request forbidden'); };
  try {
    assert.deepEqual((await request('/villages')).villages, []);
    const village = await makeVillage();
    await makePlant(village.id);
    assert.equal((await request('/dashboard')).summary.totalPlants, 1);
  } finally { globalThis.fetch = oldFetch; }
});

test('overlapping writes retain every record', async () => {
  await Promise.all(Array.from({ length: 30 }, (_, index) => request('/villages', { method: 'POST', body: { ...villageInput, name: `Village ${index}` } })));
  assert.equal((await request('/villages')).villages.length, 30);
});

test('stale edits are rejected without changing the stored record', async () => {
  const village = await makeVillage();
  await request(`/villages/${village.id}`, { method: 'PUT', body: { ...village, name: 'Changed' } });
  await assert.rejects(request(`/villages/${village.id}`, { method: 'PUT', body: village }), error => error.status === 409);
  assert.equal((await request(`/villages/${village.id}`)).village.name, 'Changed');
});

test('complete backup round-trips photos, notes, activity, history, and dismissals', async () => {
  const village = await makeVillage();
  const plant = await makePlant(village.id);
  for (const wateredAt of ['2026-01-01', '2026-01-08']) await request(`/plants/${plant.id}/waterings`, { method: 'POST', body: { wateredAt } });
  await request(`/watering/due/${plant.id}/dismiss`, { method: 'POST' });
  const backup = JSON.parse(JSON.stringify(await request('/export')));
  await request('/import', { method: 'POST', body: { schemaVersion: 2, payload: { villages: [], plants: [] } } });
  await request('/import', { method: 'POST', body: backup });
  const restored = (await request(`/plants/${plant.id}`)).plant;
  assert.equal(restored.imageUrl, photo);
  assert.equal(restored.notes, '<script>example</script>');
  assert.deepEqual(restored.watering.history, ['2026-01-01', '2026-01-08']);
  assert.equal(restored.watering.nextWateringDate, '2026-01-15');
  assert.deepEqual((await request('/export')).payload, backup.payload);
});

test('malformed backup rolls back the whole restore', async () => {
  const village = await makeVillage();
  const plant = await makePlant(village.id);
  const backup = await request('/export');
  backup.payload.plants.push({ ...plant, id: 'broken', villageId: 'missing' });
  await assert.rejects(request('/import', { method: 'POST', body: backup }), /missing village/);
  assert.equal((await request('/export')).payload.plants.length, 1);
});

test('unsafe photos, duplicate IDs, invalid dates, and unsupported schemas are rejected', async () => {
  const village = await makeVillage(); await makePlant(village.id);
  const source = await request('/export');
  for (const imageUrl of ['https://tracker.invalid/photo.jpg', 'data:image/svg+xml;base64,PHN2Zz4=']) {
    const bundle = structuredClone(source); bundle.payload.plants[0].imageUrl = imageUrl;
    assert.throws(() => validateBackup(bundle), LocalDataError);
  }
  const duplicate = structuredClone(source); duplicate.payload.villages.push(duplicate.payload.villages[0]);
  assert.throws(() => validateBackup(duplicate), /Duplicate/);
  const invalid = structuredClone(source); invalid.payload.plants[0].lastWatered = '2026-02-30';
  assert.throws(() => validateBackup(invalid), /Dates/);
  assert.throws(() => validateBackup({ ...source, schemaVersion: 999 }), /Unsupported/);
});

test('moving a plant updates both villages; deleting a village cascades', async () => {
  const first = await makeVillage(), second = await makeVillage();
  const plant = await makePlant(first.id);
  await request(`/plants/${plant.id}`, { method: 'PUT', body: { ...plant, villageId: second.id } });
  assert.equal((await request(`/villages/${first.id}/plants`)).plants.length, 0);
  assert.equal((await request(`/villages/${second.id}/plants`)).plants.length, 1);
  const current = (await request(`/villages/${second.id}`)).village;
  await request(`/villages/${second.id}`, { method: 'DELETE', body: current });
  assert.equal((await request('/export')).payload.plants.length, 0);
});

test('failed transactions leave the prior saved state untouched', async () => {
  await makeVillage();
  await assert.rejects(withWorkspace(true, state => { state.villages = []; throw new Error('Simulated failure'); }), /Simulated failure/);
  assert.equal((await request('/villages')).villages.length, 1);
});

test('Markdown import detects a competing write instead of overwriting it', async () => {
  const snapshot = await request('/export');
  await makeVillage();
  await assert.rejects(request('/import-markdown', { method: 'POST', body: snapshot }), error => error.status === 409);
  assert.equal((await request('/villages')).villages.length, 1);
});

test('version 1 exports can be restored and are upgraded on export', async () => {
  const village = await makeVillage(); await makePlant(village.id);
  const bundle = await request('/export'); bundle.schemaVersion = 1;
  await request('/import', { method: 'POST', body: bundle });
  assert.equal((await request('/export')).schemaVersion, 2);
});
