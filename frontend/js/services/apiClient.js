const API_BASE =
  (typeof window !== "undefined" && window.PLANTIT_API_BASE) ||
  "http://localhost:8000";

const etagCache = new Map();

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

export function clearCache() {
  etagCache.clear();
}

async function request(path, options = {}) {
  const method = (options.method ?? "GET").toUpperCase();
  const cacheKey = buildCacheKey(method, path);
  const hasBody = Object.prototype.hasOwnProperty.call(options, "body");
  const isFormData =
    hasBody && typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = normalizeHeaders(method, path, options.headers, hasBody, isFormData);
  const fetchOptions = {
    ...options,
    method,
    headers,
  };

  const response = await fetch(`${API_BASE}${path}`, fetchOptions);

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

  if (response.status === 204 || method === "HEAD") {
    etagCache.delete(cacheKey);
    return null;
  }

  const data = await response.json();
  const etag = response.headers.get("ETag");
  if (method === "GET" && etag) {
    etagCache.set(cacheKey, { etag, data });
  }
  return data;
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
  return request("/api/v1/villages/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateVillage(villageId, payload) {
  return request(`/api/v1/villages/${villageId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteVillage(villageId) {
  return request(`/api/v1/villages/${villageId}`, {
    method: "DELETE",
  });
}

export async function createPlant(payload) {
  return request("/api/v1/plants/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePlant(plantId, payload) {
  return request(`/api/v1/plants/${plantId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deletePlant(plantId) {
  return request(`/api/v1/plants/${plantId}`, {
    method: "DELETE",
  });
}

export async function uploadPlantPhoto(plantId, file) {
  const formData = new FormData();
  formData.set("file", file);
  return request(`/api/v1/plants/${plantId}/photos`, {
    method: "POST",
    body: formData,
  });
}

export async function deletePhoto(photoId) {
  return request(`/api/v1/photos/${photoId}`, {
    method: "DELETE",
  });
}
