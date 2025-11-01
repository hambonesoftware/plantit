import { describeApiError, fetchPlantDetail, recordPlantWatering } from '../services/api.js';

/**
 * @typedef {'idle'|'loading'|'ready'|'error'} LoadStatus
 */

/**
 * @typedef {Object} PlantWateringState
 * @property {string[]} history
 * @property {string | null} nextWateringDate
 * @property {boolean} hasWateringToday
 */

/**
 * @typedef {Object} PlantDetailState
 * @property {LoadStatus} status
 * @property {import('../services/api.js').PlantDetail | null} plant
 * @property {{ id: string, occurredAt: string, type: string, summary: string }[]} timeline
 * @property {import('../services/api.js').ErrorDescriptor | null} error
 * @property {PlantWateringState} watering
 * @property {boolean} isRecordingWatering
 */

export class PlantDetailViewModel {
  constructor(options = {}) {
    const { fetcher = fetchPlantDetail, waterer = recordPlantWatering } = options;
    this._fetcher = fetcher;
    this._waterer = waterer;
    this._subscribers = new Set();
    /** @type {PlantDetailState} */
    this._state = {
      status: 'idle',
      plant: null,
      timeline: [],
      error: null,
      watering: createEmptyWateringState(),
      isRecordingWatering: false,
    };
    this._currentPlantId = null;
    this._currentPromise = null;
    this._requestToken = 0;
    this._wateringToken = 0;
    this._fallbackVillageId = null;
    this._lastKnownVillageId = null;
  }

  /**
   * @param {(state: PlantDetailState) => void} subscriber
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
   * @returns {PlantDetailState}
   */
  getState() {
    return this._state;
  }

  /**
   * @returns {string | null}
   */
  getCurrentPlantId() {
    return this._currentPlantId;
  }

  /**
   * @returns {string | null}
   */
  getLastKnownVillageId() {
    const directVillage = this._state.plant?.villageId || null;
    if (directVillage) {
      return directVillage;
    }
    return this._lastKnownVillageId ?? this._fallbackVillageId;
  }

  /**
   * Set the fallback village identifier derived from navigation context.
   *
   * @param {string | null | undefined} villageId
   */
  setFallbackVillageId(villageId) {
    this._fallbackVillageId = typeof villageId === 'string' && villageId ? villageId : null;
  }

