/** Local-only persistence. Every mutation commits atomically before reporting success. */
export const BACKUP_VERSION = 2;
export const MAX_BACKUP_BYTES = 100 * 1024 * 1024;
const DATABASE = 'plantit-local';
const COLLECTION = 'workspace';
const KEY = 'personal';
const MAX_RECORDS = 10000;
let databasePromise;

export class LocalDataError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const now = () => new Date().toISOString();
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const emptyWorkspace = () => ({ villages: [], plants: [], dismissals: [], lastBackupAt: null, updatedAt: now() });

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new LocalDataError('Local storage is unavailable. Open PlantIt in a browser that supports IndexedDB.', 503));
      return;
    }
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(COLLECTION).put(emptyWorkspace(), KEY);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new LocalDataError('Close other PlantIt tabs, then reload to finish the storage upgrade.', 503));
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => { database.close(); databasePromise = null; };
      resolve(database);
    };
  }).catch(error => { databasePromise = null; throw error; });
  return databasePromise;
}

/** Read the latest state within the same transaction as the write, including across tabs. */
export async function withWorkspace(write, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(COLLECTION, write ? 'readwrite' : 'readonly');
    const store = transaction.objectStore(COLLECTION);
    const request = store.get(KEY);
    let result;
    let operationError;
    request.onsuccess = () => {
      try {
        const state = request.result || emptyWorkspace();
        result = operation(state);
        if (write) {
          touch(state);
          if (new Blob([JSON.stringify(state)]).size > MAX_BACKUP_BYTES - 32768) {
            throw new LocalDataError('This collection is reaching the 100 MB backup limit. Use smaller photos before adding more data.');
          }
          store.put(state, KEY);
        }
      } catch (error) {
        operationError = error;
        transaction.abort();
      }
    };
    transaction.oncomplete = () => {
      if (write && typeof window !== 'undefined') window.dispatchEvent(new Event('plantit:data-changed'));
      resolve(result);
    };
    transaction.onabort = () => reject(operationError || new LocalDataError(
      transaction.error?.name === 'QuotaExceededError'
        ? 'Device storage is full. Download a backup and free space before saving again.'
        : 'Could not save on this device. Your previous saved data is unchanged.', 503));
    transaction.onerror = () => {}; // onabort reports the final result; never claim an aborted save succeeded.
  });
}

