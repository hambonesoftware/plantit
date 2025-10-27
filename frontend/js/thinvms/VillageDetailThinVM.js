import {
  fetchVillageDetail,
  createPlant,
  updateVillage as updateVillageRequest,
  deleteVillage as deleteVillageRequest,
  updatePlant as updatePlantRequest,
  deletePlant as deletePlantRequest,
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
    try {
      await createPlant({ ...payload, village_id: this.villageId });
      await this.load();
    } catch (error) {
      this.state = { ...this.state, error: messageFrom(error) };
      this.notify();
      throw error;
    }
  }

  async updateVillage(payload) {
    try {
      await updateVillageRequest(this.villageId, payload);
      await this.load();
    } catch (error) {
      this.state = { ...this.state, error: messageFrom(error) };
      this.notify();
      throw error;
    }
  }

  async deleteVillage() {
    try {
      await deleteVillageRequest(this.villageId);
      this.state = {
        loading: false,
        error: null,
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
      await updatePlantRequest(plantId, payload);
      await this.load();
    } catch (error) {
      this.state = { ...this.state, error: messageFrom(error) };
      this.notify();
      throw error;
    }
  }

  async deletePlant(plantId) {
    try {
      await deletePlantRequest(plantId);
      await this.load();
    } catch (error) {
      this.state = { ...this.state, error: messageFrom(error) };
      this.notify();
      throw error;
    }
  }
}
