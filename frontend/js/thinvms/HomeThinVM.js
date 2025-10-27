import { fetchHomeVM } from "../services/apiClient.js";

export class HomeThinVM {
  constructor() {
    this.state = {
      loading: false,
      error: null,
      data: null,
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
      const data = await fetchHomeVM();
      this.state = { loading: false, error: null, data };
    } catch (error) {
      this.state = { loading: false, error: error.message, data: null };
    }
    this.notify();
  }
}