  /**
   * Load the requested plant detail, optionally forcing a refresh.
   *
   * @param {string} plantId
   * @param {{ force?: boolean }} [options]
   * @returns {Promise<void> | void}
   */
  load(plantId, options = {}) {
    const targetId = typeof plantId === 'string' && plantId ? plantId : null;
    const force = Boolean(options.force);

    if (!targetId) {
      this.clear();
      return;
    }

    if (!force && this._currentPlantId === targetId && this._state.status === 'ready') {
      return;
    }

    this._currentPlantId = targetId;
    const token = ++this._requestToken;
    this._transition({ status: 'loading', error: null });

    const request = (async () => {
      try {
        const payload = await this._fetcher(targetId);
        if (token !== this._requestToken || this._currentPlantId !== targetId) {
          return;
        }
        const plant = normalizePlantDetailPayload(payload?.plant);
        const timeline = normalizeTimeline(payload?.timeline);
        this._lastKnownVillageId = plant.villageId || this._fallbackVillageId;
        const watering = plant.watering || createEmptyWateringState();
        this._transition({
          status: 'ready',
          plant,
          timeline,
          error: null,
          watering,
          isRecordingWatering: false,
        });
      } catch (error) {
        if (token !== this._requestToken || this._currentPlantId !== targetId) {
          return;
        }
        this._transition({
          status: 'error',
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
   * Retry loading the current plant.
   *
   * @returns {Promise<void> | void}
   */
  retry() {
    if (!this._currentPlantId) {
      return;
    }
    return this.load(this._currentPlantId, { force: true });
  }

  /**
   * Clear state and abort in-flight requests.
   */
  clear() {
    this._currentPlantId = null;
    this._currentPromise = null;
    this._requestToken += 1;
    this._transition({
      status: 'idle',
      plant: null,
      timeline: [],
      error: null,
      watering: createEmptyWateringState(),
      isRecordingWatering: false,
    });
  }

  /**
   * Apply external plant updates when they match the active detail view.
   *
   * @param {import('../services/api.js').PlantDetail} plant
   */
  applyExternalPlant(plant) {
    if (!plant || typeof plant !== 'object') {
      return;
    }
    const normalized = normalizePlantDetailPayload(plant);
    if (this._state.plant?.id !== normalized.id) {
      return;
    }
    this._lastKnownVillageId = normalized.villageId || this._lastKnownVillageId;
    this._transition({
      plant: normalized,
      status: 'ready',
      error: null,
      watering: normalized.watering || this._state.watering,
    });
  }

  async markWateredToday(options = {}) {
    if (!this._currentPlantId) {
      return;
    }
    if (this._state.isRecordingWatering) {
      return;
    }
    const plantId = this._currentPlantId;
    const token = ++this._wateringToken;
    const normalizedOptions = options && typeof options === 'object' ? options : {};
    const requestedDate =
      typeof normalizedOptions.wateredAt === 'string' && normalizedOptions.wateredAt
        ? normalizedOptions.wateredAt
        : todayIsoDate();
    const payload = {};
    if (typeof normalizedOptions.wateredAt === 'string' && normalizedOptions.wateredAt) {
      payload.wateredAt = normalizedOptions.wateredAt;
    }
    this._transition({ isRecordingWatering: true });
    try {
      const response = await this._waterer(plantId, payload, normalizedOptions.correlationId);
      if (token !== this._wateringToken || this._currentPlantId !== plantId) {
        return;
      }
      const plant = normalizePlantDetailPayload(response?.plant);
      const timeline = response?.timeline
        ? normalizeTimeline(response.timeline)
        : this._state.timeline;
      this._lastKnownVillageId = plant.villageId || this._fallbackVillageId || this._lastKnownVillageId;
      const watering = applyRecordedWatering(plant.watering || this._state.watering, requestedDate);
      this._transition({
        status: 'ready',
        plant,
        timeline,
        error: null,
        watering,
        isRecordingWatering: false,
      });
    } catch (error) {
      if (token !== this._wateringToken || this._currentPlantId !== plantId) {
        return;
      }
      this._transition({ isRecordingWatering: false });
      throw error;
    }
  }

  /**
   * Clear the detail view when the active plant is deleted elsewhere.
   *
   * @param {string} plantId
   */
  handlePlantDeleted(plantId) {
    if (!plantId) {
      return;
    }
    if (this._state.plant?.id === plantId) {
      this.clear();
    }
  }

  /**
   * Clear the detail view when the owning village is removed.
   *
   * @param {string} villageId
   */
  handleVillageDeleted(villageId) {
    if (!villageId) {
      return;
    }
    const currentVillage = this._state.plant?.villageId || this._lastKnownVillageId || this._fallbackVillageId;
    if (currentVillage === villageId) {
      this.clear();
      this._fallbackVillageId = null;
      this._lastKnownVillageId = null;
    }
  }

  _normalizeError(error) {
    return describeApiError(error, {
      operation: 'Load plant detail',
      userMessage: 'We could not load this plant. Refresh and try again.',
    });
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
}

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

function normalizePlantDetailPayload(plant) {
  if (!plant || typeof plant !== 'object') {
    throw new Error('Invalid plant payload');
  }
  const updatedAt = typeof plant.updatedAt === 'string' ? plant.updatedAt : new Date().toISOString();
  const stage = typeof plant.stage === 'string' ? plant.stage : 'seedling';
  const watering = normalizeWatering(plant.watering);
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
    watering,
  };
}

function normalizeTimeline(timeline) {
  if (!Array.isArray(timeline)) {
    return [];
  }
  const entries = timeline
    .map((event, index) => {
      try {
        const id =
          typeof event.id === 'string' && event.id
            ? event.id
            : `event-${index}-${Math.random().toString(16).slice(2, 8)}`;
        const occurredAt = typeof event.occurredAt === 'string' ? event.occurredAt : null;
        return {
          id,
          occurredAt: occurredAt || new Date().toISOString(),
          type: typeof event.type === 'string' ? event.type : 'note',
          summary: typeof event.summary === 'string' ? event.summary : '',
        };
      } catch (error) {
        console.warn('PlantDetailViewModel: skipping invalid timeline event', event, error);
        return null;
      }
    })
    .filter(Boolean);

  entries.sort((a, b) => {
    const aTime = new Date(a.occurredAt).getTime();
    const bTime = new Date(b.occurredAt).getTime();
    if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
      return 0;
    }
    return bTime - aTime;
  });

  return entries;
}

function createEmptyWateringState() {
  return { history: [], nextWateringDate: null, hasWateringToday: false };
}

function normalizeWatering(watering) {
  if (!watering || typeof watering !== 'object') {
    return createEmptyWateringState();
  }
  const rawHistory = Array.isArray(watering.history) ? watering.history : [];
  const normalizedHistory = Array.from(
    new Set(
      rawHistory
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value)
    )
  ).sort();
  const nextWateringDate =
    typeof watering.nextWateringDate === 'string' && watering.nextWateringDate
      ? watering.nextWateringDate
      : null;
  const today = todayIsoDate();
  let hasWateringToday =
    typeof watering.hasWateringToday === 'boolean'
      ? watering.hasWateringToday
      : normalizedHistory.includes(today);
  if (!hasWateringToday && normalizedHistory.length > 0) {
    const mostRecent = normalizedHistory[normalizedHistory.length - 1];
    hasWateringToday = mostRecent === today;
  }
  return {
    history: normalizedHistory,
    nextWateringDate,
    hasWateringToday,
  };
}

function applyRecordedWatering(watering, recordedDate) {
  const normalized = normalizeWatering(watering);
  if (!recordedDate) {
    return normalized;
  }
  if (normalized.history.includes(recordedDate)) {
    return normalized;
  }
  const history = [...normalized.history, recordedDate].sort();
  const today = todayIsoDate();
  return {
    history,
    nextWateringDate: normalized.nextWateringDate,
    hasWateringToday: normalized.hasWateringToday || recordedDate === today,
  };
}

function todayIsoDate() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
