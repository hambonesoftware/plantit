import { fetchDashboard, HttpError, NetworkError } from '../services/api.js';

/**
 * @typedef {'idle'|'loading'|'ready'|'error'} DashboardStatus
 */

/**
 * @typedef {Object} DashboardErrorState
 * @property {string} message
 * @property {'network'|'http'|'unknown'} type
 * @property {Error} [cause]
 */

/**
 * @typedef {Object} DashboardState
 * @property {DashboardStatus} status
 * @property {import('../services/api.js').DashboardSummary | null} summary
 * @property {import('../services/api.js').DashboardAlert[]} alerts
 * @property {string | null} lastUpdated
 * @property {DashboardErrorState | null} error
 */

/**
 * Thin view model responsible for orchestrating dashboard data fetches and
 * notifying subscribers about state transitions.
 */
export class DashboardViewModel {
  /**
   * @param {{ fetcher?: typeof fetchDashboard }} [options]
   */
  constructor(options = {}) {
    const { fetcher = fetchDashboard } = options;
    this._fetcher = fetcher;
    /** @type {Set<(state: DashboardState) => void>} */
    this._subscribers = new Set();
    /** @type {DashboardState} */
    this._state = {
      status: 'idle',
      summary: null,
      alerts: [],
      lastUpdated: null,
      error: null,
    };
  }

  /**
   * Subscribe to state updates. The subscriber is invoked immediately with the
   * current state. Returns an unsubscribe handle.
   *
   * @param {(state: DashboardState) => void} subscriber
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
   * Trigger a dashboard fetch if one is not already in flight.
   *
   * @returns {Promise<void>}
   */
  async load() {
    if (this._state.status === 'loading') {
      return;
    }

    this._transition({ status: 'loading', error: null });

    try {
      const payload = await this._fetcher();
      const summary = payload?.summary ?? null;
      const alerts = Array.isArray(payload?.alerts) ? payload.alerts : [];
      const lastUpdated = typeof payload?.lastUpdated === 'string' ? payload.lastUpdated : null;
      this._transition({
        status: 'ready',
        summary,
        alerts,
        lastUpdated,
        error: null,
      });
    } catch (error) {
      const friendly = this._normalizeError(error);
      console.error('DashboardViewModel: failed to load dashboard', error);
      this._transition({
        status: 'error',
        error: friendly,
      });
    }
  }

  /**
   * Convenience wrapper used by retry buttons.
   *
   * @returns {Promise<void>}
   */
  async retry() {
    await this.load();
  }

  /**
   * @param {Partial<DashboardState>} patch
   */
  _transition(patch) {
    this._state = {
      ...this._state,
      ...patch,
    };
    for (const subscriber of this._subscribers) {
      subscriber(this._state);
    }
  }

  /**
   * @param {unknown} error
   * @returns {DashboardErrorState}
   */
  _normalizeError(error) {
    if (error instanceof NetworkError) {
      return {
        type: 'network',
        message: 'Unable to reach Plantit right now. Check your connection and try again.',
        cause: error,
      };
    }

    if (error instanceof HttpError) {
      return {
        type: 'http',
        message: `Plantit responded with an unexpected status (HTTP ${error.status}). Please retry shortly.`,
        cause: error,
      };
    }

    return {
      type: 'unknown',
      message: 'Something went wrong while loading the dashboard. Please try again.',
      cause: error instanceof Error ? error : undefined,
    };
  }
}
