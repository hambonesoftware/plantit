const CATEGORY_LABELS = {
  custom: "Custom",
  watering: "Watering",
  feeding: "Feeding",
  pruning: "Pruning",
  misting: "Misting",
  inspection: "Inspection",
};

const STATE_LABELS = {
  pending: "Pending",
  completed: "Completed",
  skipped: "Skipped",
};

function formatDate(value) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function renderSidebar(shell, tasks) {
  if (!shell?.setSidebar) {
    return;
  }
  const pending = tasks.filter((task) => task.state === "pending").length;
  const completed = tasks.filter((task) => task.state === "completed").length;
  const wrapper = document.createElement("section");
  wrapper.className = "tasks-sidebar";
  wrapper.innerHTML = `
    <h2>Task summary</h2>
    <dl>
      <div>
        <dt>Pending</dt>
        <dd>${pending}</dd>
      </div>
      <div>
        <dt>Completed</dt>
        <dd>${completed}</dd>
      </div>
    </dl>
  `;
  shell.setSidebar(wrapper);
}

function updateFilters(filters, state) {
  if (!filters) {
    return;
  }
  const stateSelect = filters.querySelector('[data-filter="state"]');
  const categorySelect = filters.querySelector('[data-filter="category"]');
  if (stateSelect) {
    stateSelect.value = state.filters.state;
  }
  if (categorySelect) {
    categorySelect.value = state.filters.category;
  }
}

function renderRows(tbody, state) {
  tbody.replaceChildren();
  if (state.tasks.length === 0) {
    const empty = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = state.loading ? "Loading tasks…" : "No tasks match the selected filters.";
    empty.appendChild(cell);
    tbody.appendChild(empty);
    return;
  }
  state.tasks.forEach((task) => {
    const row = document.createElement("tr");
    if (state.selected.includes(task.id)) {
      row.classList.add("is-selected");
    }
    row.innerHTML = `
      <td><input type="checkbox" data-select="${task.id}" ${state.selected.includes(task.id) ? "checked" : ""}></td>
      <td class="tasks-view__title">
        <strong>${task.title}</strong>
        <div class="tasks-view__meta">${task.plant ? task.plant.name : ""}</div>
      </td>
      <td>${CATEGORY_LABELS[task.category] ?? task.category}</td>
      <td>${formatDate(task.due_date)}</td>
      <td>${STATE_LABELS[task.state] ?? task.state}</td>
      <td><button type="button" class="tasks-view__action" data-complete="${task.id}" ${task.state !== "pending" ? "disabled" : ""}>Complete</button></td>
    `;
    tbody.appendChild(row);
  });
}

function updateToolbar(toolbar, state) {
  if (!toolbar) {
    return;
  }
  const count = toolbar.querySelector("[data-selected-count]");
  if (count) {
    count.textContent = state.selected.length;
  }
  const completeButton = toolbar.querySelector('[data-action="complete"]');
  const rescheduleButton = toolbar.querySelector('[data-action="reschedule"]');
  const dateInput = toolbar.querySelector('[data-reschedule-date]');
  const disabled = state.pending.batch;
  if (completeButton) {
    completeButton.disabled = disabled || state.selected.length === 0;
  }
  if (rescheduleButton) {
    rescheduleButton.disabled = disabled || state.selected.length === 0;
  }
  if (dateInput) {
    dateInput.disabled = disabled;
  }
}

