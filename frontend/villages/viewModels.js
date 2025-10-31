import { fetchVillageDetail, fetchVillages, HttpError, NetworkError } from '../services/api.js';

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

const DEFAULT_FILTERS = Object.freeze({
  searchTerm: '',
  climateZones: [],
  minHealth: null,
});

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
    const { fetcher = fetchVillages } = options;
    this._fetcher = fetcher;
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

        const villages = Array.isArray(payload?.villages) ? payload.villages : [];
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
        const village = payload?.village ?? null;
        if (!village) {
          throw new Error('Village detail missing from response');
        }
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
