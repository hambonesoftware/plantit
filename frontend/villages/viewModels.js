import {
  createPlant,
  createVillage,
  deletePlant,
  deleteVillage,
  fetchVillageDetail,
  fetchVillagePlants,
  fetchVillages,
  HttpError,
  NetworkError,
  updatePlant,
  updateVillage,
} from '../services/api.js';

/**
 * @typedef {'idle'|'loading'|'ready'|'error'} LoadStatus
 */

/**
 * @typedef {Object} ListErrorState
 * @property {'network'|'http'|'unknown'} type
 * @property {string} message
 * @property {Error} [cause]
 */

/**
 * @typedef {Object} VillageListState
 * @property {LoadStatus} status
 * @property {import('../services/api.js').VillageSummary[]} villages
 * @property {string | null} selectedVillageId
 * @property {import('../services/api.js').VillageFilterState} filters
 * @property {ListErrorState | null} error
 */

/**
 * @typedef {Object} VillageDetailErrorState
 * @property {'network'|'http'|'unknown'} type
 * @property {string} message
 * @property {Error} [cause]
 */

/**
 * @typedef {Object} VillageDetailState
 * @property {LoadStatus} status
 * @property {import('../services/api.js').VillageDetail | null} village
 * @property {VillageDetailErrorState | null} error
 */

/**
 * @typedef {Object} VillagePlantListErrorState
 * @property {'network'|'http'|'unknown'} type
 * @property {string} message
 * @property {Error} [cause]
 */

/**
 * @typedef {Object} VillagePlantListState
 * @property {LoadStatus} status
 * @property {import('../services/api.js').VillageSummary | null} village
 * @property {import('../services/api.js').PlantListItem[]} plants
 * @property {VillagePlantListErrorState | null} error
 * @property {string | null} lastUpdated
 */

const DEFAULT_FILTERS = Object.freeze({
  searchTerm: '',
  climateZones: [],
  minHealth: null,
});

function clampHealthScore(value, fallback = 0) {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
      ? Number.parseFloat(value)
      : Number.NaN;
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, numeric));
}

function normalizeVillageDetailPayload(village) {
  if (!village || typeof village !== 'object') {
    throw new Error('Invalid village payload');
  }
  const id = typeof village.id === 'string' ? village.id : String(village.id ?? '').trim();
  const updatedAt = typeof village.updatedAt === 'string' ? village.updatedAt : new Date().toISOString();
  return {
    id,
    name: typeof village.name === 'string' ? village.name : '',
    climate: typeof village.climate === 'string' ? village.climate : '',
    plantCount: Number.isFinite(village.plantCount) ? village.plantCount : Number.parseInt(village.plantCount ?? 0, 10) || 0,
    healthScore: clampHealthScore(village.healthScore),
    description: typeof village.description === 'string' ? village.description : null,
    establishedAt: typeof village.establishedAt === 'string' ? village.establishedAt : null,
    irrigationType: typeof village.irrigationType === 'string' ? village.irrigationType : null,
    updatedAt,
  };
}

function summarizeVillage(detail) {
  const normalized = normalizeVillageDetailPayload(detail);
  return {
    id: normalized.id,
    name: normalized.name,
    climate: normalized.climate,
    plantCount: normalized.plantCount,
    healthScore: normalized.healthScore,
    updatedAt: normalized.updatedAt,
  };
}

function normalizePlantDetailPayload(plant) {
  if (!plant || typeof plant !== 'object') {
    throw new Error('Invalid plant payload');
  }
  const updatedAt = typeof plant.updatedAt === 'string' ? plant.updatedAt : new Date().toISOString();
  const stage = typeof plant.stage === 'string' ? plant.stage : 'seedling';
  return {
    id: typeof plant.id === 'string' ? plant.id : String(plant.id ?? '').trim(),
    displayName: typeof plant.displayName === 'string' ? plant.displayName : '',
    species: typeof plant.species === 'string' ? plant.species : '',
    stage,
    lastWateredAt: typeof plant.lastWateredAt === 'string' ? plant.lastWateredAt : null,
    healthScore: clampHealthScore(plant.healthScore),
    notes: typeof plant.notes === 'string' ? plant.notes : '',
    updatedAt,
    villageId:
      typeof plant.villageId === 'string'
        ? plant.villageId
        : typeof plant.village_id === 'string'
        ? plant.village_id
        : '',
    villageName: typeof plant.villageName === 'string' ? plant.villageName : '',
  };
}

