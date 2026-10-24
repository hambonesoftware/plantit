const { test, expect } = require('@playwright/test');
const call = (page, path, options) => page.evaluate(async ({ path, options }) => (await import('./services/api.js')).request(path, options), { path, options });

async function seed(page) {
  const { village } = await call(page, '/villages', { method: 'POST', body: { name: 'Kitchen', climate: 'Indoor', healthScore: 0.5 } });
  const { plant } = await call(page, '/plants', { method: 'POST', body: { villageId: village.id, displayName: 'Offline fern', species: 'Fern', stage: 'mature', healthScore: 0.8 } });
  return { village, plant };
}

test('real UI creates a village and plant, then preserves them after reload', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const requests = []; page.on('request', request => requests.push(request.url()));
  await page.goto('/#villages');
  await expect(page.locator('#local-storage-status')).toContainText('storage');
  await page.locator('[data-action="village-create-toggle"]').click();
  await page.locator('[data-role="village-name"]').fill('My local garden');
  await page.locator('[data-role="village-climate"]').fill('Indoor');
  await page.locator('[data-role="village-create-form"] button[type="submit"]').click();
  await expect(page.locator('[data-role="detail-name"]')).toHaveText('My local garden');
  await page.locator('[data-action="plant-create-toggle"]').click();
  await page.locator('[data-role="plant-form"] [data-role="plant-name"]').fill('Local fern');
  await page.locator('[data-role="plant-form"] [data-role="plant-species"]').fill('Fern');
  await page.locator('[data-role="plant-form"] [data-role="plant-health"]').fill('0.7');
  await page.locator('[data-role="plant-form"] button[type="submit"]').click();
  await expect(page.locator('[data-role="plant-list"]')).toContainText('Local fern');
  await expect(page.locator('[data-role="plant-form"]')).toBeHidden();
  await page.reload();
  await expect(page.locator('[data-role="plant-list"]')).toContainText('Local fern');
  await page.screenshot({ path: 'test-results/local-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
  expect(requests.filter(url => new URL(url).pathname.startsWith('/api'))).toEqual([]);
});

test('offline reload, deep navigation, writes, and backup work without backend', async ({ page, context }) => {
  await page.goto('/');
  const { village } = await seed(page);
  await expect(page.locator('#offline-status')).toHaveText(/^Ready offline\./);
  await context.setOffline(true);
  await page.reload();
  await page.locator('a.nav-link[href="#villages"]').click();
  await expect(page.locator('[data-role="village-list"]')).toContainText('Kitchen');
  await call(page, '/plants', { method: 'POST', body: { villageId: village.id, displayName: 'Created offline', species: 'Fern', healthScore: 0.5 } });
  await page.reload();
  expect((await call(page, '/export')).payload.plants).toHaveLength(2);
  const download = page.waitForEvent('download');
  await page.locator('#export-button').click();
  expect((await download).suggestedFilename()).toMatch(/plantit-backup-.*\.json/);
});

test('backup download restores photos and history in an independent browser profile', async ({ page, browser }) => {
  await page.goto('/');
  const { plant } = await seed(page);
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP8kAAAAASUVORK5CYII=';
  await call(page, `/plants/${plant.id}`, { method: 'PUT', body: { ...plant, imageUrl: image, notes: '<img src=x onerror=alert(1)>' } });
  await call(page, `/plants/${plant.id}/waterings`, { method: 'POST', body: { wateredAt: '2026-01-01' } });
  await call(page, `/plants/${plant.id}/waterings`, { method: 'POST', body: { wateredAt: '2026-01-08' } });
  const download = page.waitForEvent('download'); await page.locator('#export-button').click();
  const file = await (await download).path();
  const other = await browser.newContext(); const receiver = await other.newPage();
  try {
    await receiver.goto('http://127.0.0.1:8765');
    expect((await call(receiver, '/export')).payload.plants).toHaveLength(0);
    receiver.once('dialog', dialog => dialog.accept());
    await receiver.locator('#import-file-input').setInputFiles(file);
    await expect.poll(async () => (await call(receiver, '/export')).payload.plants.length).toBe(1);
    const restored = (await call(receiver, `/plants/${plant.id}`)).plant;
    expect(restored.imageUrl).toBe(image);
    expect(restored.watering.history).toEqual(['2026-01-01', '2026-01-08']);
    expect(restored.notes).toContain('onerror');
  } finally { await other.close(); }
});

test('cancelled and corrupt restores leave records untouched', async ({ page }) => {
  await page.goto('/'); await seed(page);
  const bundle = await call(page, '/export');
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#import-file-input').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#import-status')).toContainText('cancelled');
  bundle.payload.plants[0].villageId = 'nonexistent';
  await page.locator('#import-file-input').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) });
  await expect(page.locator('#import-status')).toContainText('missing village');
  expect((await call(page, '/export')).payload.plants).toHaveLength(1);
});

