import { fetchVillageDetail, createPlant } from "../services/apiClient.js";

export class VillageDetailThinVM {
  constructor(villageId) {
    this.villageId = villageId;
    this.state = {
      loading: false,
      error: null,
      data: { village: null, plants: [] },
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
      const data = await fetchVillageDetail(this.villageId);
      this.state = { loading: false, error: null, data };
    } catch (error) {
      this.state = {
        loading: false,
        error: error.message,
        data: { village: null, plants: [] },
      };
    }
    this.notify();
  }

  async createPlant(payload) {
    await createPlant({ ...payload, village_id: this.villageId });
    await this.load();
  }
}
