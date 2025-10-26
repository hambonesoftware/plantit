import { emit, subscribe } from "../state.js";

function clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

export class TasksVM {
  constructor({ apiClient }) {
    this.apiClient = apiClient;
    this.listeners = new Set();
    this.state = {
      loading: false,
      error: null,
      filters: {
        state: "all",
        category: "all",
        search: "",
      },
      tasks: [],
      lastLoadedAt: null,
    };
    this.selected = new Set();
    this.pending = {
      batch: false,
      complete: new Set(),
    };
    this.queueReloadHandle = null;
    this.queueRelease = subscribe("requestQueue:success", (entry) => {
      if (!entry || typeof entry.path !== "string") {
        return;
      }
      if (entry.path.includes("/tasks")) {
        this.scheduleReload();
      }
    });
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
      loading: this.state.loading,
      error: this.state.error,
      filters: { ...this.state.filters },
      tasks: this.state.tasks.map((task) => ({ ...task })),
      selected: Array.from(this.selected),
      lastLoadedAt: this.state.lastLoadedAt,
      pending: {
        batch: this.pending.batch,
        complete: Array.from(this.pending.complete),
      },
    };
  }

  notify() {
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(clone(snapshot)));
  }

  scheduleReload() {
    if (this.queueReloadHandle) {
      return;
    }
    this.queueReloadHandle = setTimeout(() => {
      this.queueReloadHandle = null;
      this.load({ silent: true }).catch((error) => console.error("Failed to refresh tasks after sync", error));
    }, 300);
  }

  destroy() {
    if (this.queueRelease) {
      this.queueRelease();
      this.queueRelease = null;
    }
    if (this.queueReloadHandle) {
      clearTimeout(this.queueReloadHandle);
      this.queueReloadHandle = null;
    }
  }

  buildQuery() {
    const params = new URLSearchParams();
    if (this.state.filters.state !== "all") {
      params.set("state", this.state.filters.state);
    }
    if (this.state.filters.category !== "all") {
      params.set("category", this.state.filters.category);
    }
    if (this.state.filters.search.trim().length > 0) {
      params.set("search", this.state.filters.search.trim());
    }
    const query = params.toString();
    return query.length > 0 ? `?${query}` : "";
  }

  async load({ silent = false } = {}) {
    if (!silent) {
      this.state.loading = true;
      this.notify();
    }
    try {
      const { data } = await this.apiClient.get(`/tasks${this.buildQuery()}`);
      this.state.tasks = Array.isArray(data) ? data : [];
      this.state.error = null;
      this.state.lastLoadedAt = new Date().toISOString();
      this.syncSelection();
      return data;
    } catch (error) {
      const message = error?.message || "Unable to load tasks.";
      this.state.error = message;
      emit("toast", { type: "error", message });
      throw error;
    } finally {
      this.state.loading = false;
      this.notify();
    }
  }

  syncSelection() {
    const validIds = new Set(this.state.tasks.map((task) => task.id));
    Array.from(this.selected).forEach((id) => {
      if (!validIds.has(id)) {
        this.selected.delete(id);
      }
    });
  }

  setFilter(filter, value) {
    if (!Object.hasOwn(this.state.filters, filter)) {
      return;
    }
    if (this.state.filters[filter] === value) {
      return;
    }
    this.state.filters = {
      ...this.state.filters,
      [filter]: value,
    };
    this.notify();
    this.load().catch((error) => console.error("Failed to load tasks", error));
  }

  setSearch(query) {
    this.state.filters = {
      ...this.state.filters,
      search: query,
    };
    this.notify();
  }

  applySearch() {
    this.load().catch((error) => console.error("Failed to load tasks", error));
  }

  toggleSelect(taskId) {
    if (this.selected.has(taskId)) {
      this.selected.delete(taskId);
    } else {
      this.selected.add(taskId);
    }
    this.notify();
  }

  selectAll() {
    this.selected = new Set(this.state.tasks.map((task) => task.id));
    this.notify();
  }

  clearSelection() {
    this.selected.clear();
    this.notify();
  }

  getSelectedIds() {
    return Array.from(this.selected);
  }

  async completeTask(taskId) {
    this.pending.complete.add(taskId);
    this.notify();
    const previousTasks = [...this.state.tasks];
    try {
      const response = await this.apiClient.patch(`/tasks/${taskId}`, { state: "completed" }, {
        metadata: { action: "task:complete", taskId, location: "tasks" },
      });
      this.selected.delete(taskId);
      this.state.tasks = this.state.tasks.filter((task) => task.id !== taskId);
      if (response?.queued) {
        emit("toast", { type: "info", message: "Task completion queued." });
      } else {
        emit("toast", { type: "success", message: "Task completed." });
        await this.load({ silent: true });
      }
    } catch (error) {
      this.state.tasks = previousTasks;
      emit("toast", { type: "error", message: "Unable to complete task." });
      throw error;
    } finally {
      this.pending.complete.delete(taskId);
      this.notify();
    }
  }

  async batchComplete() {
    const ids = this.getSelectedIds();
    if (ids.length === 0) {
      emit("toast", { type: "info", message: "Select at least one task." });
      return;
    }
    this.pending.batch = true;
    this.notify();
    const previousTasks = [...this.state.tasks];
    const previousSelected = new Set(this.selected);
    try {
      const response = await this.apiClient.post(
        "/tasks/batch",
        { task_ids: ids, state: "completed" },
        { metadata: { action: "tasks:batchComplete", count: ids.length } },
      );
      const idSet = new Set(ids);
      this.state.tasks = this.state.tasks.filter((task) => !idSet.has(task.id));
      this.clearSelection();
      if (response?.queued) {
        emit("toast", { type: "info", message: "Task completions queued." });
      } else {
        emit("toast", { type: "success", message: `Completed ${ids.length} tasks.` });
        await this.load({ silent: true });
      }
    } catch (error) {
      this.state.tasks = previousTasks;
      this.selected = previousSelected;
      emit("toast", { type: "error", message: "Unable to complete selected tasks." });
      throw error;
    } finally {
      this.pending.batch = false;
      this.notify();
    }
  }

  async batchReschedule(dueDate) {
    const ids = this.getSelectedIds();
    if (ids.length === 0) {
      emit("toast", { type: "info", message: "Select at least one task." });
      return;
    }
    if (!dueDate) {
      emit("toast", { type: "warning", message: "Choose a new due date." });
      return;
    }
    this.pending.batch = true;
    this.notify();
    const previousTasks = [...this.state.tasks];
    try {
      const response = await this.apiClient.post(
        "/tasks/batch",
        { task_ids: ids, due_date: dueDate },
        { metadata: { action: "tasks:batchReschedule", count: ids.length, dueDate } },
      );
      const idSet = new Set(ids);
      this.state.tasks = this.state.tasks.map((task) =>
        idSet.has(task.id) ? { ...task, due_date: dueDate } : task,
      );
      if (response?.queued) {
        emit("toast", { type: "info", message: "Task reschedule queued." });
      } else {
        emit("toast", { type: "success", message: "Tasks rescheduled." });
        await this.load({ silent: true });
      }
    } catch (error) {
      this.state.tasks = previousTasks;
      emit("toast", { type: "error", message: "Unable to reschedule tasks." });
      throw error;
    } finally {
      this.pending.batch = false;
      this.notify();
    }
  }
}

export default { TasksVM };
