const DEFAULT_RETRY_DELAYS = [1000, 5000, 15000];
const DEFAULT_STORE = "mutation-queue";

function now() {
  return Date.now();
}

function createPersistence() {
  if (typeof indexedDB === "undefined") {
    return new MemoryPersistence();
  }
  return new IndexedDbPersistence();
}

class MemoryPersistence {
  constructor() {
    this.store = new Map();
  }

  async getAll() {
    return Array.from(this.store.values()).map((value) => ({ ...value }));
  }

  async put(entry) {
    this.store.set(entry.id, { ...entry });
  }

  async update(entry) {
    this.store.set(entry.id, { ...entry });
  }

  async delete(id) {
    this.store.delete(id);
  }
}

class IndexedDbPersistence {
  constructor() {
    this.dbPromise = this._open();
  }

  _open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("plantit-offline", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DEFAULT_STORE)) {
          db.createObjectStore(DEFAULT_STORE, { keyPath: "id" });
        }
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async _withStore(mode, callback) {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DEFAULT_STORE, mode);
      const store = transaction.objectStore(DEFAULT_STORE);
      const result = callback(store);
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getAll() {
    return this._withStore("readonly", (store) => {
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result ?? []);
        request.onerror = () => reject(request.error);
      });
    });
  }

  async put(entry) {
    return this._withStore("readwrite", (store) => store.put(entry));
  }

  async update(entry) {
    return this._withStore("readwrite", (store) => store.put(entry));
  }

  async delete(id) {
    return this._withStore("readwrite", (store) => store.delete(id));
  }
}

function serializeHeaders(headers) {
  if (headers instanceof Headers) {
    return Array.from(headers.entries());
  }
  if (Array.isArray(headers)) {
    return headers.map(([key, value]) => [key, value]);
  }
  const normalized = [];
  if (headers && typeof headers === "object") {
    Object.entries(headers).forEach(([key, value]) => {
      normalized.push([key, value]);
    });
  }
  return normalized;
}

function reviveHeaders(serialized) {
  return new Headers(serialized ?? []);
}

function defaultIsOnline() {
  if (typeof navigator === "undefined") {
    return true;
  }
  if (typeof navigator.onLine === "boolean") {
    return navigator.onLine;
  }
  return true;
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class OfflineQueue extends EventTarget {
  constructor({
    fetchFn = fetch,
    persistence = createPersistence(),
    isOnline = defaultIsOnline,
    retryDelays = DEFAULT_RETRY_DELAYS,
  } = {}) {
    super();
    this.fetch = fetchFn;
    this.persistence = persistence;
    this.isOnline = isOnline;
    this.processing = false;
    this.pending = new Map();
    this._scheduleHandle = null;
    this.retryDelays = retryDelays;

    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this.processQueue();
      });
    }

    // Attempt to drain queued mutations on startup.
    setTimeout(() => {
      this.processQueue();
    }, 100);
  }

  async enqueue({ url, method, headers, body, resources, metadata }) {
    const entry = {
      id: createId(),
      url,
      method,
      headers: serializeHeaders(headers),
      body,
      resources: resources ?? [],
      metadata: metadata ?? {},
      attempts: 0,
      retryAt: 0,
      createdAt: now(),
      lastError: null,
    };
    await this.persistence.put(entry);
    const completion = this._createCompletionPromise(entry.id);
    this.dispatchEvent(new CustomEvent("queued", { detail: { entry } }));
    this.processQueue();
    return { id: entry.id, completion };
  }

  _createCompletionPromise(id) {
    if (this.pending.has(id)) {
      return this.pending.get(id).promise;
    }
    let resolveFn;
    let rejectFn;
    const promise = new Promise((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });
    this.pending.set(id, { resolve: resolveFn, reject: rejectFn, promise });
    return promise;
  }

  _resolve(id, value) {
    const pending = this.pending.get(id);
    if (pending) {
      pending.resolve(value);
      this.pending.delete(id);
    }
  }

  _reject(id, error) {
    const pending = this.pending.get(id);
    if (pending) {
      pending.reject(error);
      this.pending.delete(id);
    }
  }

  async processQueue() {
    if (this.processing) {
      return;
    }
    if (!this.isOnline()) {
      return;
    }
    this.processing = true;
    try {
      while (this.isOnline()) {
        const entries = await this.persistence.getAll();
        if (!entries.length) {
          break;
        }
        entries.sort((a, b) => a.createdAt - b.createdAt);
        const entry = entries.find((item) => item.retryAt <= now());
        if (!entry) {
          const nextRetry = Math.min(...entries.map((item) => item.retryAt));
          const delay = Math.max(nextRetry - now(), 0);
          this._schedule(delay);
          break;
        }
        const success = await this._attempt(entry);
        if (!success) {
          break;
        }
      }
    } finally {
      this.processing = false;
    }
  }

  _schedule(delay) {
    if (this._scheduleHandle) {
      clearTimeout(this._scheduleHandle);
    }
    this._scheduleHandle = setTimeout(() => {
      this.processQueue();
    }, delay);
  }

  async _attempt(entry) {
    let response;
    try {
      response = await this.fetch(entry.url, {
        method: entry.method,
        headers: reviveHeaders(entry.headers),
        body: entry.body,
      });
    } catch (error) {
      await this._scheduleRetry(entry, error?.message ?? "Network error");
      return false;
    }

    if (!response.ok) {
      const retriable = response.status >= 500;
      const detail = await this._safeParse(response);
      if (retriable) {
        await this._scheduleRetry(entry, detail?.error?.message ?? response.statusText);
        return false;
      }
      await this.persistence.delete(entry.id);
      this.dispatchEvent(
        new CustomEvent("mutationfailed", {
          detail: { entry, response, payload: detail },
        }),
      );
      this._reject(entry.id, new Error(detail?.error?.message ?? "Request failed"));
      return true;
    }

    const payload = await this._safeParse(response);
    await this.persistence.delete(entry.id);
    this.dispatchEvent(
      new CustomEvent("mutationapplied", {
        detail: { entry, response, payload },
      }),
    );
    this._resolve(entry.id, payload);
    return true;
  }

  async _safeParse(response) {
    const contentType = response.headers.get("Content-Type") || "";
    if (!contentType.includes("application/json")) {
      return null;
    }
    try {
      return await response.clone().json();
    } catch (error) {
      return null;
    }
  }

  async _scheduleRetry(entry, message) {
    entry.attempts += 1;
    const delay = this._getRetryDelay(entry.attempts);
    entry.retryAt = now() + delay;
    entry.lastError = message;
    await this.persistence.update(entry);
    this.dispatchEvent(
      new CustomEvent("retry", { detail: { entry, message } }),
    );
    this._schedule(delay);
  }

  _getRetryDelay(attempts) {
    const index = Math.min(attempts, this.retryDelays.length - 1);
    return this.retryDelays[index];
  }
}

export const offlineQueue = new OfflineQueue();
