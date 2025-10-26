import { emit, subscribe } from "../state.js";

function clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function normalizeDetail(detail) {
  if (!detail) {
    return null;
  }
  const safe = clone(detail);
  safe.tasks = Array.isArray(safe.tasks) ? safe.tasks : [];
  safe.logs = Array.isArray(safe.logs) ? safe.logs : [];
  safe.photos = Array.isArray(safe.photos) ? safe.photos : [];
  return safe;
}

export class PlantVM {
  constructor({ apiClient, plantId }) {
    this.apiClient = apiClient;
    this.plantId = Number(plantId);
    this.listeners = new Set();
    this.state = {
      loading: false,
      error: null,
      activeTab: "overview",
      detail: null,
    };
    this.pending = {
      overview: false,
      care: false,
      log: false,
      schedule: false,
      uploads: new Set(),
      deletes: new Set(),
      complete: new Set(),
    };
    this.optimisticPhotos = new Map();
    this.queueReloadHandle = null;
    this.queueRelease = subscribe("requestQueue:success", (entry) => {
      if (!entry || typeof entry.path !== "string") {
        return;
      }
      const matchCurrentPlant = entry.path.includes(`/plants/${this.plantId}`);
      const affectsTasks = entry.path.includes("/tasks/") || entry.path.includes(`/tasks`);
      const affectsPhotos = entry.path.includes(`/photos`);
      if (matchCurrentPlant || affectsTasks || affectsPhotos) {
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
      activeTab: this.state.activeTab,
      detail: normalizeDetail(this.state.detail),
      pending: {
        overview: this.pending.overview,
        care: this.pending.care,
        log: this.pending.log,
        schedule: this.pending.schedule,
        uploads: Array.from(this.pending.uploads),
        deletes: Array.from(this.pending.deletes),
        complete: Array.from(this.pending.complete),
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
      this.load().catch((error) => console.error("Failed to refresh plant after sync", error));
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

  buildOptimisticDetail(updates) {
    if (!this.state.detail) {
      return null;
    }
    const current = normalizeDetail(this.state.detail);
    const next = clone(current);
    if (updates && typeof updates === "object") {
      Object.entries(updates).forEach(([key, value]) => {
        if (value && typeof value === "object" && key in next && typeof next[key] === "object") {
          next[key] = clone({ ...next[key], ...value });
        } else {
          next[key] = clone(value);
        }
      });
    }
    next.updated_at = new Date().toISOString();
    return next;
  }

  async load() {
    this.state.loading = true;
    this.notify();
    try {
      const { data } = await this.apiClient.get(`/plants/${this.plantId}`);
      this.state.detail = normalizeDetail(data);
      this.state.error = null;
      return data;
    } catch (error) {
      const message = error?.message || "Unable to load plant.";
      this.state.error = message;
      emit("toast", { type: "error", message });
      throw error;
    } finally {
      this.state.loading = false;
      this.notify();
    }
  }

  setTab(tab) {
    if (!tab || this.state.activeTab === tab) {
      return;
    }
    this.state.activeTab = tab;
    this.notify();
  }

  async saveOverview(updates) {
    if (!updates || typeof updates !== "object") {
      return;
    }
    this.pending.overview = true;
    this.notify();
    try {
      const response = await this.apiClient.patch(`/plants/${this.plantId}`, updates, {
        optimisticData: () => this.buildOptimisticDetail(updates),
        metadata: { action: "plant:update", plantId: this.plantId },
      });
      if (response.data) {
        this.state.detail = normalizeDetail(response.data);
      }
      if (response.queued) {
        emit("toast", { type: "info", message: "Update queued and will sync when online." });
      } else {
        emit("toast", { type: "success", message: "Plant updated." });
      }
      return response.data;
    } catch (error) {
      emit("toast", { type: "error", message: "Unable to update plant." });
      throw error;
    } finally {
      this.pending.overview = false;
      this.notify();
    }
  }

  async saveCareProfile(profile) {
    if (!profile || typeof profile !== "object") {
      return;
    }
    this.pending.care = true;
    this.notify();
    try {
      const response = await this.apiClient.put(`/plants/${this.plantId}/care_profile`, profile, {
        optimisticData: () => this.buildOptimisticDetail({ care_profile: profile }),
        metadata: { action: "plant:care", plantId: this.plantId },
      });
      if (response.data) {
        this.state.detail = normalizeDetail(response.data);
      }
      if (response.queued) {
        emit("toast", { type: "info", message: "Care profile queued for sync." });
      } else {
        emit("toast", { type: "success", message: "Care profile saved." });
      }
      return response.data;
    } catch (error) {
      emit("toast", { type: "error", message: "Unable to save care profile." });
      throw error;
    } finally {
      this.pending.care = false;
      this.notify();
    }
  }

  async addLog(entry) {
    if (!entry || typeof entry !== "object") {
      return;
    }
    this.pending.log = true;
    this.notify();
    let optimisticLog = null;
    try {
      const response = await this.apiClient.post(`/plants/${this.plantId}/logs`, entry, {
        optimisticData: () => {
          const timestamp = new Date().toISOString();
          optimisticLog = {
            id: `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            plant_id: this.plantId,
            ...clone(entry),
            performed_at: entry.performed_at ?? timestamp,
            created_at: timestamp,
            queued: true,
          };
          return optimisticLog;
        },
        metadata: { action: "plant:log", plantId: this.plantId },
      });
      const record = response.data ?? optimisticLog;
      if (record && this.state.detail) {
        this.state.detail.logs = [record, ...this.state.detail.logs];
        if (this.state.detail.metrics) {
          this.state.detail.metrics.last_logged_at = record.performed_at;
        }
      }
      if (response.queued) {
        emit("toast", { type: "info", message: "Log queued for sync." });
      } else {
        emit("toast", { type: "success", message: "Log added." });
      }
      return record;
    } catch (error) {
      emit("toast", { type: "error", message: "Unable to add log." });
      throw error;
    } finally {
      this.pending.log = false;
      this.notify();
    }
  }

  async scheduleTask(taskPayload) {
    if (!taskPayload || typeof taskPayload !== "object") {
      return;
    }
    this.pending.schedule = true;
    this.notify();
    let optimisticTask = null;
    try {
      const response = await this.apiClient.post(`/plants/${this.plantId}/tasks`, taskPayload, {
        optimisticData: () => {
          const timestamp = new Date().toISOString();
          optimisticTask = {
            id: `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            plant_id: this.plantId,
            plant: this.state.detail
              ? { id: this.state.detail.id, name: this.state.detail.name }
              : { id: this.plantId, name: this.state.detail?.name ?? "" },
            title: taskPayload.title ?? "Task",
            description: taskPayload.description ?? null,
            due_date: taskPayload.due_date ?? null,
            state: "pending",
            category: taskPayload.category ?? "custom",
            created_at: timestamp,
            updated_at: timestamp,
            queued: true,
          };
          return optimisticTask;
        },
        metadata: { action: "plant:task:create", plantId: this.plantId },
      });
      const task = response.data ?? optimisticTask;
      if (task && this.state.detail) {
        this.state.detail.tasks = [task, ...this.state.detail.tasks];
      }
      if (response.queued) {
        emit("toast", { type: "info", message: "Task scheduled offline and will sync soon." });
      } else {
        emit("toast", { type: "success", message: "Task scheduled." });
      }
      return task;
    } catch (error) {
      emit("toast", { type: "error", message: "Unable to schedule task." });
      throw error;
    } finally {
      this.pending.schedule = false;
      this.notify();
    }
  }

  async completeTask(taskId) {
    if (!taskId) {
      return;
    }
    this.pending.complete.add(taskId);
    this.notify();
    try {
      const response = await this.apiClient.patch(`/tasks/${taskId}`, { state: "completed" }, {
        metadata: { action: "task:complete", plantId: this.plantId, taskId },
      });
      if (this.state.detail) {
        this.state.detail.tasks = this.state.detail.tasks.filter((task) => task.id !== taskId);
        if (this.state.detail.metrics) {
          this.state.detail.metrics.due_tasks = Math.max(0, this.state.detail.metrics.due_tasks - 1);
        }
      }
      if (response?.queued) {
        emit("toast", { type: "info", message: "Task completion queued for sync." });
      } else {
        emit("toast", { type: "success", message: "Task completed." });
      }
    } catch (error) {
      emit("toast", { type: "error", message: "Unable to complete task." });
      throw error;
    } finally {
      this.pending.complete.delete(taskId);
      this.notify();
    }
  }

  async uploadPhoto(file, { caption } = {}) {
    if (!file) {
      emit("toast", { type: "warning", message: "Choose a photo to upload." });
      return;
    }
    const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const placeholder = {
      id: tempId,
      plant_id: this.plantId,
      filename: file.name,
      thumbnail_path: "",
      file_path: "",
      caption: caption ?? null,
      uploading: true,
    };
    if (this.state.detail) {
      this.state.detail.photos = [placeholder, ...this.state.detail.photos];
      if (!this.state.detail.hero_photo) {
        this.state.detail.hero_photo = placeholder;
      }
    }
    this.pending.uploads.add(tempId);
    this.optimisticPhotos.set(tempId, placeholder);
    this.notify();
    const form = new FormData();
    form.append("file", file);
    if (caption) {
      form.append("caption", caption);
    }
    try {
      const response = await this.apiClient.post(`/plants/${this.plantId}/photos`, form, {
        optimisticData: () => placeholder,
        metadata: { action: "plant:photo:add", plantId: this.plantId, tempId },
      });
      const photo = response.data ?? placeholder;
      if (this.state.detail) {
        this.state.detail.photos = this.state.detail.photos.map((item) => (item.id === tempId ? photo : item));
        this.state.detail.hero_photo = this.state.detail.hero_photo?.id === tempId ? photo : this.state.detail.hero_photo;
      }
      if (response.queued) {
        photo.uploading = false;
        photo.queued = true;
        emit("toast", { type: "info", message: "Photo upload queued for sync." });
      } else {
        emit("toast", { type: "success", message: "Photo uploaded." });
      }
      return photo;
    } catch (error) {
      if (this.state.detail) {
        this.state.detail.photos = this.state.detail.photos.filter((photo) => photo.id !== tempId);
      }
      emit("toast", { type: "error", message: "Unable to upload photo." });
      throw error;
    } finally {
      this.optimisticPhotos.delete(tempId);
      this.pending.uploads.delete(tempId);
      this.notify();
    }
  }

  async deletePhoto(photoId) {
    if (!photoId) {
      return;
    }
    this.pending.deletes.add(photoId);
    this.notify();
    try {
      const response = await this.apiClient.delete(`/photos/${photoId}`, {
        metadata: { action: "plant:photo:delete", plantId: this.plantId, photoId },
      });
      if (this.state.detail) {
        this.state.detail.photos = this.state.detail.photos.filter((photo) => photo.id !== photoId);
        if (this.state.detail.hero_photo?.id === photoId) {
          this.state.detail.hero_photo = this.state.detail.photos[0] ?? null;
        }
      }
      if (response?.queued) {
        emit("toast", { type: "info", message: "Photo deletion queued." });
      } else {
        emit("toast", { type: "success", message: "Photo deleted." });
      }
    } catch (error) {
      emit("toast", { type: "error", message: "Unable to delete photo." });
      throw error;
    } finally {
      this.pending.deletes.delete(photoId);
      this.notify();
    }
  }
}

export default { PlantVM };