function text(value, label, required = false, limit = 100000) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > limit || (required && !value.trim())) {
    throw new LocalDataError(`${label} must be ${required ? 'nonempty ' : ''}text of at most ${limit} characters.`);
  }
  return value.trim();
}
function identifier(value) { return text(value, 'Record ID', true, 200); }
function day(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new LocalDataError('Dates must be valid YYYY-MM-DD dates.');
  }
  return value;
}
function timestamp(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new LocalDataError('Invalid timestamp.');
  return new Date(value).toISOString();
}
function score(value = 0.5) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) throw new LocalDataError('Health must be between 0 and 1.');
  return value;
}
function image(value) {
  if (!value) return null;
  if (typeof value !== 'string' || value.length > 14 * 1024 * 1024 || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(value)) {
    throw new LocalDataError('Use a local PNG, JPEG, WebP, or GIF photo up to 10 MB. Remote image links are disabled for privacy.');
  }
  return value;
}
function activity(value = []) {
  if (!Array.isArray(value) || value.length > MAX_RECORDS) throw new LocalDataError('Invalid activity history.');
  return value.map(item => {
    if (!item || typeof item !== 'object') throw new LocalDataError('Invalid activity entry.');
    return { date: day(item.date), type: text(item.type || 'note', 'Activity type', true, 100), note: text(item.note, 'Activity note'), amount: text(item.amount, 'Amount', false, 1000), method: text(item.method, 'Method', false, 1000) };
  });
}
function villageFields(input) {
  return {
    name: text(input.name, 'Village name', true, 200), climate: text(input.climate, 'Climate', true, 200),
    healthScore: score(input.healthScore), description: text(input.description, 'Description'),
    establishedAt: day(input.establishedAt), irrigationType: text(input.irrigationType, 'Irrigation', false, 1000),
  };
}
function plantFields(input) {
  const stage = input.stage || 'mature';
  if (!['seedling', 'vegetative', 'flowering', 'mature'].includes(stage)) throw new LocalDataError('Invalid growth stage.');
  const result = {
    displayName: text(input.displayName, 'Plant name', true, 200), species: text(input.species || input.displayName, 'Species', true, 200),
    stage, healthScore: score(input.healthScore), notes: text(input.notes, 'Notes'), imageUrl: image(input.imageUrl),
    lastWateredAt: timestamp(input.lastWateredAt), activityLog: activity(input.activityLog),
  };
  for (const field of ['family', 'plantOrigin', 'naturalHabitat', 'room', 'sunlight', 'potSize', 'dormancy', 'waterAverage', 'amount', 'sourceTitle']) result[field] = text(input[field], field, false, 10000);
  for (const field of ['purchasedOn', 'lastWatered', 'lastRepotted']) result[field] = day(input[field]);
  return result;
}
function uniqueDays(values) {
  if (!Array.isArray(values) || values.length > MAX_RECORDS) throw new LocalDataError('Invalid watering history.');
  return [...new Set(values.map(value => { const date = day(value); if (!date) throw new LocalDataError('Watering dates cannot be empty.'); return date; }))].sort();
}
function wateringHistory(plant) {
  return [...new Set([...(plant.wateringHistory || []), ...(plant.lastWatered ? [plant.lastWatered] : []), ...((plant.activityLog || []).filter(entry => entry.type === 'water' && entry.date).map(entry => entry.date))])].sort();
}
function nextWatering(plant) {
  const dates = wateringHistory(plant);
  if (dates.length < 2) return null;
  const ordinals = dates.map(value => Date.parse(`${value}T00:00:00Z`) / 86400000);
  const middle = (dates.length - 1) / 2;
  const average = ordinals.reduce((a, b) => a + b, 0) / dates.length;
  let numerator = 0, denominator = 0;
  ordinals.forEach((value, index) => { numerator += (index - middle) * (value - average); denominator += (index - middle) ** 2; });
  const slope = numerator / denominator;
  const predicted = Math.max(ordinals.at(-1) + 1, Math.round(average - slope * middle + slope * dates.length));
  return new Date(predicted * 86400000).toISOString().slice(0, 10);
}
function villageView(state, village) {
  const plants = state.plants.filter(plant => plant.villageId === village.id);
  return { ...village, plantCount: plants.length, bannerImageUrls: plants.map(plant => plant.imageUrl).filter(Boolean).slice(0, 5) };
}
function plantView(state, plant) {
  const history = wateringHistory(plant);
  const last = history.at(-1) || null;
  return {
    ...plant, villageName: state.villages.find(village => village.id === plant.villageId)?.name || '',
    lastWatered: last, daysSinceWatered: last ? Math.max(0, Math.round((Date.parse(today()) - Date.parse(last)) / 86400000)) : null,
    watering: { history, nextWateringDate: nextWatering(plant), hasWateringToday: history.includes(today()) },
  };
}
function find(records, id, label) {
  const record = records.find(item => item.id === id);
  if (!record) throw new LocalDataError(`${label} not found.`, 404);
  return record;
}
function checkVersion(record, body) {
  if (body.updatedAt !== record.updatedAt) throw new LocalDataError('This record changed in another tab. Refresh and try again.', 409);
}
function touch(record) {
  record.updatedAt = new Date(Math.max(Date.now(), (Date.parse(record.updatedAt) || 0) + 1)).toISOString();
}
function duePlants(state) {
  const date = today();
  return state.plants.map(plant => plantView(state, plant)).filter(plant => plant.watering.nextWateringDate && plant.watering.nextWateringDate <= date && !plant.watering.hasWateringToday && !state.dismissals.some(item => item.plantId === plant.id && item.date === date)).map(plant => ({ ...plant, nextWateringDate: plant.watering.nextWateringDate })).sort((a, b) => a.nextWateringDate.localeCompare(b.nextWateringDate));
}

/** Validate the entire file before any replacement; only allowlisted fields enter storage. */
export function validateBackup(bundle) {
  if (!bundle || ![1, BACKUP_VERSION].includes(bundle.schemaVersion)) throw new LocalDataError('Unsupported PlantIt backup version.');
  const payload = bundle.payload || bundle;
  if (!Array.isArray(payload.villages) || !Array.isArray(payload.plants) || payload.villages.length > MAX_RECORDS || payload.plants.length > MAX_RECORDS) throw new LocalDataError('Backup must contain villages and plants arrays, with at most 10,000 records each.');
  const state = emptyWorkspace();
  const villageIds = new Set(), plantIds = new Set();
  state.villages = payload.villages.map(value => {
    const id = identifier(value?.id);
    if (villageIds.has(id)) throw new LocalDataError('Duplicate village ID in backup.');
    villageIds.add(id);
    return { ...villageFields(value), id, updatedAt: timestamp(value.updatedAt) || now() };
  });
  state.plants = payload.plants.map(value => {
    const id = identifier(value?.id), villageId = identifier(value?.villageId);
    if (plantIds.has(id)) throw new LocalDataError('Duplicate plant ID in backup.');
    if (!villageIds.has(villageId)) throw new LocalDataError('A plant refers to a missing village.');
    plantIds.add(id);
    const history = value.wateringHistory || value.watering?.history || [];
    return { ...plantFields(value), id, villageId, updatedAt: timestamp(value.updatedAt) || now(), wateringHistory: uniqueDays(history) };
  });
  if (payload.dismissals !== undefined && (!Array.isArray(payload.dismissals) || payload.dismissals.length > MAX_RECORDS)) throw new LocalDataError('Invalid watering dismissals.');
  state.dismissals = (payload.dismissals || []).map(value => {
    const plantId = identifier(value?.plantId);
    if (!plantIds.has(plantId)) throw new LocalDataError('Dismissal refers to a missing plant.');
    const date = day(value.date);
    if (!date) throw new LocalDataError('Invalid dismissal date.');
    return { plantId, date };
  });
  return state;
}

