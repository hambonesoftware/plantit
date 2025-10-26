import { ApiError } from "../services/apiClient.js";
import { emit } from "../state.js";
import { fetchDashboard } from "../services/dashboardService.js";
import {
  createEmptyDashboardUi,
  mergeDashboardUi,
  computeDashboardMetrics,
  updateVillage,
  updateTask,
  cloneDashboardUi,
  toUiVillageSummary,
} from "../../types/ui.js";

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
      loading: false,
      error: null,
      lastLoadedAt: null,
      metrics: {
        totalVillages: 0,
        totalPlants: 0,
        dueToday: 0,
        overdue: 0,
      },
    };
    this.uiState = createEmptyDashboardUi();
    this.pendingVillageCreation = false;
    this.nextTemporaryVillageId = -1;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  snapshot() {
    const villages = this.uiState.villages.map((village) => ({ ...village }));
    const today = this.uiState.today
      .filter((task) => !task.pending)
      .map((task) => ({
        ...task,
        plant: { ...task.plant },
        village: { ...task.village },
      }));
    const calendar = this.uiState.calendar.map((entry) => ({ ...entry }));
    const pendingQuickAdd = this.uiState.villages.filter((village) => village.quickAddPending).map((village) => village.id);
    const pendingTasks = this.uiState.today.filter((task) => task.pending).map((task) => task.id);

    return {
      villages,
      today,
      calendar,
      metrics: { ...this.state.metrics },
      loading: this.state.loading,
      error: this.state.error,
      lastLoadedAt: this.state.lastLoadedAt,
      pending: {
        quickAdd: pendingQuickAdd,
        tasks: pendingTasks,
        creatingVillage: this.pendingVillageCreation,
      },
    };
  }

  notify() {
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(clone(snapshot)));
  }

  setUiState(nextState) {
    this.uiState = nextState;
    this.state.metrics = computeDashboardMetrics(this.uiState);
  }

  async loadDashboard() {
    this.state.loading = true;
    this.notify();
    try {
      const dto = await fetchDashboard(this.apiClient);
      this.setUiState(mergeDashboardUi(this.uiState, dto));
      this.state.error = null;
      this.state.lastLoadedAt = new Date().toISOString();
      return dto;
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
    const existing = this.uiState.villages.find((item) => item.id === villageId);
    if (!existing) {
      throw new Error("Village not found");
    }
    const displayName = name && name.trim().length > 0 ? name.trim() : "New Plant";
    const previousState = cloneDashboardUi(this.uiState);
    this.setUiState(
      updateVillage(this.uiState, villageId, (village) => ({
        ...village,
        plant_count: village.plant_count + 1,
        quickAddPending: true,
      })),
    );
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
      this.setUiState(previousState);
      emit("toast", { type: "error", message: "Unable to add plant." });
      this.notify();
      throw error;
    } finally {
      this.setUiState(
        updateVillage(this.uiState, villageId, (village) => ({
          ...village,
          quickAddPending: false,
        })),
      );
      this.notify();
    }
  }

  async createVillage({ name, description } = {}) {
    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
      const message = "Village name is required.";
      emit("toast", { type: "error", message });
      throw new Error(message);
    }

    const normalizedDescription =
      typeof description === "string" && description.trim().length > 0 ? description.trim() : null;

    const optimisticVillage = this.createOptimisticVillage({
      name: trimmedName,
      description: normalizedDescription,
    });

    this.pendingVillageCreation = true;
    this.setUiState({
      ...this.uiState,
      villages: [...this.uiState.villages, toUiVillageSummary({ ...optimisticVillage, optimistic: true }, { optimistic: true })],
    });
    this.notify();

    try {
      const response = await this.apiClient.post(
        "/villages",
        {
          name: trimmedName,
          description: normalizedDescription,
        },
        {
          metadata: { action: "village:create" },
          optimisticData: optimisticVillage,
        },
      );

      if (response.queued) {
        emit("toast", {
          type: "info",
          message: `Creating ${trimmedName} when connectivity is restored.`,
        });
      } else {
        const createdName = response.data?.name ?? trimmedName;
        const createdDescription =
          typeof response.data?.description === "string" ? response.data.description : normalizedDescription;
        this.setUiState(
          updateVillage(this.uiState, optimisticVillage.id, (village) => ({
            ...village,
            id: response.data?.id ?? village.id,
            name: createdName,
            description: createdDescription,
            optimistic: false,
          })),
        );
        this.notify();
        try {
          await this.loadDashboard();
        } catch (refreshError) {
          console.error("Village created but failed to refresh dashboard", refreshError);
        }
      }

      return response.data ?? optimisticVillage;
    } catch (error) {
      this.setUiState({
        ...this.uiState,
        villages: this.uiState.villages.filter((village) => village.id !== optimisticVillage.id),
      });
      this.notify();
      const message = error instanceof ApiError && typeof error.message === "string" && error.message.length > 0
        ? error.message
        : "Unable to create village.";
      emit("toast", { type: "error", message });
      throw error;
    } finally {
      this.pendingVillageCreation = false;
      this.notify();
    }
  }

  createOptimisticVillage({ name, description }) {
    const villageId = this.nextTemporaryVillageId;
    this.nextTemporaryVillageId -= 1;
    return {
      id: villageId,
      name,
      description,
      plant_count: 0,
      due_today: 0,
      overdue: 0,
      last_watered_days: null,
      cover_photo: null,
    };
  }

  async completeTask(taskId) {
    const task = this.uiState.today.find((item) => item.id === taskId);
    if (!task) {
      return;
    }
    const previousState = cloneDashboardUi(this.uiState);
    this.setUiState(
      updateTask(this.uiState, taskId, (current) => ({
        ...current,
        pending: true,
      })),
    );
    this.setUiState(
      updateVillage(this.uiState, task.village.id, (village) => ({
        ...village,
        due_today: Math.max(0, village.due_today - 1),
      })),
    );
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
      this.setUiState(previousState);
      emit("toast", { type: "error", message: "Unable to complete task." });
      this.notify();
      throw error;
    }
  }

  adjustVillage(villageId, updates) {
    this.setUiState(
      updateVillage(this.uiState, villageId, (village) => ({
        ...village,
        ...updates,
      })),
    );
    this.notify();
  }

  getVillage(villageId) {
    return this.uiState.villages.find((item) => item.id === villageId);
  }

  getCalendarWindow(days = 14) {
    const map = new Map(this.uiState.calendar.map((entry) => [entry.date, entry.count]));
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
