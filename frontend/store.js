const STORAGE_KEY = 'plantit:localStore';
const SCHEMA_VERSION = 3;

function readStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Store: failed to read persisted state', error);
    return null;
  }
}

function writeStorage(state) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Store: failed to persist state', error);
  }
}

function toISO(value) {
  if (!value) {
    return null;
  }
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString().slice(0, 10);
  } catch (error) {
    console.warn('Store: unable to normalize date', value, error);
    return null;
  }
}

function computeDaysSinceWatered(lastWatered) {
  if (!lastWatered) {
    return null;
  }
  try {
    const date = new Date(lastWatered);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    const now = new Date();
    const diff = Math.floor((now - date) / (24 * 3600 * 1000));
    return diff < 0 ? 0 : diff;
  } catch (error) {
    console.warn('Store: unable to compute days since watered', lastWatered, error);
    return null;
  }
}

function ensurePlantTrackingDefaults(plant) {
  plant.family ??= '';
  plant.plantOrigin ??= '';
  plant.naturalHabitat ??= '';
  plant.room ??= '';
  plant.sunlight ??= '';
  plant.potSize ??= '';
  plant.purchasedOn = toISO(plant.purchasedOn) || null;
  plant.lastWatered = toISO(plant.lastWatered) || null;
  plant.lastRepotted = toISO(plant.lastRepotted) || null;
  plant.dormancy ??= '';
  plant.waterAverage ??= '';
  plant.amount ??= '';
  plant.activityLog = Array.isArray(plant.activityLog) ? plant.activityLog : [];
  plant.daysSinceWatered = computeDaysSinceWatered(plant.lastWatered);
  return plant;
}

function migrateToV3(state) {
  if (!state || typeof state !== 'object') {
    return { schemaVersion: SCHEMA_VERSION, plants: [] };
  }
  const plants = Array.isArray(state.plants) ? state.plants : [];
  state.plants = plants.map((plant) => ensurePlantTrackingDefaults({ ...plant }));
  state.schemaVersion = SCHEMA_VERSION;
  return state;
}

function applyMigrations(state) {
  if (!state || typeof state !== 'object') {
    return { schemaVersion: SCHEMA_VERSION, plants: [] };
  }
  const version = typeof state.schemaVersion === 'number' ? state.schemaVersion : 1;
  if (version < 3) {
    state = migrateToV3(state);
  }
  if (state.schemaVersion !== SCHEMA_VERSION) {
    state.schemaVersion = SCHEMA_VERSION;
  }
  if (!Array.isArray(state.plants)) {
    state.plants = [];
  }
  state.plants = state.plants.map((plant) => ensurePlantTrackingDefaults({ ...plant }));
  return state;
}

const Store = {
  state: { schemaVersion: SCHEMA_VERSION, plants: [] },
  _initialized: false,
  init() {
    if (this._initialized) {
      return this.state;
    }
    const loaded = applyMigrations(readStorage()) || { schemaVersion: SCHEMA_VERSION, plants: [] };
    this.state = loaded;
    this._initialized = true;
    return this.state;
  },
  save() {
    if (!this._initialized) {
      this.init();
    }
    writeStorage(this.state);
  },
};

Store.init();

export { Store, SCHEMA_VERSION, ensurePlantTrackingDefaults, computeDaysSinceWatered };
