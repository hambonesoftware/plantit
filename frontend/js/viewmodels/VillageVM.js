import { emit, subscribe } from "../state.js";

function clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function normalizePlant(raw) {
  const tags = Array.isArray(raw.tags) ? raw.tags : [];
  let dueState = raw.due_state || raw.status || "ok";
  if (!raw.due_state && !raw.status) {
    const overdue = raw.overdue_tasks ?? raw.overdue ?? 0;
    const due = raw.due_today ?? raw.due ?? 0;
    if (overdue > 0) {
      dueState = "overdue";
    } else if (due > 0) {
      dueState = "due";
    } else {
      dueState = "ok";
    }
  }
  const lastWateredAt = raw.last_watered_at || null;
  const coverPhoto = raw.cover_photo || raw.photo_url || raw.thumbnail || null;
  return {
    id: raw.id,
    name: raw.name,
    species: raw.species || raw.variety || "",
    tags,
    due_state: dueState,
    last_watered_at: lastWateredAt,
    cover_photo: coverPhoto,
    village: raw.village || null,
  };
}

export class VillageVM {
  constructor({ apiClient, villageId }) {
    this.apiClient = apiClient;
    this.villageId = Number(villageId);
    this.listeners = new Set();
    this.state = {
      loading: false,
      error: null,
      village: null,
      plants: [],
      filteredPlants: [],
      filters: {
        tag: "all",
        due: "all",
      },
      viewMode: "grid",
      tags: [],
      availableVillages: [],
      metrics: {
        total: 0,
        shown: 0,
      },
    };
    this.pending = {
      watering: new Set(),
      photos: new Set(),
      move: new Set(),
    };
    this.queueReloadHandle = null;
    this.queueRelease = subscribe("requestQueue:success", (entry) => {
      if (!entry || typeof entry.path !== "string") {
        return;
      }
      if (entry.path.includes("/plants") || entry.path.includes("/photos") || entry.path.includes("/logs")) {
        this.scheduleReload();
      }
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  snapshot() {
    return {
      loading: this.state.loading,
      error: this.state.error,
      village: this.state.village ? { ...this.state.village } : null,
      plants: this.state.plants.map((plant) => ({ ...plant })),
      filteredPlants: this.state.filteredPlants.map((plant) => ({ ...plant })),
      filters: { ...this.state.filters },
      viewMode: this.state.viewMode,
      tags: [...this.state.tags],
      availableVillages: this.state.availableVillages.map((village) => ({ ...village })),
      metrics: { ...this.state.metrics },
      pending: {
        watering: Array.from(this.pending.watering),
        photos: Array.from(this.pending.photos),
        move: Array.from(this.pending.move),
      },
    };
  }

  notify() {
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(clone(snapshot)));
  }

  scheduleReload() {
    if (this.queueReloadHandle) {
      return;
    }
    this.queueReloadHandle = setTimeout(() => {
      this.queueReloadHandle = null;
      this.load({ silent: true }).catch((error) => console.error("Failed to refresh village after sync", error));
    }, 300);
  }

  destroy() {
    if (this.queueRelease) {
      this.queueRelease();
      this.queueRelease = null;
    }
    if (this.queueReloadHandle) {
      clearTimeout(this.queueReloadHandle);
      this.queueReloadHandle = null;
    }
  }

  async load({ silent = false } = {}) {
    if (!silent) {
      this.state.loading = true;
      this.notify();
    }
    try {
      const [plantsResponse, dashboardResponse] = await Promise.all([
        this.apiClient.get(`/plants?village_id=${this.villageId}`),
        this.apiClient.get("/dashboard"),
      ]);
      const rawPlants = Array.isArray(plantsResponse.data?.items)
        ? plantsResponse.data.items
        : Array.isArray(plantsResponse.data)
          ? plantsResponse.data
          : plantsResponse.data?.plants ?? [];
      const normalized = rawPlants.map((plant) => normalizePlant(plant));
      this.state.plants = normalized;
      this.state.tags = this.collectTags(normalized);
      this.state.metrics.total = normalized.length;
      const villages = dashboardResponse.data?.villages ?? [];
      this.state.availableVillages = villages.filter((village) => village.id !== this.villageId);
      this.state.village = villages.find((village) => village.id === this.villageId) || this.state.village;
      this.state.error = null;
      this.applyFilters();
    } catch (error) {
      const message = error?.message || "Unable to load village.";
      this.state.error = message;
      emit("toast", { type: "error", message });
      throw error;
    } finally {
      this.state.loading = false;
      this.notify();
    }
  }

  collectTags(plants) {
    const tagSet = new Set();
    plants.forEach((plant) => {
      plant.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }

  applyFilters() {
    const { tag, due } = this.state.filters;
    const filtered = this.state.plants.filter((plant) => {
      const matchesTag = tag === "all" || plant.tags.includes(tag);
      const matchesDue = due === "all" || plant.due_state === due;
      return matchesTag && matchesDue;
    });
    this.state.filteredPlants = filtered;
    this.state.metrics.shown = filtered.length;
  }

  setFilter(filter, value) {
    if (!Object.hasOwn(this.state.filters, filter)) {
      return;
    }
    if (this.state.filters[filter] === value) {
      return;
    }
    this.state.filters = {
      ...this.state.filters,
      [filter]: value,
    };
    this.applyFilters();
    this.notify();
  }

  setViewMode(mode) {
    if (mode !== "grid" && mode !== "list") {
      return;
    }
    if (this.state.viewMode === mode) {
      return;
    }
    this.state.viewMode = mode;
    this.notify();
  }

  async logWater(plantId) {
    const plant = this.state.plants.find((item) => item.id === plantId);
    if (!plant) {
      return;
    }
    this.pending.watering.add(plantId);
    const previousLastWatered = plant.last_watered_at;
    plant.last_watered_at = new Date().toISOString();
    this.notify();
    try {
      const response = await this.apiClient.post(
        `/plants/${plantId}/logs`,
        {
          action: "watered",
        },
        { metadata: { action: "village:water", plantId: Number(plantId) } },
      );
      if (response?.queued) {
        emit("toast", { type: "info", message: `Watering for ${plant.name} queued.` });
      } else {
        emit("toast", { type: "success", message: `Logged watering for ${plant.name}` });
        await this.load({ silent: true });
      }
    } catch (error) {
      plant.last_watered_at = previousLastWatered;
      emit("toast", { type: "error", message: "Unable to log watering." });
      throw error;
    } finally {
      this.pending.watering.delete(plantId);
      this.notify();
    }
  }

  async addPhoto(plantId, file) {
    if (!file) {
      emit("toast", { type: "warning", message: "Please choose a photo to upload." });
      return;
    }
    this.pending.photos.add(plantId);
    this.notify();
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await this.apiClient.post(`/plants/${plantId}/photos`, formData, {
        metadata: { action: "village:photo:add", plantId: Number(plantId) },
      });
      if (response?.queued) {
        emit("toast", { type: "info", message: "Photo upload queued." });
      } else {
        emit("toast", { type: "success", message: "Photo uploaded." });
        await this.load({ silent: true });
      }
    } catch (error) {
      emit("toast", { type: "error", message: "Unable to upload photo." });
      throw error;
    } finally {
      this.pending.photos.delete(plantId);
      this.notify();
    }
  }

  async movePlant(plantId, destinationVillageId) {
    const plant = this.state.plants.find((item) => item.id === plantId);
    if (!plant) {
      return;
    }
    const originalPlants = [...this.state.plants];
    this.pending.move.add(plantId);
    this.state.plants = this.state.plants.filter((item) => item.id !== plantId);
    this.applyFilters();
    this.notify();
    try {
      const response = await this.apiClient.post(
        `/plants/${plantId}:move`,
        {
          destination_village_id: Number(destinationVillageId),
        },
        { metadata: { action: "village:move", plantId: Number(plantId), destination: Number(destinationVillageId) } },
      );
      if (response?.queued) {
        emit("toast", { type: "info", message: `${plant.name} move queued.` });
      } else {
        emit("toast", { type: "success", message: `Moved ${plant.name}` });
        await this.load({ silent: true });
      }
    } catch (error) {
      this.state.plants = originalPlants;
      this.applyFilters();
      emit("toast", { type: "error", message: "Unable to move plant." });
      this.notify();
      throw error;
    } finally {
      this.pending.move.delete(plantId);
      this.notify();
    }
  }
}
