import {
  fetchPlantDetail,
  updatePlant as updatePlantRequest,
  deletePlant as deletePlantRequest,
  uploadPlantPhoto,
  deletePhoto,
  onMutationComplete,
} from "../services/apiClient.js";

function messageFrom(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Request failed";
}

export class PlantDetailThinVM {
  constructor(plantId) {
    this.plantId = plantId;
    this.state = {
      loading: false,
      error: null,
      notice: null,
      data: { plant: null },
    };
    this.listeners = new Set();
    this.unsubscribe = onMutationComplete((detail) => {
      if (!detail || detail.source !== "offlineQueue") {
        return;
      }
      if (this.state.loading) {
        return;
      }
      this.state = { ...this.state, notice: null };
      this.load();
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  async load() {
    this.state = { ...this.state, loading: true, error: null };
    this.notify();
    try {
      const data = await fetchPlantDetail(this.plantId);
      this.state = {
        loading: false,
        error: null,
        notice: this.state.notice,
        data,
      };
    } catch (error) {
      this.state = {
        loading: false,
        error: messageFrom(error),
        notice: this.state.notice,
        data: { plant: null },
      };
    }
    this.notify();
  }

  async updatePlant(payload) {
    try {
      const result = await updatePlantRequest(this.plantId, payload);
      if (result?.queued) {
        this.state = {
          ...this.state,
          notice: "Plant update queued. We'll sync once you're online.",
        };
        this.notify();
        return result;
      }
      this.state = { ...this.state, notice: null };
      await this.load();
    } catch (error) {
      this.state = { ...this.state, error: messageFrom(error) };
      this.notify();
      throw error;
    }
  }

  async deletePlant() {
    const plant = this.state.data.plant;
    const villageId = plant?.village_id ?? null;
    try {
      const result = await deletePlantRequest(this.plantId);
      if (result?.queued) {
        this.state = {
          ...this.state,
          notice: "Deletion queued. We'll remove the plant when online.",
        };
        this.notify();
        return null;
      }
      this.state = { loading: false, error: null, notice: null, data: { plant: null } };
      this.notify();
      return villageId;
    } catch (error) {
      this.state = { ...this.state, error: messageFrom(error) };
      this.notify();
      throw error;
    }
  }

  async addPhoto(file) {
    try {
      const result = await uploadPlantPhoto(this.plantId, file);
      if (result?.queued) {
        this.state = {
          ...this.state,
          notice: "Photo uploads require a connection. Please retry online.",
        };
        this.notify();
        return result;
      }
      this.state = { ...this.state, notice: null };
      await this.load();
    } catch (error) {
      this.state = { ...this.state, error: messageFrom(error) };
      this.notify();
      throw error;
    }
  }

  async removePhoto(photoId) {
    try {
      const result = await deletePhoto(photoId);
      if (result?.queued) {
        this.state = {
          ...this.state,
          notice: "Photo deletion queued. We'll sync once online.",
        };
        this.notify();
        return result;
      }
      this.state = { ...this.state, notice: null };
      await this.load();
    } catch (error) {
      this.state = { ...this.state, error: messageFrom(error) };
      this.notify();
      throw error;
    }
  }
}