export async function localRequest(path, { method = 'GET', body = {}, signal } = {}) {
  if (signal?.aborted) throw new DOMException('Operation cancelled', 'AbortError');
  const url = new URL(path, 'https://local.invalid');
  if (url.origin !== 'https://local.invalid') throw new LocalDataError('External data requests are disabled.');
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'auth') return { authEnabled: false, authenticated: true, username: null };
  if (parts[0] === 'health') return { status: 'ok', storage: 'local', version: '0.2.0' };
  return withWorkspace(method !== 'GET', state => {
    if (signal?.aborted) throw new DOMException('Operation cancelled', 'AbortError');
    const [resource, id, action] = parts;
    if (method === 'GET' && resource === 'dashboard') {
      const total = state.plants.length;
      return { summary: { totalPlants: total, activeVillages: state.villages.length, successRate: total ? state.plants.reduce((sum, plant) => sum + plant.healthScore, 0) / total : 0, upcomingTasks: duePlants(state).length }, alerts: [], lastUpdated: now() };
    }
    if (method === 'GET' && resource === 'today') return { tasks: duePlants(state).map(plant => ({ id: `water-${plant.id}`, type: 'water', plantId: plant.id, plantName: plant.displayName, villageName: plant.villageName, dueAt: `${plant.nextWateringDate}T12:00:00`, priority: 'medium' })), emptyStateMessage: 'No watering tasks due today.' };
    if (resource === 'export' && method === 'GET') return { schemaVersion: BACKUP_VERSION, generatedAt: now(), metadata: { application: 'PlantIt', storage: 'local-only', includesPhotos: true }, workspaceUpdatedAt: state.updatedAt, payload: { villages: state.villages, plants: state.plants, dismissals: state.dismissals } };
    if (['import', 'import-markdown'].includes(resource) && method === 'POST') {
      if ((resource === 'import-markdown' && body.workspaceUpdatedAt !== state.updatedAt) || (body.expectedWorkspaceUpdatedAt !== undefined && body.expectedWorkspaceUpdatedAt !== state.updatedAt)) throw new LocalDataError('Your collection changed during import. Try again.', 409);
      const restored = validateBackup(body);
      Object.assign(state, restored);
      return { status: 'restored', summary: { plants: state.plants.length, villages: state.villages.length } };
    }
    if (resource === 'watering' && id === 'due') {
      if (method === 'GET') return { plants: duePlants(state), generatedAt: now() };
      if (method === 'POST' && parts[3] === 'dismiss') {
        find(state.plants, action, 'Plant');
        state.dismissals = state.dismissals.filter(item => item.date === today() && item.plantId !== action);
        state.dismissals.push({ plantId: action, date: today() });
        return { status: 'dismissed', plantId: action, dismissedUntil: today() };
      }
    }
    if (resource === 'villages') {
      if (method === 'GET' && !id) {
        const searchTerm = url.searchParams.get('searchTerm') || '';
        const climateZones = url.searchParams.getAll('climateZones');
        const minimum = url.searchParams.has('minHealth') ? Number(url.searchParams.get('minHealth')) : null;
        return { villages: state.villages.filter(village => village.name.toLowerCase().includes(searchTerm.toLowerCase()) && (!climateZones.length || climateZones.includes(village.climate)) && (minimum === null || village.healthScore >= minimum)).map(village => villageView(state, village)).sort((a, b) => a.name.localeCompare(b.name)), appliedFilters: { searchTerm, climateZones, minHealth: minimum } };
      }
      if (method === 'POST' && !id) {
        if (state.villages.length >= MAX_RECORDS) throw new LocalDataError('Village limit reached.');
        const village = { ...villageFields(body), id: crypto.randomUUID(), updatedAt: now() };
        state.villages.push(village);
        return { village: villageView(state, village) };
      }
      const village = find(state.villages, id, 'Village');
      if (method === 'GET') return action === 'plants' ? { village: villageView(state, village), plants: state.plants.filter(plant => plant.villageId === id).map(plant => plantView(state, plant)) } : { village: villageView(state, village) };
      checkVersion(village, body);
      if (method === 'PUT') { Object.assign(village, villageFields(body)); touch(village); return { village: villageView(state, village) }; }
      if (method === 'DELETE') {
        const removed = new Set(state.plants.filter(plant => plant.villageId === id).map(plant => plant.id));
        state.villages = state.villages.filter(item => item.id !== id);
        state.plants = state.plants.filter(plant => !removed.has(plant.id));
        state.dismissals = state.dismissals.filter(item => !removed.has(item.plantId));
        return { status: 'deleted', villageId: id, updatedAt: now() };
      }
    }
    if (resource === 'plants') {
      if (method === 'POST' && !id) {
        if (state.plants.length >= MAX_RECORDS) throw new LocalDataError('Plant limit reached.');
        const village = find(state.villages, body.villageId, 'Village');
        const plant = { ...plantFields(body), id: crypto.randomUUID(), villageId: village.id, wateringHistory: [], updatedAt: now() };
        state.plants.push(plant); touch(village);
        return { plant: plantView(state, plant), village: villageView(state, village) };
      }
      const plant = find(state.plants, id, 'Plant');
      const village = find(state.villages, plant.villageId, 'Village');
      if (method === 'GET') return { plant: plantView(state, plant), timeline: wateringHistory(plant).map(date => ({ id: `${id}-${date}`, occurredAt: `${date}T12:00:00`, type: 'watering', summary: 'Watered' })).reverse() };
      if (method === 'POST' && action === 'waterings') {
        const date = day(body.wateredAt) || today();
        plant.wateringHistory = uniqueDays([...wateringHistory(plant), date]);
        plant.lastWatered = plant.wateringHistory.at(-1);
        plant.lastWateredAt = `${plant.lastWatered}T12:00:00.000Z`;
        touch(plant);
        return { plant: plantView(state, plant), timeline: [] };
      }
      checkVersion(plant, body);
      if (method === 'PUT') {
        const destination = find(state.villages, body.villageId || village.id, 'Village');
        Object.assign(plant, plantFields({ ...plant, ...body }), { villageId: destination.id });
        touch(plant); touch(village); if (destination.id !== village.id) touch(destination);
        return { plant: plantView(state, plant), village: villageView(state, destination), previousVillage: villageView(state, village) };
      }
      if (method === 'DELETE') {
        state.plants = state.plants.filter(item => item.id !== id);
        state.dismissals = state.dismissals.filter(item => item.plantId !== id);
        touch(village);
        return { status: 'deleted', plantId: id, updatedAt: now(), village: villageView(state, village) };
      }
    }
    throw new LocalDataError('Unsupported local operation.', 404);
  });
}

