const API_BASE = window.PLANTIT_API_BASE || "http://localhost:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: { code: "NETWORK_ERROR", message: "Unknown error", field: null }
    }));
    throw new Error(error.error?.message || "Request failed");
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
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

export async function createPlant(payload) {
  return request("/api/v1/plants/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