function summarizePlant(detail) {
  const normalized = normalizePlantDetailPayload(detail);
  return {
    id: normalized.id,
    displayName: normalized.displayName,
    species: normalized.species,
    stage: normalized.stage,
    lastWateredAt: normalized.lastWateredAt,
    healthScore: normalized.healthScore,
    updatedAt: normalized.updatedAt,
    notes: normalized.notes,
  };
}

function normalizeFilters(filters) {
  const searchTerm = typeof filters.searchTerm === 'string' ? filters.searchTerm.trim() : '';
  const climateZones = Array.isArray(filters.climateZones)
    ? filters.climateZones
        .map((zone) => (typeof zone === 'string' ? zone.trim() : ''))
        .filter(Boolean)
    : [];

  let minHealth = null;
  if (filters.minHealth !== undefined && filters.minHealth !== null) {
    const parsed =
      typeof filters.minHealth === 'number'
        ? filters.minHealth
        : Number.parseFloat(filters.minHealth);
    minHealth = Number.isFinite(parsed) ? parsed : null;
  }

  return {
    searchTerm,
    climateZones,
    minHealth,
  };
}

function cloneFilters(filters) {
  return {
    searchTerm: filters.searchTerm,
    climateZones: [...filters.climateZones],
    minHealth: filters.minHealth,
  };
}

export class VillageListViewModel {
  constructor(options = {}) {
    const {
      fetcher = fetchVillages,
      creator = createVillage,
      updater = updateVillage,
      deleter = deleteVillage,
      onVillageUpdate,
      onVillageDelete,
    } = options;
    this._fetcher = fetcher;
    this._creator = creator;
    this._updater = updater;
    this._deleter = deleter;
    this._notifyVillageUpdate =
      typeof onVillageUpdate === 'function' ? onVillageUpdate : () => {};
    this._notifyVillageDelete =
      typeof onVillageDelete === 'function' ? onVillageDelete : () => {};
    this._subscribers = new Set();
    this._filters = normalizeFilters(DEFAULT_FILTERS);
    /** @type {VillageListState} */
    this._state = {
      status: 'idle',
      villages: [],
      selectedVillageId: null,
      filters: cloneFilters(this._filters),
      error: null,
    };
    this._currentPromise = null;
    this._requestToken = 0;
  }

  /**
   * @param {(state: VillageListState) => void} subscriber
   * @returns {() => void}
   */
  subscribe(subscriber) {
    this._subscribers.add(subscriber);
    subscriber(this._state);
    return () => {
      this._subscribers.delete(subscriber);
    };
  }

  /**
   * @returns {VillageListState}
   */
  getState() {
    return this._state;
  }

  /**
   * Fetch villages using the active filters.
   *
   * @returns {Promise<void>}
   */
  async load() {
    const token = ++this._requestToken;
    this._transition({ status: 'loading', error: null });

    const request = (async () => {
      try {
        const payload = await this._fetcher(cloneFilters(this._filters));
        if (token !== this._requestToken) {
          return;
        }

        const villages = Array.isArray(payload?.villages)
          ? payload.villages
              .map((item) => {
                try {
                  return summarizeVillage(item);
                } catch (error) {
                  console.warn(
                    'VillageListViewModel: skipping invalid village payload',
                    item,
                    error,
                  );
                  return null;
                }
              })
              .filter(Boolean)
          : [];
        const appliedFilters = normalizeFilters(payload?.appliedFilters ?? this._filters);
        const currentSelection = this._state.selectedVillageId;
        const nextSelection =
          currentSelection && villages.some((village) => village.id === currentSelection)
            ? currentSelection
            : null;

        this._filters = appliedFilters;
        this._transition({
          status: 'ready',
          villages,
          filters: cloneFilters(appliedFilters),
          selectedVillageId: nextSelection,
          error: null,
        });
      } catch (error) {
        if (token !== this._requestToken) {
          return;
        }
        console.error('VillageListViewModel: failed to load villages', error);
        this._transition({
          status: 'error',
          villages: [],
          filters: cloneFilters(this._filters),
          error: this._normalizeError(error),
        });
      } finally {
        if (token === this._requestToken) {
          this._currentPromise = null;
        }
      }
    })();

    this._currentPromise = request;
    return request;
  }

