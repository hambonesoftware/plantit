import { offlineQueue } from "./offlineQueue.js";

function resolveApiBase() {
  if (typeof window === "undefined") {
    return "http://localhost:8000";
  }

  if (window.PLANTIT_API_BASE) {
    return window.PLANTIT_API_BASE;
  }

  const { location } = window;
  const origin = location?.origin;
  const hostname = location?.hostname;
  const port = location?.port;

  if (hostname && (hostname === "localhost" || hostname === "127.0.0.1")) {
    if (port && port !== "" && port !== "8000") {
      return "http://localhost:8000";
    }
  }

  if (origin && origin !== "null") {
    return origin;
  }

  return "http://localhost:8000";
}

const API_BASE = resolveApiBase();

const etagCache = new Map();
const mutationListeners = new Set();

function buildCacheKey(method, path) {
  return `${method.toUpperCase()}:${path}`;
}

function normalizeHeaders(method, path, headers, hasBody, isFormData) {
  const normalized = new Headers(headers ?? {});
  if (!normalized.has("Accept")) {
    normalized.set("Accept", "application/json");
  }
  if (hasBody && !isFormData && !normalized.has("Content-Type")) {
    normalized.set("Content-Type", "application/json");
  }
  if (method === "GET") {
    const cached = etagCache.get(buildCacheKey(method, path));
    if (cached?.etag) {
      normalized.set("If-None-Match", cached.etag);
    }
  }
  return normalized;
}

function normalizeErrorPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "Request failed";
  }
  if (payload.error && typeof payload.error.message === "string") {
    return payload.error.message;
  }
  return "Request failed";
}

function notifyMutationComplete(detail) {
  mutationListeners.forEach((listener) => {
    try {
      listener(detail);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("mutation listener failed", error);
    }
  });
}

offlineQueue.addEventListener("mutationapplied", (event) => {
  notifyMutationComplete({
    source: "offlineQueue",
    entry: event.detail.entry,
    payload: event.detail.payload,
  });
});

offlineQueue.addEventListener("mutationfailed", (event) => {
  notifyMutationComplete({
    source: "offlineQueue",
    entry: event.detail.entry,
    payload: event.detail.payload,
    failed: true,
  });
});

export function onMutationComplete(listener) {
  mutationListeners.add(listener);
  return () => mutationListeners.delete(listener);
}

export function clearCache() {
  etagCache.clear();
}

async function performGet(path, options) {
  const method = "GET";
  const cacheKey = buildCacheKey(method, path);
  const headers = normalizeHeaders(method, path, options.headers, false, false);
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    method,
    headers,
  });

  if (response.status === 304) {
    const cached = etagCache.get(cacheKey);
    if (cached) {
      return cached.data;
    }
    return null;
  }

  if (!response.ok) {
    let errorPayload = null;
    try {
      errorPayload = await response.json();
    } catch (error) {
      errorPayload = { error: { message: "Network error" } };
    }
    throw new Error(normalizeErrorPayload(errorPayload));
  }

  if (response.status === 204) {
    etagCache.delete(cacheKey);
    return null;
  }

  const data = await response.json();
  const etag = response.headers.get("ETag");
  if (etag) {
    etagCache.set(cacheKey, { etag, data });
  }
  return data;
}

function shouldQueueMutation(method, body) {
  if (method === "GET" || method === "HEAD") {
    return false;
  }
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    return false;
  }
  return true;
}

function isNetworkError(error) {
  if (!error) {
    return false;
  }

  if (error.name === "TypeError") {
    // Fetch throws a TypeError on network failures (e.g., offline, DNS).
    return true;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }

  if (typeof error.message === "string") {
    return /network error/i.test(error.message) || /failed to fetch/i.test(error.message);
  }

  return false;
}

