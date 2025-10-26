import { emit } from "../state.js";

const DEFAULT_BACKOFF = 2000;
const MAX_BACKOFF = 60000;
const STORE_NAME = "requests";

function hasIndexedDB() {
  return typeof indexedDB !== "undefined";
}

function serializeBody(body) {
  if (body === undefined || body === null) {
    return { type: "empty" };
  }
  if (body instanceof FormData) {
    const entries = [];
    body.forEach((value, key) => {
      if (value instanceof File) {
        entries.push({ key, type: "file", value, name: value.name });
      } else if (value instanceof Blob) {
        entries.push({ key, type: "blob", value });
      } else {
        entries.push({ key, type: "text", value: value?.toString() ?? "" });
      }
    });
    return { type: "formData", entries };
  }
  if (typeof body === "string") {
    return { type: "string", value: body };
  }
  if (body instanceof Blob) {
    return { type: "blob", value: body };
  }
  return { type: "json", value: JSON.stringify(body) };
}

function deserializeBody(serialized) {
  if (!serialized || serialized.type === "empty") {
    return undefined;
  }
  if (serialized.type === "formData") {
    const form = new FormData();
    serialized.entries.forEach((entry) => {
      if (entry.type === "file") {
        form.append(entry.key, entry.value, entry.name);
      } else if (entry.type === "blob") {
        form.append(entry.key, entry.value);
      } else {
        form.append(entry.key, entry.value);
      }
    });
    return form;
  }
  if (serialized.type === "string" || serialized.type === "json") {
    return serialized.value;
  }
  if (serialized.type === "blob") {
    return serialized.value;
  }
  return undefined;
}

export class RequestQueue {
  constructor({ fetchImpl = fetch } = {}) {
    this.fetchImpl = fetchImpl;
    this.db = null;
    this.processing = false;
    this.memoryStore = [];
    this.memoryCounter = 0;
    this.timer = null;
  }

  async init() {
    if (!hasIndexedDB()) {
      if (typeof window !== "undefined") {
        window.addEventListener("online", () => {
          this.process().catch((error) => console.error("Failed to process queue", error));
        });
      }
      return;
    }
    this.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("plantit-request-queue", 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this.process().catch((error) => console.error("Failed to process queue", error));
      });
    }
  }

  async _getAll() {
    if (!this.db) {
      return this.memoryStore.map((item) => ({ ...item, body: item.body ? { ...item.body } : item.body }));
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async _put(entry) {
    if (!this.db) {
      const index = this.memoryStore.findIndex((item) => item.id === entry.id);
      if (index === -1) {
        this.memoryStore.push(entry);
      } else {
        this.memoryStore[index] = entry;
      }
      return entry.id;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(entry);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async _delete(id) {
    if (!this.db) {
      this.memoryStore = this.memoryStore.filter((item) => item.id !== id);
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async enqueue(request) {
    const entry = {
      method: request.method,
      path: request.path,
      body: serializeBody(request.body ?? null),
      headers: request.headers ?? {},
      attempts: 0,
      nextAttempt: Date.now(),
      metadata: request.metadata ?? {},
    };
    if (this.db) {
      entry.id = await new Promise((resolve, reject) => {
        const tx = this.db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const addRequest = store.add(entry);
        addRequest.onsuccess = () => resolve(addRequest.result);
        addRequest.onerror = () => reject(addRequest.error);
      });
    } else {
      this.memoryCounter += 1;
      entry.id = this.memoryCounter;
      this.memoryStore.push(entry);
    }
    emit("toast", { type: "info", message: "Action queued for retry when back online." });
    this.scheduleProcess(0);
    return entry.id;
  }

  scheduleProcess(delay = DEFAULT_BACKOFF) {
    const timeout = Math.max(0, delay);
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.process().catch((error) => console.error("Queue processing failed", error));
    }, timeout);
  }

  async process() {
    if (this.processing) {
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return;
    }
    this.processing = true;
    const processed = [];
    try {
      const entries = await this._getAll();
      for (const entry of entries) {
        if (entry.nextAttempt && entry.nextAttempt > Date.now()) {
          continue;
        }
        try {
          const headers = new Headers(entry.headers ?? {});
          const body = deserializeBody(entry.body);
          const response = await this.fetchImpl(entry.path, {
            method: entry.method,
            headers,
            body,
          });
          if (!response.ok) {
            if (response.status >= 500) {
              throw new Error(`Server error ${response.status}`);
            }
            const message = await this._extractError(response);
            await this._delete(entry.id);
            emit("toast", { type: "error", message });
            continue;
          }
          await this._delete(entry.id);
          processed.push({ id: entry.id, path: entry.path, method: entry.method, metadata: entry.metadata });
          emit("toast", { type: "success", message: "Queued request sent." });
        } catch (error) {
          const attempts = (entry.attempts ?? 0) + 1;
          const backoff = Math.min(MAX_BACKOFF, DEFAULT_BACKOFF * attempts);
          entry.attempts = attempts;
          entry.nextAttempt = Date.now() + backoff;
          await this._put(entry);
        }
      }
    } finally {
      this.processing = false;
      if (processed.length > 0) {
        processed.forEach((result) => {
          emit("requestQueue:success", result);
        });
      }
      const remaining = await this._getAll();
      if (remaining.length === 0) {
        emit("requestQueue:idle");
      } else {
        const delays = remaining
          .filter((item) => item.nextAttempt && item.nextAttempt > Date.now())
          .map((item) => Math.max(0, item.nextAttempt - Date.now()));
        if (delays.length > 0) {
          const nextDelay = Math.min(...delays);
          if (Number.isFinite(nextDelay)) {
            this.scheduleProcess(nextDelay);
          }
        }
      }
    }
  }

  async _extractError(response) {
    try {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const payload = await response.clone().json();
        if (payload?.detail) {
          return payload.detail;
        }
        if (payload?.message) {
          return payload.message;
        }
      }
      const text = await response.clone().text();
      return text?.trim() || `Request failed with status ${response.status}`;
    } catch (error) {
      console.error("Unable to parse queued response error", error);
      return `Request failed with status ${response.status}`;
    }
  }
}

export function createRequestQueue(options) {
  const queue = new RequestQueue(options);
  queue.init().catch((error) => console.error("Failed to initialize request queue", error));
  return queue;
}
