import {
  fetchVillagesVM,
  createVillage,
  updateVillage as updateVillageRequest,
  deleteVillage as deleteVillageRequest,
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
      data: { villages: [] },
    };
    this.listeners = new Set();
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
      this.state = { loading: false, error: null, data };
    } catch (error) {
      this.state = { loading: false, error: error.message, data: { villages: [] } };
    }
    this.notify();
  }

  async createVillage(payload) {
    try {
      await createVillage(payload);
      await this.load();
    } catch (error) {
      this.state = { ...this.state, error: messageFrom(error) };
      this.notify();
      throw error;
    }
  }

  async updateVillage(villageId, payload) {
    try {
      await updateVillageRequest(villageId, payload);
      await this.load();
    } catch (error) {
      this.state = { ...this.state, error: messageFrom(error) };
      this.notify();
      throw error;
    }
  }

  async deleteVillage(villageId) {
    try {
      await deleteVillageRequest(villageId);
      await this.load();
    } catch (error) {
      this.state = { ...this.state, error: messageFrom(error) };
      this.notify();
      throw error;
    }
  }
}