test('Markdown import joins the real collection and survives reload', async ({ page }) => {
  await page.goto('/');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#markdown-file-input').setInputFiles({ name: 'Fern.md', mimeType: 'text/markdown', buffer: Buffer.from('# Fern\n\nFamily: Ferns\nJanuary 1, 2026 watered\nJanuary 8, 2026 watered\n') });
  await expect.poll(async () => (await call(page, '/export')).payload.plants.length).toBe(1);
  await page.reload();
  const bundle = await call(page, '/export');
  expect(bundle.payload.plants[0].displayName).toBe('Fern');
  expect(bundle.payload.villages[0].name).toBe('Imported plants');
  const plant = (await call(page, `/plants/${bundle.payload.plants[0].id}`)).plant;
  expect(plant.watering.history).toEqual(['2026-01-01', '2026-01-08']);
});

test('ZIP import previews and preserves history without duplicating repeat imports', async ({ page }) => {
  const { makeZip } = await import('./zipFixture.mjs');
  const zip = makeZip([
    ['PlantIt-Import/Hoya-aabbccddeeff00112233445566778899.md', '# Hoya\n\nNotion Page ID: aabbccddeeff00112233445566778899\nNotes: Healthy plant\n\n## Care History\n- 2026-10-12 - Watered: hose\n- 2026-10-20 - Watered\n- 2026-10-20 - Repotted: new pot\n'],
    ['README-IMPORT.txt', 'Import instructions only'],
  ]);
  await page.goto('/');
  expect(await page.locator('#markdown-file-input').getAttribute('accept')).toBeNull();
  page.once('dialog', dialog => {
    expect(dialog.message()).toContain('1 new plant');
    expect(dialog.message()).toContain('3 care events');
    dialog.accept();
  });
  await page.locator('#markdown-file-input').setInputFiles({ name: 'plants.zip', mimeType: 'application/zip', buffer: zip });
  await expect.poll(async () => (await call(page, '/export')).payload.plants.length).toBe(1);
  let bundle = await call(page, '/export');
  let plant = bundle.payload.plants[0];
  expect(plant.notes).toBe('Healthy plant');
  expect(plant.activityLog).toHaveLength(3);
  expect(plant.wateringHistory).toEqual(['2026-10-12', '2026-10-20']);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#markdown-file-input').setInputFiles({ name: 'plants.zip', mimeType: 'application/zip', buffer: zip });
  await expect.poll(async () => (await call(page, '/export')).payload.plants.length).toBe(1);
  bundle = await call(page, '/export');
  plant = bundle.payload.plants[0];
  expect(plant.activityLog).toHaveLength(3);
  expect(plant.wateringHistory).toHaveLength(2);
});

test('declining an import preview leaves the collection unchanged', async ({ page }) => {
  await page.goto('/');
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#markdown-file-input').setInputFiles({ name: 'Plant.txt', mimeType: 'text/plain', buffer: Buffer.from('# Plant\n\nFamily: Araceae\n') });
  await expect(page.locator('#markdown-status')).toContainText('cancelled');
  expect((await call(page, '/export')).payload.plants).toHaveLength(0);
});

test('persistent storage request hides when permission is already granted', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.storage, 'persisted', { configurable: true, value: async () => true });
  });
  await page.goto('/');
  await expect(page.locator('#local-storage-status')).toContainText('granted');
  await expect(page.getByRole('button', { name: 'Request persistent storage' })).toBeHidden();
});

test('missing IndexedDB shows an actionable error and does not silently save in memory', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'indexedDB', { value: undefined }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'PlantIt needs local storage' })).toBeVisible();
  await expect(page.locator('#app')).toContainText('Local storage is unavailable');
  await expect(page.locator('#export-button')).toHaveCount(0);
});

test('legacy browser records migrate once and remain in the original storage', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('plantit:localStore')) localStorage.setItem('plantit:localStore', JSON.stringify({ schemaVersion: 3, plants: [{ displayName: 'Legacy fern', species: 'Fern', lastWatered: '2026-01-01' }] }));
  });
  await page.goto('/');
  await expect(page.locator('#local-storage-status')).toContainText('storage');
  expect((await call(page, '/export')).payload.plants).toHaveLength(1);
  await page.reload();
  expect((await call(page, '/export')).payload.plants).toHaveLength(1);
  expect(await page.evaluate(() => Boolean(localStorage.getItem('plantit:localStore')))).toBe(true);
});

test('mobile layout can create a village with local storage enabled', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#villages');
  await page.locator('[data-action="village-create-toggle"]').click();
  await page.locator('[data-role="village-name"]').fill('Phone garden');
  await page.locator('[data-role="village-climate"]').fill('Indoor');
  await page.locator('[data-role="village-create-form"] button[type="submit"]').click();
  await expect(page.locator('[data-role="detail-name"]')).toHaveText('Phone garden');
  await page.screenshot({ path: 'test-results/local-mobile.png', fullPage: true });
});
