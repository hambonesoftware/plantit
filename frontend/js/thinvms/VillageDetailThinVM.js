import {
  fetchVillageDetail,
  createPlant,
  updateVillage as updateVillageRequest,
  deleteVillage as deleteVillageRequest,
  updatePlant as updatePlantRequest,
  deletePlant as deletePlantRequest,
  onMutationComplete,
} from "../services/apiClient.js";

function messageFrom(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Request failed";
}

export class VillageDetailThinVM {
  constructor(villageId) {
    this.villageId = villageId;
    this.state = {
      loading: false,
      error: null,
      notice: null,
      data: { village: null, plants: [] },
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
      const data = await fetchVillageDetail(this.villageId);
      this.state = {
        loading: false,
        error: null,
        notice: this.state.notice,
        data,
      };
    } catch (error) {
      this.state = {
        loading: false,
        error: error.message,
        notice: this.state.notice,
        data: { village: null, plants: [] },
      };
    }
    this.notify();
  }

  async createPlant(payload) {
    try {
      const result = await createPlant({ ...payload, village_id: this.villageId });
      if (result?.queued) {
        this.state = {
          ...this.state,
          notice: "Plant creation queued. We'll sync when online.",
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

  async updateVillage(payload) {
    try {
      const result = await updateVillageRequest(this.villageId, payload);
      if (result?.queued) {
        this.state = {
          ...this.state,
          notice: "Village update queued. Changes will apply once online.",
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

  async deleteVillage() {
    try {
      const result = await deleteVillageRequest(this.villageId);
      if (result?.queued) {
        this.state = {
          ...this.state,
          notice: "Deletion queued. We'll remove the village when you're online.",
        };
        this.notify();
        return result;
      }
      this.state = {
        loading: false,
        error: null,
        notice: null,
        data: { village: null, plants: [] },
      };
      this.notify();
    } catch (error) {
      this.state = { ...this.state, error: messageFrom(error) };
      this.notify();
      throw error;
    }
  }

  async updatePlant(plantId, payload) {
    try {
      const result = await updatePlantRequest(plantId, payload);
      if (result?.queued) {
        this.state = {
          ...this.state,
          notice: "Plant update queued. Changes will apply once online.",
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

  async deletePlant(plantId) {
    try {
      const result = await deletePlantRequest(plantId);
      if (result?.queued) {
        this.state = {
          ...this.state,
          notice: "Plant deletion queued. We'll sync once online.",
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
