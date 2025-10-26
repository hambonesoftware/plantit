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

export class APIClient {
  constructor({ baseUrl = "/api/v1", fetchImpl = fetch, cache = new Map() } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetchImpl = fetchImpl;
    this.cache = cache;
  }

  buildUrl(path) {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${this.baseUrl}${cleanPath}`;
  }

  async request(path, { method = "GET", data, headers = {}, signal, useETag = true } = {}) {
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

    let response;
    try {
      response = await this.fetchImpl(url, {
        method: normalizedMethod,
        headers: requestHeaders,
        body,
        signal,
      });
    } catch (cause) {
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

  delete(path, options = {}) {
    return this.request(path, { ...options, method: "DELETE" });
  }

  clearCache() {
    this.cache.clear();
  }
}

export function normalizeError(status, payload) {
  if (payload && typeof payload === "object") {
    const message = payload.detail || payload.message || "Unexpected server error";
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
