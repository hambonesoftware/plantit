import { describeApiError, fetchDashboard, fetchTodayTasks } from '../services/api.js';

/**
 * @typedef {'idle'|'loading'|'ready'|'error'} DashboardStatus
 */

/**
 * @typedef {Object} DashboardState
 * @property {DashboardStatus} status
 * @property {import('../services/api.js').DashboardSummary | null} summary
 * @property {import('../services/api.js').DashboardAlert[]} alerts
 * @property {string | null} lastUpdated
 * @property {import('../services/api.js').ErrorDescriptor | null} error
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
   * @returns {import('../services/api.js').ErrorDescriptor}
   */
  _normalizeError(error) {
    return describeApiError(error, {
      operation: 'Load dashboard summary',
    });
  }
}

/**
 * @typedef {'idle'|'loading'|'ready'|'error'} TodayPanelStatus
 */

/**
 * @typedef {Object} TodayPanelState
 * @property {TodayPanelStatus} status
 * @property {import('../services/api.js').DailyTask[]} tasks
 * @property {string | null} emptyMessage
 * @property {string | null} lastUpdated
 * @property {import('../services/api.js').ErrorDescriptor | null} error
 */

export class TodayPanelViewModel {
  constructor(options = {}) {
    const { fetcher = fetchTodayTasks } = options;
    this._fetcher = fetcher;
    this._subscribers = new Set();
    /** @type {TodayPanelState} */
    this._state = {
      status: 'idle',
      tasks: [],
      emptyMessage: null,
      lastUpdated: null,
      error: null,
    };
    this._currentPromise = null;
    this._requestToken = 0;
  }

  /**
   * @param {(state: TodayPanelState) => void} subscriber
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
   * Load or refresh the Today panel data.
   *
   * @returns {Promise<void>}
   */
  async load() {
    if (this._state.status === 'loading') {
      return this._currentPromise ?? Promise.resolve();
    }

    const token = ++this._requestToken;
    this._transition({ status: 'loading', error: null });

    const request = (async () => {
      try {
        const payload = await this._fetcher();
        if (token !== this._requestToken) {
          return;
        }
        const tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];
        const emptyMessage = typeof payload?.emptyStateMessage === 'string'
          ? payload.emptyStateMessage
          : null;
        this._transition({
          status: 'ready',
          tasks,
          emptyMessage,
          lastUpdated: new Date().toISOString(),
          error: null,
        });
      } catch (error) {
        if (token !== this._requestToken) {
          return;
        }
        console.error('TodayPanelViewModel: failed to load tasks', error);
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
   * Trigger a refresh of the Today panel.
   *
   * @returns {Promise<void>}
   */
  async refresh() {
    return this.load();
  }

  /**
   * Retry after an error state.
   *
   * @returns {Promise<void>}
   */
  async retry() {
    return this.load();
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
    return describeApiError(error, {
      operation: "Load today's tasks",
      userMessage: "We couldn't load today's tasks. Refresh the page and try again.",
    });
  }
}
