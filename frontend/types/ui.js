// @ts-check

/**
 * @typedef {import("./api").components["schemas"]["DashboardResponse"]} DashboardResponse
 * @typedef {import("./api").components["schemas"]["VillageSummaryRead"]} ApiVillageSummary
 * @typedef {import("./api").components["schemas"]["TaskSummaryRead"]} ApiTaskSummary
 * @typedef {import("./api").components["schemas"]["CalendarBucketRead"]} ApiCalendarBucket
 */

/**
 * @typedef {ApiVillageSummary & { quickAddPending: boolean; optimistic: boolean }} UiVillageSummary
 * @typedef {ApiTaskSummary & { pending: boolean }} UiTaskSummary
 * @typedef {{
 *   villages: UiVillageSummary[];
 *   today: UiTaskSummary[];
 *   calendar: ApiCalendarBucket[];
 * }} UiDashboardState
 */

/**
 * Create an empty UI dashboard state.
 * @returns {UiDashboardState}
 */
export function createEmptyDashboardUi() {
  return {
    villages: [],
    today: [],
    calendar: [],
  };
}

/**
 * Clone a dashboard UI state so mutations do not leak.
 * @param {UiDashboardState} state
 * @returns {UiDashboardState}
 */
export function cloneDashboardUi(state) {
  return {
    villages: state.villages.map((village) => ({ ...village })),
    today: state.today.map((task) => ({
      ...task,
      plant: { ...task.plant },
      village: { ...task.village },
    })),
    calendar: state.calendar.map((entry) => ({ ...entry })),
  };
}

/**
 * Normalize an API village summary into a UI-ready object.
 * @param {ApiVillageSummary | UiVillageSummary} village
 * @param {{ quickAddPending?: boolean; optimistic?: boolean }} [overrides]
 * @returns {UiVillageSummary}
 */
export function toUiVillageSummary(village, overrides = {}) {
  const quickAdd = Object.hasOwn(village, "quickAddPending") ? !!village.quickAddPending : false;
  const optimistic = Object.hasOwn(village, "optimistic") ? !!village.optimistic : false;
  return {
    ...village,
    quickAddPending: overrides.quickAddPending ?? quickAdd,
    optimistic: overrides.optimistic ?? optimistic,
  };
}

/**
 * Normalize an API task summary into a UI-ready object.
 * @param {ApiTaskSummary | UiTaskSummary} task
 * @param {{ pending?: boolean }} [overrides]
 * @returns {UiTaskSummary}
 */
export function toUiTaskSummary(task, overrides = {}) {
  const pending = Object.hasOwn(task, "pending") ? !!task.pending : false;
  return {
    ...task,
    plant: { ...task.plant },
    village: { ...task.village },
    pending: overrides.pending ?? pending,
  };
}

/**
 * Convert a dashboard DTO into UI view-state objects.
 * @param {DashboardResponse} dto
 * @returns {UiDashboardState}
 */
export function fromDashboardDto(dto) {
  return {
    villages: dto.villages.map((village) => toUiVillageSummary(village)),
    today: dto.today.map((task) => toUiTaskSummary(task)),
    calendar: dto.calendar.map((entry) => ({ ...entry })),
  };
}

/**
 * Merge new dashboard DTO data with an existing UI state, preserving UI flags.
 * @param {UiDashboardState} previous
 * @param {DashboardResponse} dto
 * @returns {UiDashboardState}
 */
export function mergeDashboardUi(previous, dto) {
  const base = fromDashboardDto(dto);
  const villages = base.villages.map((village) => {
    const existing = previous.villages.find((item) => item.id === village.id);
    if (!existing) {
      return village;
    }
    return toUiVillageSummary(village, {
      quickAddPending: existing.quickAddPending,
      optimistic: false,
    });
  });
  const baseIds = new Set(villages.map((village) => village.id));
  const optimisticExtras = previous.villages.filter(
    (village) => village.optimistic && !baseIds.has(village.id),
  );
  villages.push(...optimisticExtras.map((village) => toUiVillageSummary(village, { optimistic: true })));
  const today = base.today.map((task) => {
    const existing = previous.today.find((item) => item.id === task.id);
    if (!existing) {
      return task;
    }
    return toUiTaskSummary(task, { pending: existing.pending });
  });
  return {
    villages,
    today,
    calendar: base.calendar,
  };
}

/**
 * Update a specific village within the UI state.
 * @param {UiDashboardState} state
 * @param {number} id
 * @param {(village: UiVillageSummary) => UiVillageSummary} updater
 * @returns {UiDashboardState}
 */
export function updateVillage(state, id, updater) {
  return {
    ...state,
    villages: state.villages.map((village) => {
      if (village.id !== id) {
        return village;
      }
      return toUiVillageSummary(updater({ ...village }));
    }),
  };
}

/**
 * Update a specific task within the UI state.
 * @param {UiDashboardState} state
 * @param {number} id
 * @param {(task: UiTaskSummary) => UiTaskSummary} updater
 * @returns {UiDashboardState}
 */
export function updateTask(state, id, updater) {
  return {
    ...state,
    today: state.today.map((task) => {
      if (task.id !== id) {
        return task;
      }
      return toUiTaskSummary(updater({ ...task }));
    }),
  };
}

/**
 * Compute top-level dashboard metrics from UI state.
 * @param {UiDashboardState} state
 * @returns {{ totalVillages: number; totalPlants: number; dueToday: number; overdue: number }}
 */
export function computeDashboardMetrics(state) {
  const totalVillages = state.villages.length;
  const totals = state.villages.reduce(
    (acc, village) => {
      acc.plants += village.plant_count;
      acc.dueToday += village.due_today;
      acc.overdue += village.overdue;
      return acc;
    },
    { plants: 0, dueToday: 0, overdue: 0 },
  );
  return {
    totalVillages,
    totalPlants: totals.plants,
    dueToday: totals.dueToday,
    overdue: totals.overdue,
  };
}