export async function markBackupDownloaded() {
  return withWorkspace(true, state => { state.lastBackupAt = now(); });
}
export async function storageStatus() {
  const state = await withWorkspace(false, value => value);
  const persistent = await navigator.storage?.persisted?.() || false;
  return { persistent, lastBackupAt: state.lastBackupAt, plants: state.plants.length, villages: state.villages.length };
}

/** Preserve the old Markdown-only browser store once, without silently replacing a workspace. */
export async function migrateLegacyStore() {
  let legacy;
  try { const raw = localStorage.getItem('plantit:localStore'); if (raw) legacy = JSON.parse(raw); } catch { return; }
  if (!Array.isArray(legacy?.plants) || !legacy.plants.length) return;
  await withWorkspace(true, state => {
    if (state.legacyMigrated) return;
    const villageId = crypto.randomUUID();
    const village = { id: villageId, name: 'Imported plants', climate: 'Indoor', healthScore: 0.5, updatedAt: now() };
    const plants = legacy.plants.map(value => ({ ...plantFields({ ...value, displayName: value.displayName || 'Imported plant' }), id: crypto.randomUUID(), villageId, updatedAt: now(), wateringHistory: uniqueDays(value.watering?.history || []) }));
    if (plants.length + state.plants.length > MAX_RECORDS) throw new LocalDataError('Too many legacy plants to migrate.');
    state.villages.push(village); state.plants.push(...plants); state.legacyMigrated = true;
  });
}