  /**
   * Ensure data is available; used when entering the villages route.
   *
   * @returns {Promise<void> | void}
   */
  ensureLoaded() {
    if (this._state.status === 'ready') {
      return;
    }
    if (this._state.status === 'loading' && this._currentPromise) {
      return this._currentPromise;
    }
    return this.load();
  }

  /**
   * Apply a filter patch and re-fetch the list.
   *
   * @param {Partial<import('../services/api.js').VillageFilterState>} filters
   * @returns {Promise<void>}
   */
  applyFilters(filters = {}) {
    this._filters = normalizeFilters({ ...this._filters, ...filters });
    return this.load();
  }

  /**
   * Retry the last request.
   *
   * @returns {Promise<void>}
   */
  retry() {
    return this.load();
  }

  /**
   * Update the selected village identifier.
   *
   * @param {string | null | undefined} villageId
   */
  setSelectedVillageId(villageId) {
    const next = typeof villageId === 'string' && villageId ? villageId : null;
    if (this._state.selectedVillageId === next) {
      return;
    }
    this._transition({ selectedVillageId: next });
  }

  /**
   * Optimistically create a village and update the list state.
   *
   * @param {Partial<import('../services/api.js').VillageWritePayload>} payload
   * @returns {Promise<import('../services/api.js').VillageDetail>}
   */
  async createVillage(payload) {
    const requestPayload = this._prepareVillagePayload(payload);
    const previousVillages = this._state.villages;
    const previousSelection = this._state.selectedVillageId;

    const optimisticId = `temp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const optimisticSummary = {
      id: optimisticId,
      name: requestPayload.name,
      climate: requestPayload.climate,
      plantCount: 0,
      healthScore: requestPayload.healthScore,
      updatedAt: new Date().toISOString(),
    };

    this._transition({
      villages: [optimisticSummary, ...previousVillages],
      selectedVillageId: optimisticId,
    });

    try {
      const response = await this._creator(requestPayload);
      const detail = normalizeVillageDetailPayload(response?.village);
      const summary = summarizeVillage(detail);
      const nextVillages = this._state.villages.map((item) =>
        item.id === optimisticId ? summary : item,
      );
      this._transition({ villages: nextVillages, selectedVillageId: summary.id });
      this._notifyVillageUpdate(detail);
      return detail;
    } catch (error) {
      this._transition({
        villages: previousVillages,
        selectedVillageId: previousSelection,
      });
      throw error;
    }
  }

  /**
   * Optimistically update a village while preserving local filters and selection.
   *
   * @param {string} villageId
   * @param {Partial<import('../services/api.js').VillageUpdatePayload>} payload
   * @returns {Promise<import('../services/api.js').VillageDetail>}
   */
  async updateVillage(villageId, payload) {
    if (!villageId) {
      throw new Error('villageId is required');
    }
    const updatedAt = typeof payload?.updatedAt === 'string' ? payload.updatedAt : null;
    if (!updatedAt) {
      throw new Error('updatedAt token required for optimistic update');
    }

    const requestPayload = {
      ...this._prepareVillagePayload(payload),
      updatedAt,
    };

    const previousVillages = this._state.villages;
    const optimisticSummary = summarizeVillage({
      id: villageId,
      name: requestPayload.name,
      climate: requestPayload.climate,
      plantCount:
        previousVillages.find((item) => item.id === villageId)?.plantCount ?? 0,
      healthScore: requestPayload.healthScore,
      updatedAt: new Date().toISOString(),
    });

    const nextVillages = previousVillages.map((item) =>
      item.id === villageId ? optimisticSummary : item,
    );
    this._transition({ villages: nextVillages });

    try {
      const response = await this._updater(villageId, requestPayload);
      const detail = normalizeVillageDetailPayload(response?.village);
      const summary = summarizeVillage(detail);
      const refreshedVillages = this._state.villages.map((item) =>
        item.id === summary.id ? summary : item,
      );
      this._transition({ villages: refreshedVillages });
      this._notifyVillageUpdate(detail);
      return detail;
    } catch (error) {
      this._transition({ villages: previousVillages });
      throw error;
    }
  }

  /**
   * Optimistically remove a village.
   *
   * @param {string} villageId
   * @param {string} updatedAt
   * @returns {Promise<void>}
   */
  async deleteVillage(villageId, updatedAt) {
    if (!villageId) {
      throw new Error('villageId is required');
    }
    if (!updatedAt) {
      throw new Error('updatedAt token required for delete');
    }

    const previousVillages = this._state.villages;
    const previousSelection = this._state.selectedVillageId;
    const nextVillages = previousVillages.filter((item) => item.id !== villageId);
    const nextSelection = previousSelection === villageId ? null : previousSelection;

    this._transition({ villages: nextVillages, selectedVillageId: nextSelection });

    try {
      await this._deleter(villageId, { updatedAt });
      this._notifyVillageDelete(villageId);
    } catch (error) {
      this._transition({
        villages: previousVillages,
        selectedVillageId: previousSelection,
      });
      throw error;
    }
  }

  /**
   * Synchronize an externally updated village with the list state.
   *
   * @param {import('../services/api.js').VillageDetail} village
   */
  applyExternalVillage(village) {
    try {
      const detail = normalizeVillageDetailPayload(village);
      const summary = summarizeVillage(detail);
      const existingIndex = this._state.villages.findIndex((item) => item.id === summary.id);
      if (existingIndex === -1) {
        this._transition({ villages: [summary, ...this._state.villages] });
      } else {
        const nextVillages = [...this._state.villages];
        nextVillages[existingIndex] = summary;
        this._transition({ villages: nextVillages });
      }
    } catch (error) {
      console.warn('VillageListViewModel: failed to apply external village', village, error);
    }
  }

  /**
   * Remove a village from the list based on an external deletion event.
   *
   * @param {string} villageId
   */
  handleVillageDeleted(villageId) {
    if (!villageId) {
      return;
    }
    const nextVillages = this._state.villages.filter((item) => item.id !== villageId);
    const nextSelection =
      this._state.selectedVillageId === villageId ? null : this._state.selectedVillageId;
    this._transition({ villages: nextVillages, selectedVillageId: nextSelection });
  }

  _transition(patch) {
    this._state = {
      ...this._state,
      ...patch,
    };
    for (const subscriber of this._subscribers) {
      subscriber(this._state);
    }
  }

  _prepareVillagePayload(input = {}) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const climate = typeof input.climate === 'string' ? input.climate.trim() : '';
    if (!name) {
      throw new Error('Village name is required');
    }
    if (!climate) {
      throw new Error('Village climate is required');
    }

    const description =
      typeof input.description === 'string' ? input.description.trim() : input.description;
    const irrigationType =
      typeof input.irrigationType === 'string'
        ? input.irrigationType.trim()
        : input.irrigationType;
    const establishedAt =
      typeof input.establishedAt === 'string' && input.establishedAt.trim() !== ''
        ? input.establishedAt
        : null;
    const healthScore = clampHealthScore(input.healthScore, 0.5);

    return {
      name,
      climate,
      description: typeof description === 'string' && description !== '' ? description : null,
      irrigationType:
        typeof irrigationType === 'string' && irrigationType !== '' ? irrigationType : null,
      establishedAt,
      healthScore,
    };
  }

  _normalizeError(error) {
    if (error instanceof NetworkError) {
      return {
        type: 'network',
        message: 'Unable to reach Plantit. Check your connection and retry.',
        cause: error,
      };
    }
    if (error instanceof HttpError) {
      return {
        type: 'http',
        message: `Plantit responded with status ${error.status}. Please try again shortly.`,
        cause: error,
      };
    }
    return {
      type: 'unknown',
      message: 'Something went wrong while loading villages. Please retry.',
      cause: error instanceof Error ? error : undefined,
    };
  }
}

export class VillageDetailViewModel {
  constructor(options = {}) {
    const { fetcher = fetchVillageDetail } = options;
    this._fetcher = fetcher;
    this._subscribers = new Set();
    /** @type {VillageDetailState} */
    this._state = {
      status: 'idle',
      village: null,
      error: null,
    };
    this._currentPromise = null;
    this._requestToken = 0;
    this._currentVillageId = null;
  }

  /**
   * @param {(state: VillageDetailState) => void} subscriber
   * @returns {() => void}
   */
  subscribe(subscriber) {
    this._subscribers.add(subscriber);
    subscriber(this._state);
    return () => {
      this._subscribers.delete(subscriber);
    };
  }

  /**
   * @returns {VillageDetailState}
   */
  getState() {
    return this._state;
  }

  /**
   * Fetch detail for the provided village id.
   *
   * @param {string} villageId
   * @returns {Promise<void>}
   */
  async load(villageId) {
    const targetId = typeof villageId === 'string' && villageId ? villageId : null;
    if (!targetId) {
      this.clear();
      return;
    }

    this._currentVillageId = targetId;
    const token = ++this._requestToken;
    this._transition({ status: 'loading', error: null, village: null });

    const request = (async () => {
      try {
        const payload = await this._fetcher(targetId);
        if (token !== this._requestToken || this._currentVillageId !== targetId) {
          return;
        }
        const villagePayload = payload?.village ?? null;
        if (!villagePayload) {
          throw new Error('Village detail missing from response');
        }
        const village = normalizeVillageDetailPayload(villagePayload);
        this._transition({ status: 'ready', village, error: null });
      } catch (error) {
        if (token !== this._requestToken || this._currentVillageId !== targetId) {
          return;
        }
        console.error('VillageDetailViewModel: failed to load village detail', error);
        this._transition({
          status: 'error',
          village: null,
          error: this._normalizeError(error),
        });
      } finally {
        if (token === this._requestToken) {
          this._currentPromise = null;
        }
      }
    })();

    this._currentPromise = request;
    return request;
  }

  /**
   * Retry loading the current village.
   *
   * @returns {Promise<void> | void}
   */
  retry() {
    if (!this._currentVillageId) {
      return;
    }
    return this.load(this._currentVillageId);
  }

  /**
   * Clear the current selection and reset state.
   */
  clear() {
    this._currentVillageId = null;
    this._requestToken += 1;
    this._currentPromise = null;
    this._transition({ status: 'idle', village: null, error: null });
  }

  /**
   * Apply external updates to the active village when ids match.
   *
   * @param {import('../services/api.js').VillageDetail} village
   */
  applyExternalVillage(village) {
    if (!village || typeof village !== 'object') {
      return;
    }
    if (!this._currentVillageId) {
      return;
    }
    try {
      const detail = normalizeVillageDetailPayload(village);
      if (detail.id !== this._currentVillageId) {
        return;
      }
      this._transition({ status: 'ready', village: detail, error: null });
    } catch (error) {
      console.warn('VillageDetailViewModel: failed to apply external update', village, error);
    }
  }

  /**
   * Clear the view when a village is removed elsewhere.
   *
   * @param {string} villageId
   */
  handleVillageDeleted(villageId) {
    if (this._currentVillageId !== villageId) {
      return;
    }
    this.clear();
  }

  _transition(patch) {
    this._state = {
      ...this._state,
      ...patch,
    };
    for (const subscriber of this._subscribers) {
      subscriber(this._state);
    }
  }

  _preparePlantPayload(input = {}, options = {}) {
    const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : '';
    const species = typeof input.species === 'string' ? input.species.trim() : '';
    const stage = typeof input.stage === 'string' ? input.stage.trim().toLowerCase() : '';
    if (!displayName) {
      throw new Error('Plant name is required');
    }
    if (!species) {
      throw new Error('Plant species is required');
    }
    if (!stage) {
      throw new Error('Plant stage is required');
    }

    const lastWateredAt =
      typeof input.lastWateredAt === 'string' && input.lastWateredAt.trim() !== ''
        ? input.lastWateredAt
        : null;
    const notes =
      typeof input.notes === 'string' ? input.notes.trim() : typeof input.notes === 'number' ? String(input.notes) : input.notes;

    const payload = {
      displayName,
      species,
      stage,
      lastWateredAt,
      healthScore: clampHealthScore(input.healthScore, 0.5),
      notes: typeof notes === 'string' && notes !== '' ? notes : null,
    };

    if (options.includeVillageId) {
      payload.villageId = options.includeVillageId;
    }
    if (options.updatedAt) {
      payload.updatedAt = options.updatedAt;
    }

    return payload;
  }

  _normalizeError(error) {
    if (error instanceof NetworkError) {
      return {
        type: 'network',
        message: 'Unable to load village details due to a network issue. Please retry.',
        cause: error,
      };
    }
    if (error instanceof HttpError) {
      return {
        type: 'http',
        message: `Village details returned HTTP ${error.status}. Try again soon.`,
        cause: error,
      };
    }
    return {
      type: 'unknown',
      message: 'Something went wrong while loading the village. Please try again.',
      cause: error instanceof Error ? error : undefined,
    };
  }
}

export class VillagePlantListViewModel {
  constructor(options = {}) {
    const {
      fetcher = fetchVillagePlants,
      creator = createPlant,
      updater = updatePlant,
      deleter = deletePlant,
      onVillageUpdate,
    } = options;
    this._fetcher = fetcher;
    this._creator = creator;
    this._updater = updater;
    this._deleter = deleter;
    this._notifyVillageUpdate =
      typeof onVillageUpdate === 'function' ? onVillageUpdate : () => {};
    this._subscribers = new Set();
    /** @type {VillagePlantListState} */
    this._state = {
      status: 'idle',
      village: null,
      plants: [],
      error: null,
      lastUpdated: null,
    };
    this._currentPromise = null;
    this._requestToken = 0;
    this._currentVillageId = null;
  }

  /**
   * @param {(state: VillagePlantListState) => void} subscriber
   * @returns {() => void}
   */
  subscribe(subscriber) {
    this._subscribers.add(subscriber);
    subscriber(this._state);
    return () => {
      this._subscribers.delete(subscriber);
    };
  }

  /**
   * @returns {VillagePlantListState}
   */
  getState() {
    return this._state;
  }

  /**
   * @param {string} villageId
   * @param {{ force?: boolean }} [options]
   * @returns {Promise<void> | void}
   */
  load(villageId, options = {}) {
    const targetId = typeof villageId === 'string' && villageId ? villageId : null;
    const force = Boolean(options.force);

    if (!targetId) {
      this.clear();
      return;
    }

    if (!force && this._currentVillageId === targetId && this._state.status === 'ready') {
      return;
    }

    this._currentVillageId = targetId;
    const token = ++this._requestToken;
    this._transition({ status: 'loading', error: null });

    const request = (async () => {
      try {
        const payload = await this._fetcher(targetId);
        if (token !== this._requestToken || this._currentVillageId !== targetId) {
          return;
        }
        const villagePayload = payload?.village ?? null;
        const plantPayload = Array.isArray(payload?.plants) ? payload.plants : [];
        if (!villagePayload) {
          throw new Error('Missing village summary in response');
        }
        const village = normalizeVillageDetailPayload(villagePayload);
        const plants = plantPayload
          .map((item) => {
            try {
              return summarizePlant(item);
            } catch (error) {
              console.warn('VillagePlantListViewModel: skipping invalid plant payload', item, error);
              return null;
            }
          })
          .filter(Boolean);
        this._transition({
          status: 'ready',
          village,
          plants,
          error: null,
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        if (token !== this._requestToken || this._currentVillageId !== targetId) {
          return;
        }
        console.error('VillagePlantListViewModel: failed to load plants', error);
        this._transition({
          status: 'error',
          village: this._state.village,
          plants: this._state.plants,
          error: this._normalizeError(error),
          lastUpdated: this._state.lastUpdated,
        });
      } finally {
        if (token === this._requestToken) {
          this._currentPromise = null;
        }
      }
    })();

    this._currentPromise = request;
    return request;
  }

  /**
   * Retry the last request for the current village.
   *
   * @returns {Promise<void> | void}
   */
  retry() {
    if (!this._currentVillageId) {
      return;
    }
    return this.load(this._currentVillageId, { force: true });
  }

  /**
   * Trigger a refresh even if the current data is already loaded.
   *
   * @returns {Promise<void> | void}
   */
  refresh() {
    if (!this._currentVillageId) {
      return;
    }
    return this.load(this._currentVillageId, { force: true });
  }

  /**
   * Clear the active village selection and reset state.
   */
  clear() {
    this._currentVillageId = null;
    this._requestToken += 1;
    this._currentPromise = null;
    this._transition({
      status: 'idle',
      village: null,
      plants: [],
      error: null,
      lastUpdated: null,
    });
  }

  /**
   * Optimistically add a plant to the current village.
   *
   * @param {Partial<import('../services/api.js').PlantCreatePayload>} payload
   * @returns {Promise<import('../services/api.js').PlantDetail>}
   */
  async createPlant(payload) {
    if (!this._currentVillageId) {
      throw new Error('No village selected');
    }

    const requestPayload = this._preparePlantPayload(payload, {
      includeVillageId: this._currentVillageId,
    });

    const previousPlants = this._state.plants;
    const previousVillage = this._state.village;
    const previousLastUpdated = this._state.lastUpdated;
    const optimisticId = `temp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const optimisticPlant = {
      id: optimisticId,
      displayName: requestPayload.displayName,
      species: requestPayload.species,
      stage: requestPayload.stage,
      lastWateredAt: requestPayload.lastWateredAt,
      healthScore: requestPayload.healthScore,
      updatedAt: new Date().toISOString(),
    };
    const optimisticVillage = previousVillage
      ? {
          ...previousVillage,
          plantCount: previousVillage.plantCount + 1,
          updatedAt: new Date().toISOString(),
        }
      : previousVillage;

    this._transition({
      plants: [optimisticPlant, ...previousPlants],
      village: optimisticVillage,
      lastUpdated: new Date().toISOString(),
    });

    try {
      const response = await this._creator(requestPayload);
      const detail = normalizePlantDetailPayload(response?.plant);
      const summary = summarizePlant(detail);
      const nextPlants = this._state.plants.map((item) =>
        item.id === optimisticId ? summary : item,
      );
      const updatedVillage = response?.village
        ? normalizeVillageDetailPayload(response.village)
        : this._state.village;
      this._transition({
        plants: nextPlants,
        village: updatedVillage,
        lastUpdated: new Date().toISOString(),
      });
      if (response?.village) {
        this._notifyVillageUpdate(normalizeVillageDetailPayload(response.village));
      }
      return detail;
    } catch (error) {
      this._transition({
        plants: previousPlants,
        village: previousVillage,
        lastUpdated: previousLastUpdated,
      });
      throw error;
    }
  }

