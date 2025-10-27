import {
  fetchPlantDetail,
  updatePlant as updatePlantRequest,
  deletePlant as deletePlantRequest,
  uploadPlantPhoto,
  deletePhoto,
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
      data: { plant: null },
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
      const data = await fetchPlantDetail(this.plantId);
      this.state = { loading: false, error: null, data };
    } catch (error) {
      this.state = {
        loading: false,
        error: messageFrom(error),
        data: { plant: null },
      };
    }
    this.notify();
  }

  async updatePlant(payload) {
    try {
      await updatePlantRequest(this.plantId, payload);
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
      await deletePlantRequest(this.plantId);
      this.state = { loading: false, error: null, data: { plant: null } };
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
      await uploadPlantPhoto(this.plantId, file);
      await this.load();
    } catch (error) {
      this.state = { ...this.state, error: messageFrom(error) };
      this.notify();
      throw error;
    }
  }

  async removePhoto(photoId) {
    try {
      await deletePhoto(photoId);
      await this.load();
    } catch (error) {
      this.state = { ...this.state, error: messageFrom(error) };
      this.notify();
      throw error;
    }
  }
}