async function performMutation(path, options, { resources = [], metadata = {} } = {}) {
  const method = (options.method ?? "POST").toUpperCase();
  const hasBody = Object.prototype.hasOwnProperty.call(options, "body");
  const isFormData =
    hasBody && typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = normalizeHeaders(method, path, options.headers, hasBody, isFormData);
  const url = `${API_BASE}${path}`;

  const attempt = async () => {
    const response = await fetch(url, { ...options, method, headers });
    if (!response.ok) {
      let errorPayload = null;
      try {
        errorPayload = await response.json();
      } catch (error) {
        errorPayload = { error: { message: response.statusText } };
      }
      throw new Error(normalizeErrorPayload(errorPayload));
    }

    let data = null;
    if (response.status !== 204 && method !== "HEAD") {
      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("application/json")) {
        data = await response.json();
      }
    }
    notifyMutationComplete({ source: "network", resources, metadata, data });
    return { queued: false, data };
  };

  if (!offlineQueue.isOnline() && shouldQueueMutation(method, options.body)) {
    const { id, completion } = await offlineQueue.enqueue({
      url,
      method,
      headers,
      body: hasBody ? options.body : null,
      resources,
      metadata,
    });
    completion
      .then((data) => {
        notifyMutationComplete({
          source: "offlineQueue",
          resources,
          metadata,
          data,
          queueId: id,
        });
      })
      .catch(() => {
        // failure handled via mutationfailed listener
      });
    return { queued: true, queueId: id };
  }

  try {
    return await attempt();
  } catch (error) {
    if (isNetworkError(error) && shouldQueueMutation(method, options.body)) {
      const { id, completion } = await offlineQueue.enqueue({
        url,
        method,
        headers,
        body: hasBody ? options.body : null,
        resources,
        metadata,
      });
      completion
        .then((data) => {
          notifyMutationComplete({
            source: "offlineQueue",
            resources,
            metadata,
            data,
            queueId: id,
          });
        })
        .catch(() => {});
      return { queued: true, queueId: id };
    }
    throw error;
  }
}

async function request(path, options = {}) {
  const method = (options.method ?? "GET").toUpperCase();
  if (method === "GET") {
    return performGet(path, options);
  }
  return performMutation(path, options);
}

export async function fetchHomeVM() {
  return request("/api/v1/vm/home");
}

export async function fetchVillagesVM() {
  return request("/api/v1/vm/villages");
}

export async function fetchVillageDetail(id) {
  return request(`/api/v1/vm/village/${id}`);
}

export async function fetchPlantDetail(id) {
  return request(`/api/v1/vm/plant/${id}`);
}

export async function createVillage(payload) {
  return performMutation(
    "/api/v1/villages/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { resources: ["villages", "home"] },
  );
}

export async function updateVillage(villageId, payload) {
  return performMutation(
    `/api/v1/villages/${villageId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    { resources: ["villages", "home", `village:${villageId}`] },
  );
}

export async function deleteVillage(villageId) {
  return performMutation(
    `/api/v1/villages/${villageId}`,
    {
      method: "DELETE",
    },
    { resources: ["villages", "home", `village:${villageId}`] },
  );
}

export async function createPlant(payload) {
  const villageId = payload.village_id;
  return performMutation(
    "/api/v1/plants/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { resources: ["villages", "home", `village:${villageId}`], metadata: { villageId } },
  );
}

export async function updatePlant(plantId, payload) {
  return performMutation(
    `/api/v1/plants/${plantId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    { resources: ["villages", "home", `village:${payload.village_id ?? ""}`, `plant:${plantId}`] },
  );
}

export async function deletePlant(plantId) {
  return performMutation(
    `/api/v1/plants/${plantId}`,
    {
      method: "DELETE",
    },
    { resources: ["villages", "home", `plant:${plantId}`] },
  );
}

export async function uploadPlantPhoto(plantId, file) {
  const formData = new FormData();
  formData.set("file", file);
  try {
    return await performMutation(
      `/api/v1/plants/${plantId}/photos`,
      {
        method: "POST",
        body: formData,
      },
      { resources: ["villages", "home", `plant:${plantId}`] },
    );
  } catch (error) {
    if (!offlineQueue.isOnline()) {
      throw new Error("Photo uploads require an online connection.");
    }
    throw error;
  }
}

export async function deletePhoto(photoId) {
  return performMutation(
    `/api/v1/photos/${photoId}`,
    {
      method: "DELETE",
    },
    { resources: ["villages", "home"] },
  );
}

export { resolveApiBase };
