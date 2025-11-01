/**
 * API helper utilities shared across view models.
 *
 * The helper exports typed fetch wrappers that automatically attach correlation
 * identifiers so backend logs can be stitched together when diagnosing issues.
 *
 * @module services/api
 */

const DEFAULT_TIMEOUT_MS = 15000;

const DEFAULT_API_BASE_URL = '/api';
const DEV_STATIC_PORT = '5580';
const DEV_API_PORT = '5581';

function resolveApiBaseUrl() {
  if (typeof window === 'undefined') {
    return DEFAULT_API_BASE_URL;
  }

  if (typeof window.PLANTIT_API_BASE_URL === 'string' && window.PLANTIT_API_BASE_URL) {
    return window.PLANTIT_API_BASE_URL;
  }

  const { protocol, hostname, port } = window.location;
  if (port === DEV_STATIC_PORT) {
    const baseProtocol = protocol || 'http:';
    const host = hostname || '127.0.0.1';
    return `${baseProtocol}//${host}:${DEV_API_PORT}/api`;
  }

  return DEFAULT_API_BASE_URL;
}

const API_BASE_URL = resolveApiBaseUrl();

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
   * @param {{ correlationId?: string, body?: any }} [options]
   */
  constructor(status, response, options = {}) {
    const { correlationId, body } = options;
    super(`HTTP ${status}`, { correlationId, cause: response });
    this.status = status;
    this.response = response;
    this.body = body;
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
    const errorBody = await readErrorBody(response);
    if (typeof window !== 'undefined' && response.status === 401) {
      window.dispatchEvent(
        new CustomEvent('plantit:auth-required', { detail: { correlationId } })
      );
    }
    throw new HttpError(response.status, response, { correlationId, body: errorBody });
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

async function readErrorBody(response) {
  try {
    const clone = response.clone();
    const text = await clone.text();
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch (error) {
      return text;
    }
  } catch (error) {
    return null;
  }
}

/**
 * @typedef {'UserError'|'NetworkError'|'ServerError'} ErrorCategory
 */

/**
 * @typedef {Object} ErrorDescriptor
 * @property {ErrorCategory} category
 * @property {string} message
 * @property {string} detail
 * @property {string | null} correlationId
 * @property {number | null} status
 * @property {Error | undefined} cause
 */

/**
 * Normalize thrown errors into user-facing descriptors with diagnostic text.
 *
 * @param {unknown} error
 * @param {{
 *   operation?: string,
 *   userMessage?: string,
 *   serverMessage?: string,
 *   networkMessage?: string,
 *   defaultMessage?: string,
 * }} [options]
 * @returns {ErrorDescriptor}
 */
export function describeApiError(error, options = {}) {
  const {
    operation = 'Plantit request',
    userMessage,
    serverMessage,
    networkMessage,
    defaultMessage,
  } = options ?? {};
  const correlationId =
    error instanceof ApiError && typeof error.correlationId === 'string' ? error.correlationId : null;
  const cause = error instanceof Error ? error : undefined;

  if (error instanceof NetworkError) {
    const message =
      networkMessage ??
      'We cannot reach Plantit right now. Check your internet connection and try again.';
    return {
      category: 'NetworkError',
      message,
      detail: _buildDiagnosticDetail({
        operation,
        category: 'NetworkError',
        message,
        correlationId,
        status: null,
        body: null,
        cause,
      }),
      correlationId,
      status: null,
      cause,
    };
  }

  if (error instanceof HttpError) {
    const status = error.status;
    const category = status >= 500 ? 'ServerError' : 'UserError';
    const serverDetail = _extractBodyMessage(error.body);
    const message =
      category === 'UserError'
        ? userMessage ??
          serverDetail ??
          'The request could not be completed. Refresh the view and try again.'
        : serverMessage ??
          'Plantit encountered an unexpected issue. Please try again shortly.';
    return {
      category,
      message,
      detail: _buildDiagnosticDetail({
        operation,
        category,
        message,
        correlationId,
        status,
        body: error.body,
        cause,
        serverDetail,
      }),
      correlationId,
      status,
      cause,
    };
  }

  const message =
    defaultMessage ??
    'An unexpected error occurred. Please try again or contact support if the issue persists.';
  return {
    category: 'ServerError',
    message,
    detail: _buildDiagnosticDetail({
      operation,
      category: 'ServerError',
      message,
      correlationId,
      status: null,
      body: null,
      cause,
    }),
    correlationId,
    status: null,
    cause,
  };
}

function _buildDiagnosticDetail({
  operation,
  category,
  message,
  correlationId,
  status,
  body,
  cause,
  serverDetail,
}) {
  const lines = [
    `Operation: ${operation}`,
    `Category: ${category}`,
    `Message: ${message}`,
  ];
  if (correlationId) {
    lines.push(`Correlation ID: ${correlationId}`);
  }
  if (typeof status === 'number') {
    lines.push(`HTTP Status: ${status}`);
  }
  if (serverDetail && serverDetail !== message) {
    lines.push(`Server Detail: ${serverDetail}`);
  }
  const bodyText = _stringifyForDiagnostics(body);
  if (bodyText && bodyText !== serverDetail) {
    lines.push(`Response Payload: ${bodyText}`);
  }
  if (cause && cause.message && cause.message !== message) {
    lines.push(`Error: ${cause.message}`);
  }
  lines.push(`Timestamp: ${new Date().toISOString()}`);
  return lines.join('\n');
}

function _extractBodyMessage(body) {
  if (!body) {
    return null;
  }
  if (typeof body === 'string') {
    return body;
  }
  if (Array.isArray(body)) {
    return body
      .map((item) => (typeof item === 'string' ? item : _stringifyForDiagnostics(item) ?? ''))
      .filter(Boolean)
      .join('; ');
  }
  if (typeof body === 'object') {
    if (typeof body.detail === 'string') {
      return body.detail;
    }
    if (Array.isArray(body.detail)) {
      return body.detail
        .map((item) => (typeof item === 'string' ? item : _stringifyForDiagnostics(item) ?? ''))
        .filter(Boolean)
        .join('; ');
    }
    if (typeof body.message === 'string') {
      return body.message;
    }
  }
  return null;
}

function _stringifyForDiagnostics(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value.length > 2048 ? `${value.slice(0, 2045)}...` : value;
  }
  try {
    const json = JSON.stringify(value, null, 2);
    if (!json) {
      return null;
    }
    return json.length > 2048 ? `${json.slice(0, 2045)}...` : json;
  } catch (error) {
    const text = String(value);
    return text.length > 2048 ? `${text.slice(0, 2045)}...` : text;
  }
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
 *  @property {string} updatedAt
 */

/** @typedef {Object} VillageDetail
 *  @property {string} id
 *  @property {string} name
 *  @property {string} climate
 *  @property {number} plantCount
 *  @property {number} healthScore
 *  @property {string | null} description
 *  @property {string | null} establishedAt
 *  @property {string | null} irrigationType
 *  @property {string} updatedAt
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

/** @typedef {Object} PlantListItem
 *  @property {string} id
 *  @property {string} displayName
 *  @property {string} species
 *  @property {'seedling'|'vegetative'|'flowering'|'mature'} stage
 *  @property {string | null} lastWateredAt
 *  @property {number} healthScore
 *  @property {string} updatedAt
 *  @property {string} [notes]
 */

/** @typedef {Object} PlantDetail
 *  @property {string} id
 *  @property {string} displayName
 *  @property {string} species
 *  @property {string} villageName
 *  @property {string | null} lastWateredAt
 *  @property {number} healthScore
 *  @property {string} notes
 *  @property {string} updatedAt
 *  @property {string} villageId
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
  const params = new URLSearchParams();
  const searchTerm = typeof filters.searchTerm === 'string' ? filters.searchTerm.trim() : '';
  if (searchTerm) {
    params.set('searchTerm', searchTerm);
  }

  const climateZones = Array.isArray(filters.climateZones)
    ? filters.climateZones.filter((zone) => typeof zone === 'string' && zone.trim() !== '')
    : [];
  for (const zone of climateZones) {
    params.append('climateZones', zone.trim());
  }

  const minHealth = filters.minHealth;
  if (typeof minHealth === 'number' && Number.isFinite(minHealth)) {
    params.set('minHealth', String(minHealth));
  }

  const query = params.toString();
  const path = query ? `/villages?${query}` : '/villages';
  return request(path, { correlationId });
}

/**
 * @param {string} villageId
 * @param {string} [correlationId]
 * @returns {Promise<{ village: VillageDetail }>}
 */
export function fetchVillageDetail(villageId, correlationId) {
  if (!villageId) {
    return Promise.reject(new Error('villageId is required'));
  }
  return request(`/villages/${encodeURIComponent(villageId)}`, { correlationId });
}

/**
 * @param {string} villageId
 * @param {string} [correlationId]
 * @returns {Promise<{ village: VillageSummary, plants: PlantListItem[] }>}
 */
export function fetchVillagePlants(villageId, correlationId) {
  if (!villageId) {
    return Promise.reject(new Error('villageId is required'));
  }
  return request(`/villages/${encodeURIComponent(villageId)}/plants`, { correlationId });
}

/**
 * @param {string} [correlationId]
 * @returns {Promise<{ tasks: DailyTask[], emptyStateMessage: string | null }>}
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

/**
 * @typedef {Object} VillageWritePayload
 * @property {string} name
 * @property {string} climate
 * @property {string | null} [description]
 * @property {string | null} [establishedAt]
 * @property {string | null} [irrigationType]
 * @property {number} healthScore
 */

/**
 * @typedef {VillageWritePayload & { updatedAt: string }} VillageUpdatePayload
 */

/**
 * @param {VillageWritePayload} payload
 * @param {string} [correlationId]
 * @returns {Promise<{ village: VillageDetail }>}
 */
export function createVillage(payload, correlationId) {
  return request('/villages', {
    method: 'POST',
    body: payload,
    correlationId,
  });
}

/**
 * @param {string} villageId
 * @param {VillageUpdatePayload} payload
 * @param {string} [correlationId]
 * @returns {Promise<{ village: VillageDetail }>}
 */
export function updateVillage(villageId, payload, correlationId) {
  return request(`/villages/${encodeURIComponent(villageId)}`, {
    method: 'PUT',
    body: payload,
    correlationId,
  });
}

/**
 * @param {string} villageId
 * @param {{ updatedAt: string }} payload
 * @param {string} [correlationId]
 * @returns {Promise<{ status: string, villageId: string, updatedAt: string }>}
 */
export function deleteVillage(villageId, payload, correlationId) {
  return request(`/villages/${encodeURIComponent(villageId)}`, {
    method: 'DELETE',
    body: payload,
    correlationId,
  });
}

/**
 * @typedef {Object} PlantWritePayload
 * @property {string} displayName
 * @property {string} species
 * @property {'seedling'|'vegetative'|'flowering'|'mature'} stage
 * @property {string | null} [lastWateredAt]
 * @property {number} healthScore
 * @property {string | null} [notes]
 */

/**
 * @typedef {PlantWritePayload & { villageId: string }} PlantCreatePayload
 */

/**
 * @typedef {PlantWritePayload & { updatedAt: string }} PlantUpdatePayload
 */

/**
 * @param {PlantCreatePayload} payload
 * @param {string} [correlationId]
 * @returns {Promise<{ plant: PlantDetail, village: VillageSummary }>}
 */
export function createPlant(payload, correlationId) {
  return request('/plants', {
    method: 'POST',
    body: payload,
    correlationId,
  });
}

/**
 * @param {string} plantId
 * @param {PlantUpdatePayload} payload
 * @param {string} [correlationId]
 * @returns {Promise<{ plant: PlantDetail, village?: VillageSummary }>}
 */
export function updatePlant(plantId, payload, correlationId) {
  return request(`/plants/${encodeURIComponent(plantId)}`, {
    method: 'PUT',
    body: payload,
    correlationId,
  });
}

/**
 * @param {string} plantId
 * @param {{ updatedAt: string }} payload
 * @param {string} [correlationId]
 * @returns {Promise<{ status: string, plantId: string, updatedAt: string, village?: VillageSummary }>}
 */
export function deletePlant(plantId, payload, correlationId) {
  return request(`/plants/${encodeURIComponent(plantId)}`, {
    method: 'DELETE',
    body: payload,
    correlationId,
  });
}
