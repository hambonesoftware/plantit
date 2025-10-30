/**
 * API helper utilities shared across view models.
 *
 * The helper exports typed fetch wrappers that automatically attach correlation
 * identifiers so backend logs can be stitched together when diagnosing issues.
 *
 * @module services/api
 */

const DEFAULT_TIMEOUT_MS = 15000;
const API_BASE_URL = '/api';

/**
 * @typedef {Object} RequestOptions
 * @property {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} [method]
 * @property {HeadersInit} [headers]
 * @property {any} [body]
 * @property {AbortSignal} [signal]
 * @property {string} [correlationId]
 * @property {number} [timeout]
 */

/**
 * Base class for all API layer errors.
 */
export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{ correlationId?: string, cause?: unknown }} [options]
   */
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    /** @type {string | undefined} */
    this.correlationId = options.correlationId;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

/**
 * Error thrown when the browser cannot reach the backend (network failure or
 * timeout).
 */
export class NetworkError extends ApiError {}

/**
 * Error thrown when the backend responds with a non-2xx status code.
 */
export class HttpError extends ApiError {
  /**
   * @param {number} status
   * @param {Response} response
   * @param {{ correlationId?: string }} [options]
   */
  constructor(status, response, options = {}) {
    super(`HTTP ${status}`, { ...options, cause: response });
    this.status = status;
    this.response = response;
  }
}

/**
 * Error thrown when JSON parsing fails for a successful response.
 */
export class DecodeError extends ApiError {}

/**
 * Generate a correlation identifier suitable for tracing.  Falls back to a
 * timestamp-based id when `crypto.randomUUID` is unavailable.
 *
 * @returns {string}
 */
export function generateCorrelationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `cid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Perform a fetch with Plantit defaults applied.
 *
 * @template T
 * @param {string} path
 * @param {RequestOptions} [options]
 * @returns {Promise<T>}
 */
export async function request(path, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body,
    signal,
    correlationId = generateCorrelationId(),
    timeout = DEFAULT_TIMEOUT_MS,
  } = options;

  const controller = new AbortController();
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const requestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId,
      ...headers,
    },
    signal: controller.signal,
  };

  if (body !== undefined) {
    requestInit.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(resolveUrl(path), requestInit);
  } catch (error) {
    clearTimeout(timeoutId);
    throw new NetworkError('Failed to reach Plantit backend', {
      correlationId,
      cause: error,
    });
  }

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new HttpError(response.status, response, { correlationId });
  }

  try {
    const data = await response.json();
    return /** @type {T} */ (data);
  } catch (error) {
    throw new DecodeError('Unable to parse response JSON', {
      correlationId,
      cause: error,
    });
  }
}

/**
 * Resolve the API URL, prepending the configured base when the path is
 * relative.
 *
 * @param {string} path
 * @returns {string}
 */
function resolveUrl(path) {
  if (/^https?:/.test(path)) {
    return path;
  }
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** @typedef {Object} DashboardSummary
 *  @property {number} totalPlants
 *  @property {number} activeVillages
 *  @property {number} successRate
 *  @property {number} upcomingTasks
 */

/** @typedef {Object} DashboardAlert
 *  @property {string} id
 *  @property {'info'|'warning'|'critical'} level
 *  @property {string} message
 *  @property {string} [relatedPlantId]
 */

/** @typedef {Object} VillageSummary
 *  @property {string} id
 *  @property {string} name
 *  @property {string} climate
 *  @property {number} plantCount
 *  @property {number} healthScore
 */

/** @typedef {Object} VillageFilterState
 *  @property {string} searchTerm
 *  @property {string[]} climateZones
 *  @property {number | null} [minHealth]
 */

/** @typedef {Object} DailyTask
 *  @property {string} id
 *  @property {'water'|'fertilize'|'inspect'|'transplant'} type
 *  @property {string} plantId
 *  @property {string} plantName
 *  @property {string} villageName
 *  @property {string} dueAt
 *  @property {'low'|'medium'|'high'} priority
 */

/** @typedef {Object} PlantDetail
 *  @property {string} id
 *  @property {string} displayName
 *  @property {string} species
 *  @property {string} villageName
 *  @property {string} lastWateredAt
 *  @property {number} healthScore
 *  @property {string} notes
 */

/** @typedef {Object} PlantEvent
 *  @property {string} id
 *  @property {string} occurredAt
 *  @property {'watering'|'fertilizer'|'inspection'|'transfer'|'note'} type
 *  @property {string} summary
 */

/**
 * Convenience helpers mirroring the MVVM contracts.  Each function defers to the
 * generic `request` helper and returns typed payloads.
 */

/**
 * @param {string} [correlationId]
 * @returns {Promise<{ summary: DashboardSummary, alerts: DashboardAlert[] }>}
 */
export function fetchDashboard(correlationId) {
  return request('/dashboard', { correlationId });
}

/**
 * @param {Partial<VillageFilterState>} filters
 * @param {string} [correlationId]
 * @returns {Promise<{ villages: VillageSummary[] }>}
 */
export function fetchVillages(filters = {}, correlationId) {
  return request('/villages', {
    method: 'POST',
    body: filters,
    correlationId,
  });
}

/**
 * @param {string} [correlationId]
 * @returns {Promise<{ tasks: DailyTask[] }>}
 */
export function fetchTodayTasks(correlationId) {
  return request('/today', { correlationId });
}

/**
 * @param {string} plantId
 * @param {string} [correlationId]
 * @returns {Promise<{ plant: PlantDetail, timeline: PlantEvent[] }>}
 */
export function fetchPlantDetail(plantId, correlationId) {
  return request(`/plants/${plantId}`, { correlationId });
}