export function createTasksView({ vm, shell, resetSidebar }) {
  let unsubscribe;
  const cleanup = [];

  return {
    async mount(target) {
      const container = document.createElement("section");
      container.className = "tasks-view";
      container.innerHTML = `
        <header class="tasks-view__header">
          <div>
            <h1>Tasks</h1>
            <p>Review upcoming work and act on multiple tasks at once.</p>
          </div>
          <form class="tasks-view__search" role="search">
            <label class="visually-hidden" for="tasks-search">Search tasks</label>
            <input id="tasks-search" name="q" type="search" placeholder="Search by title or plant" />
            <button type="submit">Search</button>
          </form>
        </header>
        <div class="tasks-view__filters" data-filters>
          <label>State
            <select data-filter="state">
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label>Category
            <select data-filter="category">
              <option value="all">All</option>
              <option value="watering">Watering</option>
              <option value="feeding">Feeding</option>
              <option value="pruning">Pruning</option>
              <option value="misting">Misting</option>
              <option value="inspection">Inspection</option>
              <option value="custom">Custom</option>
            </select>
          </label>
        </div>
        <div class="tasks-view__toolbar" data-toolbar>
          <span><strong data-selected-count>0</strong> selected</span>
          <button type="button" data-action="select-all">Select all</button>
          <button type="button" data-action="clear-selection">Clear</button>
          <button type="button" data-action="complete">Complete selected</button>
          <label class="tasks-view__reschedule">
            <span class="visually-hidden">New due date</span>
            <input type="date" data-reschedule-date />
          </label>
          <button type="button" data-action="reschedule">Reschedule</button>
        </div>
        <table class="tasks-view__table">
          <thead>
            <tr>
              <th scope="col" class="visually-hidden">Select</th>
              <th scope="col">Task</th>
              <th scope="col">Category</th>
              <th scope="col">Due</th>
              <th scope="col">State</th>
              <th scope="col" class="visually-hidden">Actions</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      `;
      target.appendChild(container);
      resetSidebar?.();

      const filters = container.querySelector("[data-filters]");
      const toolbar = container.querySelector("[data-toolbar]");
      const searchForm = container.querySelector(".tasks-view__search");
      const tableBody = container.querySelector("tbody");

      const onFilterChange = (event) => {
        const select = event.target.closest("select[data-filter]");
        if (!select) {
          return;
        }
        const { filter } = select.dataset;
        vm.setFilter(filter, select.value);
      };
      filters?.addEventListener("change", onFilterChange);
      cleanup.push(() => filters?.removeEventListener("change", onFilterChange));

      const onSearchSubmit = (event) => {
        event.preventDefault();
        const formData = new FormData(searchForm);
        const query = (formData.get("q") || "").toString();
        vm.setSearch(query);
        vm.applySearch();
      };
      searchForm?.addEventListener("submit", onSearchSubmit);
      cleanup.push(() => searchForm?.removeEventListener("submit", onSearchSubmit));

      const onToolbarClick = (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) {
          return;
        }
        const action = button.dataset.action;
        if (action === "select-all") {
          vm.selectAll();
        } else if (action === "clear-selection") {
          vm.clearSelection();
        } else if (action === "complete") {
          vm.batchComplete().catch((error) => console.error("Batch complete failed", error));
        } else if (action === "reschedule") {
          const dateInput = toolbar.querySelector('[data-reschedule-date]');
          const value = dateInput?.value || "";
          vm.batchReschedule(value).catch((error) => console.error("Batch reschedule failed", error));
        }
      };
      toolbar?.addEventListener("click", onToolbarClick);
      cleanup.push(() => toolbar?.removeEventListener("click", onToolbarClick));

      const onTableClick = (event) => {
        const checkbox = event.target.closest("input[type='checkbox'][data-select]");
        if (checkbox) {
          vm.toggleSelect(Number(checkbox.dataset.select));
          return;
        }
        const complete = event.target.closest("button[data-complete]");
        if (complete) {
          const id = Number(complete.dataset.complete);
          vm.completeTask(id).catch((error) => console.error("Complete task failed", error));
        }
      };
      tableBody?.addEventListener("click", onTableClick);
      cleanup.push(() => tableBody?.removeEventListener("click", onTableClick));

      const render = (state) => {
        container.toggleAttribute("data-loading", state.loading);
        updateFilters(filters, state);
        renderRows(tableBody, state);
        updateToolbar(toolbar, state);
        renderSidebar(shell, state.tasks);
      };

      unsubscribe = vm.subscribe(render);
      try {
        await vm.load();
      } catch (error) {
        console.error("Unable to load tasks", error);
      }
    },
    unmount() {
      unsubscribe?.();
      cleanup.forEach((fn) => fn());
      resetSidebar?.();
      if (typeof vm.destroy === "function") {
        vm.destroy();
      }
    },
  };
}

export default { createTasksView };
