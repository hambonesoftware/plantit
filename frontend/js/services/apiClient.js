import { emit } from "../state.js";

export class ApiError extends Error {
  constructor({ status, message, details, cause }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.cause = cause;
  }
}

function isJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json");
}

function normalizeHeaders(headers) {
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  return { ...headers };
}

function isMutation(method) {
  const normalized = method.toUpperCase();
  return ["POST", "PUT", "PATCH", "DELETE"].includes(normalized);
}

function resolveOptimisticData(optimistic) {
  if (typeof optimistic === "function") {
    return optimistic();
  }
  return optimistic ?? null;
}

function resolveFetch(fetchImpl) {
  if (fetchImpl) {
    return fetchImpl;
  }
  if (typeof fetch === "function") {
    return fetch;
  }
  throw new Error("A fetch implementation must be provided");
}

export class APIClient {
  constructor({ baseUrl = "/api/v1", fetchImpl, cache = new Map(), requestQueue = null } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    const resolvedFetch = resolveFetch(fetchImpl);
    const globalObject = typeof globalThis !== "undefined" ? globalThis : undefined;
    if (globalObject && typeof resolvedFetch === "function" && resolvedFetch === globalObject.fetch) {
      this.fetchImpl = resolvedFetch.bind(globalObject);
    } else {
      this.fetchImpl = resolvedFetch;
    }
    this.cache = cache;
    this.requestQueue = requestQueue;
  }

  buildUrl(path) {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${this.baseUrl}${cleanPath}`;
  }

  supportsQueue(method, queueEnabled) {
    if (!queueEnabled) {
      return false;
    }
    if (!this.requestQueue) {
      return false;
    }
    return isMutation(method);
  }

  isOffline() {
    if (typeof navigator === "undefined") {
      return false;
    }
    return navigator.onLine === false;
  }

  async queueRequest({ url, method, headers, body, optimisticData, metadata }) {
    if (!this.requestQueue) {
      throw new ApiError({
        status: 0,
        message: "Request queue unavailable",
        details: { method, url },
      });
    }
    await this.requestQueue.enqueue({
      method,
      path: url,
      headers: normalizeHeaders(headers),
      body,
      metadata,
    });
    return {
      data: resolveOptimisticData(optimisticData),
      status: 202,
      headers: {},
      fromCache: false,
      queued: true,
    };
  }

  async request(
    path,
    { method = "GET", data, headers = {}, signal, useETag = true, optimisticData, queue = true, metadata } = {},
  ) {
    const url = this.buildUrl(path);
    const normalizedMethod = method.toUpperCase();
    const requestHeaders = new Headers({
      Accept: "application/json",
      ...headers,
    });

    let body;
    if (data !== undefined && data !== null) {
      if (!(data instanceof FormData)) {
        requestHeaders.set("Content-Type", "application/json");
        body = JSON.stringify(data);
      } else {
        body = data;
      }
    }

    const cacheKey = `${normalizedMethod}:${url}`;
    const etagEntry = this.cache.get(cacheKey);
    if (useETag && normalizedMethod === "GET" && etagEntry?.etag) {
      requestHeaders.set("If-None-Match", etagEntry.etag);
    }

    const queueEnabled = this.supportsQueue(normalizedMethod, queue);
    if (queueEnabled && this.isOffline()) {
      return this.queueRequest({
        url,
        method: normalizedMethod,
        headers: requestHeaders,
        body,
        optimisticData,
        metadata,
      });
    }

    let response;
    try {
      response = await this.fetchImpl(url, {
        method: normalizedMethod,
        headers: requestHeaders,
        body,
        signal,
      });
    } catch (cause) {
      if (queueEnabled) {
        return this.queueRequest({
          url,
          method: normalizedMethod,
          headers: requestHeaders,
          body,
          optimisticData,
          metadata,
        });
      }
      throw new ApiError({
        status: 0,
        message: "Network request failed",
        details: { path, method: normalizedMethod },
        cause,
      });
    }

    if (response.status === 304 && useETag && etagEntry?.data !== undefined) {
      return {
        data: etagEntry.data,
        status: 304,
        headers: etagEntry.headers,
        fromCache: true,
      };
    }

    let payload;
    if (response.status !== 204) {
      try {
        payload = isJsonResponse(response) ? await response.json() : await response.text();
      } catch (cause) {
        throw new ApiError({
          status: response.status,
          message: "Invalid server response",
          details: { path, method: normalizedMethod },
          cause,
        });
      }
    }

    if (!response.ok) {
      if (queueEnabled && response.status >= 500) {
        return this.queueRequest({
          url,
          method: normalizedMethod,
          headers: requestHeaders,
          body,
          optimisticData,
          metadata,
        });
      }
      const normalized = normalizeError(response.status, payload);
      emit("toast", {
        type: "error",
        message: normalized.message,
      });
      throw new ApiError({
        status: normalized.status,
        message: normalized.message,
        details: normalized.details,
      });
    }

    if (useETag && normalizedMethod === "GET") {
      const etag = response.headers.get("etag");
      if (etag) {
        this.cache.set(cacheKey, {
          etag,
          data: payload,
          headers: Object.fromEntries(response.headers.entries()),
        });
      }
    }

    return {
      data: payload,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      fromCache: false,
      queued: false,
    };
  }

  get(path, options) {
    return this.request(path, { ...options, method: "GET" });
  }

  post(path, data, options = {}) {
    return this.request(path, { ...options, data, method: "POST" });
  }

  patch(path, data, options = {}) {
    return this.request(path, { ...options, data, method: "PATCH" });
  }

  put(path, data, options = {}) {
    return this.request(path, { ...options, data, method: "PUT" });
  }

  delete(path, options = {}) {
    return this.request(path, { ...options, method: "DELETE" });
  }

  clearCache() {
    this.cache.clear();
  }
}

export function normalizeError(status, payload) {
  if (payload && typeof payload === "object") {
    let message = payload.message || "Unexpected server error";
    const detail = payload.detail;
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => {
          if (!item) {
            return null;
          }
          if (typeof item === "string") {
            return item;
          }
          if (typeof item === "object" && typeof item.msg === "string") {
            return item.msg;
          }
          if (typeof item.detail === "string") {
            return item.detail;
          }
          return null;
        })
        .filter((value) => typeof value === "string" && value.trim().length > 0);
      if (messages.length > 0) {
        message = messages.join("\n");
      } else {
        message = "Invalid request.";
      }
    } else if (typeof detail === "string" && detail.trim().length > 0) {
      message = detail;
    }
    return {
      status,
      message,
      details: payload,
    };
  }

  return {
    status,
    message: typeof payload === "string" && payload.trim().length > 0 ? payload : "Unexpected server error",
    details: { raw: payload },
  };
}

export function createAPIClient(options) {
  return new APIClient(options);
}
