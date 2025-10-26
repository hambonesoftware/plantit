import { emit } from "../state.js";

function clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

export class HomeVM {
  constructor({ apiClient }) {
    this.apiClient = apiClient;
    this.listeners = new Set();
    this.state = {
      villages: [],
      today: [],
      calendar: [],
      metrics: {
        totalVillages: 0,
        totalPlants: 0,
        dueToday: 0,
        overdue: 0,
      },
      loading: false,
      error: null,
      lastLoadedAt: null,
    };
    this.pendingQuickAdd = new Set();
    this.pendingTasks = new Set();
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
      villages: this.state.villages.map((village) => ({ ...village })),
      today: this.state.today.map((task) => ({
        ...task,
        plant: { ...task.plant },
        village: { ...task.village },
      })),
      calendar: this.state.calendar.map((entry) => ({ ...entry })),
      metrics: { ...this.state.metrics },
      loading: this.state.loading,
      error: this.state.error,
      lastLoadedAt: this.state.lastLoadedAt,
      pending: {
        quickAdd: Array.from(this.pendingQuickAdd),
        tasks: Array.from(this.pendingTasks),
      },
    };
  }

  notify() {
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(clone(snapshot)));
  }

  recalculateMetrics() {
    const totalVillages = this.state.villages.length;
    const totalPlants = this.state.villages.reduce((sum, village) => sum + village.plant_count, 0);
    const dueToday = this.state.villages.reduce((sum, village) => sum + village.due_today, 0);
    const overdue = this.state.villages.reduce((sum, village) => sum + village.overdue, 0);
    this.state.metrics = {
      totalVillages,
      totalPlants,
      dueToday,
      overdue,
    };
  }

  async loadDashboard() {
    this.state.loading = true;
    this.notify();
    try {
      const { data } = await this.apiClient.get("/dashboard");
      this.state.villages = data.villages;
      this.state.today = data.today;
      this.state.calendar = data.calendar;
      this.state.error = null;
      this.state.lastLoadedAt = new Date().toISOString();
      this.recalculateMetrics();
      return data;
    } catch (error) {
      const message = error?.message || "Unable to load dashboard.";
      this.state.error = message;
      emit("toast", { type: "error", message });
      throw error;
    } finally {
      this.state.loading = false;
      this.notify();
    }
  }

  async quickAddPlant(villageId, { name } = {}) {
    const village = this.state.villages.find((item) => item.id === villageId);
    if (!village) {
      throw new Error("Village not found");
    }
    const displayName = name && name.trim().length > 0 ? name.trim() : "New Plant";
    village.plant_count += 1;
    this.pendingQuickAdd.add(villageId);
    this.recalculateMetrics();
    this.notify();
    try {
      const response = await this.apiClient.post(
        "/plants",
        {
          name: displayName,
          village_id: villageId,
        },
        { metadata: { action: "plant:create", villageId } },
      );
      if (response.queued) {
        emit("toast", { type: "info", message: `Added ${displayName} (sync pending).` });
      } else {
        emit("toast", { type: "success", message: `Added ${response.data?.name ?? displayName}` });
        await this.loadDashboard();
      }
      return response.data;
    } catch (error) {
      village.plant_count = Math.max(0, village.plant_count - 1);
      this.recalculateMetrics();
      emit("toast", { type: "error", message: "Unable to add plant." });
      throw error;
    } finally {
      this.pendingQuickAdd.delete(villageId);
      this.notify();
    }
  }

  async completeTask(taskId) {
    const index = this.state.today.findIndex((task) => task.id === taskId);
    if (index === -1) {
      return;
    }
    const task = this.state.today[index];
    const previousToday = [...this.state.today];
    const villageBeforeUpdate = this.getVillage(task.village.id)
      ? { ...this.getVillage(task.village.id) }
      : null;

    this.state.today.splice(index, 1);
    this.pendingTasks.add(taskId);
    const village = this.getVillage(task.village.id);
    if (village) {
      village.due_today = Math.max(0, village.due_today - 1);
    }
    this.recalculateMetrics();
    this.notify();
    try {
      const response = await this.apiClient.patch(`/tasks/${taskId}`, { state: "completed" }, {
        metadata: { action: "task:complete", taskId, location: "home" },
      });
      if (response?.queued) {
        emit("toast", { type: "info", message: `${task.title} completion queued.` });
      } else {
        emit("toast", { type: "success", message: `Completed ${task.title}` });
        await this.loadDashboard();
      }
    } catch (error) {
      this.state.today = previousToday;
      if (villageBeforeUpdate) {
        const targetVillage = this.getVillage(villageBeforeUpdate.id);
        if (targetVillage) {
          Object.assign(targetVillage, villageBeforeUpdate);
        }
      }
      this.recalculateMetrics();
      emit("toast", { type: "error", message: "Unable to complete task." });
      this.notify();
      throw error;
    } finally {
      this.pendingTasks.delete(taskId);
      this.notify();
    }
  }

  adjustVillage(villageId, updates) {
    const village = this.getVillage(villageId);
    if (!village) {
      return;
    }
    Object.assign(village, {
      ...village,
      ...updates,
    });
  }

  getVillage(villageId) {
    return this.state.villages.find((item) => item.id === villageId);
  }

  getCalendarWindow(days = 14) {
    const map = new Map(this.state.calendar.map((entry) => [entry.date, entry.count]));
    const window = [];
    const today = new Date();
    for (let offset = 0; offset < days; offset += 1) {
      const current = new Date(today);
      current.setDate(today.getDate() + offset);
      const iso = current.toISOString().slice(0, 10);
      window.push({
        date: iso,
        count: map.get(iso) ?? 0,
      });
    }
    return window;
  }
}