  /**
   * Optimistically update a plant in the current village.
   *
   * @param {string} plantId
   * @param {Partial<import('../services/api.js').PlantUpdatePayload>} payload
   * @returns {Promise<import('../services/api.js').PlantDetail>}
   */
  async updatePlant(plantId, payload) {
    if (!plantId) {
      throw new Error('plantId is required');
    }
    const updatedAt = typeof payload?.updatedAt === 'string' ? payload.updatedAt : null;
    if (!updatedAt) {
      throw new Error('updatedAt token required for plant update');
    }

    const requestPayload = {
      ...this._preparePlantPayload(payload),
      updatedAt,
    };

    const previousPlants = this._state.plants;
    const previousLastUpdated = this._state.lastUpdated;
    const optimisticSummary = summarizePlant({
      id: plantId,
      displayName: requestPayload.displayName,
      species: requestPayload.species,
      stage: requestPayload.stage,
      lastWateredAt: requestPayload.lastWateredAt,
      healthScore: requestPayload.healthScore,
      updatedAt: new Date().toISOString(),
    });
    const nextPlants = previousPlants.map((item) =>
      item.id === plantId ? optimisticSummary : item,
    );
    this._transition({ plants: nextPlants, lastUpdated: new Date().toISOString() });

    try {
      const response = await this._updater(plantId, requestPayload);
      const detail = normalizePlantDetailPayload(response?.plant);
      const summary = summarizePlant(detail);
      const refreshedPlants = this._state.plants.map((item) =>
        item.id === summary.id ? summary : item,
      );
      const updatedVillage = response?.village
        ? normalizeVillageDetailPayload(response.village)
        : this._state.village;
      this._transition({
        plants: refreshedPlants,
        village: updatedVillage,
        lastUpdated: new Date().toISOString(),
      });
      if (response?.village) {
        this._notifyVillageUpdate(normalizeVillageDetailPayload(response.village));
      }
      return detail;
    } catch (error) {
      this._transition({ plants: previousPlants, lastUpdated: previousLastUpdated });
      throw error;
    }
  }

