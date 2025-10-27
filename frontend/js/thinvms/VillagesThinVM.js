import { fetchVillagesVM, createVillage } from "../services/apiClient.js";

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
    await createVillage(payload);
    await this.load();
  }
}
