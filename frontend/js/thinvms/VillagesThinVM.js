import {
  fetchVillagesVM,
  createVillage,
  updateVillage as updateVillageRequest,
  deleteVillage as deleteVillageRequest,
  onMutationComplete,
} from "../services/apiClient.js";

function messageFrom(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Request failed";
}

export class VillagesThinVM {
  constructor() {
    this.state = {
      loading: false,
      error: null,
      notice: null,
      data: { villages: [] },
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
      const data = await fetchVillagesVM();
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
        data: { villages: [] },
      };
    }
    this.notify();
  }

  async createVillage(payload) {
    try {
      const result = await createVillage(payload);
      if (result?.queued) {
        this.state = {
          ...this.state,
          error: null,
          notice: "Village will sync when you're back online.",
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

  async updateVillage(villageId, payload) {
    try {
      const result = await updateVillageRequest(villageId, payload);
      if (result?.queued) {
        this.state = {
          ...this.state,
          notice: "Update queued. Changes will sync when online.",
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

  async deleteVillage(villageId) {
    try {
      const result = await deleteVillageRequest(villageId);
      if (result?.queued) {
        this.state = {
          ...this.state,
          notice: "Deletion queued. We'll remove it once you're online.",
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