  /**
   * Optimistically delete a plant.
   *
   * @param {string} plantId
   * @param {string} updatedAt
   * @returns {Promise<void>}
   */
  async deletePlant(plantId, updatedAt) {
    if (!plantId) {
      throw new Error('plantId is required');
    }
    if (!updatedAt) {
      throw new Error('updatedAt token required for delete');
    }

    const previousPlants = this._state.plants;
    const previousVillage = this._state.village;
    const previousLastUpdated = this._state.lastUpdated;
    const nextPlants = previousPlants.filter((item) => item.id !== plantId);
    const optimisticVillage = previousVillage
      ? {
          ...previousVillage,
          plantCount: Math.max(0, previousVillage.plantCount - 1),
          updatedAt: new Date().toISOString(),
        }
      : previousVillage;

    this._transition({
      plants: nextPlants,
      village: optimisticVillage,
      lastUpdated: new Date().toISOString(),
    });

    try {
      const response = await this._deleter(plantId, { updatedAt });
      if (response?.village) {
        const detail = normalizeVillageDetailPayload(response.village);
        this._transition({ village: detail, lastUpdated: new Date().toISOString() });
        this._notifyVillageUpdate(detail);
      }
    } catch (error) {
      this._transition({
        plants: previousPlants,
        village: previousVillage,
        lastUpdated: previousLastUpdated,
      });
      throw error;
    }
  }

  /**
   * Apply external updates to the parent village summary when it matches the active one.
   *
   * @param {import('../services/api.js').VillageDetail} village
   */
  applyExternalVillage(village) {
    if (!village || typeof village !== 'object') {
      return;
    }
    if (!this._state.village || this._state.village.id !== village.id) {
      return;
    }
    try {
      const detail = normalizeVillageDetailPayload(village);
      this._transition({ village: detail });
    } catch (error) {
      console.warn('VillagePlantListViewModel: failed to apply external village', village, error);
    }
  }

  /**
   * Clear the state when the associated village is deleted externally.
   *
   * @param {string} villageId
   */
  handleVillageDeleted(villageId) {
    if (this._state.village?.id !== villageId) {
      return;
    }
    this.clear();
  }

  _transition(patch) {
    this._state = {
      ...this._state,
      ...patch,
    };
    for (const subscriber of this._subscribers) {
      subscriber(this._state);
    }
  }

  _normalizeError(error) {
    if (error instanceof NetworkError) {
      return {
        type: 'network',
        message: 'Unable to reach Plantit. Check your connection and retry.',
        cause: error,
      };
    }
    if (error instanceof HttpError) {
      return {
        type: 'http',
        message: `Plantit responded with status ${error.status}. Please try again shortly.`,
        cause: error,
      };
    }
    return {
      type: 'unknown',
      message: 'Something went wrong while loading plants. Please retry.',
      cause: error instanceof Error ? error : undefined,
    };
  }
}
