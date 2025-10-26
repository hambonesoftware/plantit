import { createVillageCardSkeletons, createVillageListSkeleton } from "../ui/skeleton.js";

export function createVillageView({ vm, shell, resetSidebar }) {
  let unsubscribe;
  const cleanup = [];

  return {
    async mount(target) {
      const container = document.createElement("section");
      container.className = "village-view";
      container.innerHTML = `
        <header class="village-view__header">
          <div>
            <a class="village-view__back" href="#/">← Back to villages</a>
            <h1 class="village-view__title">Village</h1>
            <p class="village-view__meta"></p>
          </div>
          <div class="village-view__controls">
            <label>
              <span class="visually-hidden">Filter by status</span>
              <select class="village-view__filter village-view__filter--due">
                <option value="all">All statuses</option>
                <option value="due">Due soon</option>
                <option value="overdue">Overdue</option>
                <option value="ok">Happy</option>
              </select>
            </label>
            <label>
              <span class="visually-hidden">Filter by tag</span>
              <select class="village-view__filter village-view__filter--tag">
                <option value="all">All tags</option>
              </select>
            </label>
            <div class="village-view__view-toggle" role="group" aria-label="View mode">
              <button type="button" data-mode="grid" class="is-active">Grid</button>
              <button type="button" data-mode="list">List</button>
            </div>
          </div>
        </header>
        <section class="village-view__content">
          <div class="village-view__plants" aria-live="polite"></div>
        </section>
      `;
      target.appendChild(container);
      resetSidebar?.();

      const titleEl = container.querySelector(".village-view__title");
      const metaEl = container.querySelector(".village-view__meta");
      const dueSelect = container.querySelector(".village-view__filter--due");
      const tagSelect = container.querySelector(".village-view__filter--tag");
      const viewToggle = container.querySelector(".village-view__view-toggle");
      const plantsEl = container.querySelector(".village-view__plants");

      const onDueChange = () => vm.setFilter("due", dueSelect.value);
      const onTagChange = () => vm.setFilter("tag", tagSelect.value);
      const onViewToggle = (event) => {
        const button = event.target.closest("button[data-mode]");
        if (!button) {
          return;
        }
        vm.setViewMode(button.dataset.mode);
      };

      dueSelect.addEventListener("change", onDueChange);
      tagSelect.addEventListener("change", onTagChange);
      viewToggle.addEventListener("click", onViewToggle);

      cleanup.push(() => dueSelect.removeEventListener("change", onDueChange));
      cleanup.push(() => tagSelect.removeEventListener("change", onTagChange));
      cleanup.push(() => viewToggle.removeEventListener("click", onViewToggle));

      const render = (state) => {
        updateHeader(titleEl, metaEl, state);
        updateFilters(tagSelect, state);
        updateViewToggle(viewToggle, state.viewMode);
        renderPlants(plantsEl, state, vm);
        container.toggleAttribute("data-loading", state.loading);
      };

      unsubscribe = vm.subscribe(render);
      try {
        await vm.load();
      } catch (error) {
        console.error("Failed to load village", error);
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

function updateHeader(titleEl, metaEl, state) {
  const name = state.village?.name ? state.village.name : `Village #${state.village?.id ?? ""}`;
  titleEl.textContent = name;
  const total = state.metrics.total;
  const shown = state.metrics.shown;
  metaEl.textContent = `${shown} of ${total} plants shown`;
}

function updateFilters(tagSelect, state) {
  const previous = tagSelect.value;
  tagSelect.replaceChildren();
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All tags";
  tagSelect.appendChild(allOption);
  state.tags.forEach((tag) => {
    const option = document.createElement("option");
    option.value = tag;
    option.textContent = tag;
    tagSelect.appendChild(option);
  });
  if ([...tagSelect.options].some((option) => option.value === previous)) {
    tagSelect.value = previous;
  } else {
    tagSelect.value = state.filters.tag;
  }
}

function updateViewToggle(toggleEl, mode) {
  toggleEl.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
}

function renderPlants(container, state, vm) {
  container.replaceChildren();
  if (state.loading && state.metrics.total === 0) {
    if (state.viewMode === "list") {
      container.appendChild(createVillageListSkeleton(4));
    } else {
      container.appendChild(createVillageCardSkeletons(4));
    }
    return;
  }
  if (state.filteredPlants.length === 0) {
    const empty = document.createElement("p");
    empty.className = "village-view__empty";
    empty.textContent = "No plants match the selected filters.";
    container.appendChild(empty);
    return;
  }

  if (state.viewMode === "list") {
    container.appendChild(renderPlantList(state, vm));
  } else {
    const grid = document.createElement("div");
    grid.className = "village-view__grid";
    state.filteredPlants.forEach((plant) => {
      grid.appendChild(createPlantCard(plant, state, vm));
    });
    container.appendChild(grid);
  }
}

function renderPlantList(state, vm) {
  const table = document.createElement("table");
  table.className = "village-view__table";
  table.innerHTML = `
    <thead>
      <tr>
        <th scope="col">Plant</th>
        <th scope="col">Status</th>
        <th scope="col">Tags</th>
        <th scope="col">Actions</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");
  state.filteredPlants.forEach((plant) => {
    const row = document.createElement("tr");
    const titleCell = document.createElement("td");
    titleCell.innerHTML = `<strong>${plant.name}</strong><div class="village-plant__species">${plant.species}</div>`;
    const statusCell = document.createElement("td");
    statusCell.appendChild(createStatusPill(plant.due_state));
    const tagsCell = document.createElement("td");
    tagsCell.appendChild(renderTags(plant.tags));
    const actionsCell = document.createElement("td");
    actionsCell.appendChild(createActions(plant, state, vm));
    row.appendChild(titleCell);
    row.appendChild(statusCell);
    row.appendChild(tagsCell);
    row.appendChild(actionsCell);
    tbody.appendChild(row);
  });
  return table;
}

function createPlantCard(plant, state, vm) {
  const card = document.createElement("article");
  card.className = "village-plant-card";
  card.innerHTML = `
    <header class="village-plant-card__header">
      <div>
        <h2>${plant.name}</h2>
        <p class="village-plant__species">${plant.species || ""}</p>
      </div>
    </header>
    <div class="village-plant-card__status"></div>
    <div class="village-plant-card__tags"></div>
    <div class="village-plant-card__actions"></div>
  `;
  const statusEl = card.querySelector(".village-plant-card__status");
  statusEl.appendChild(createStatusPill(plant.due_state));
  const tagsEl = card.querySelector(".village-plant-card__tags");
  tagsEl.appendChild(renderTags(plant.tags));
  const actionsEl = card.querySelector(".village-plant-card__actions");
  actionsEl.appendChild(createActions(plant, state, vm));
  return card;
}

function createStatusPill(status) {
  const pill = document.createElement("span");
  pill.className = "status-pill";
  if (status === "overdue") {
    pill.classList.add("status-pill--danger");
    pill.textContent = "Overdue";
  } else if (status === "due") {
    pill.classList.add("status-pill--warning");
    pill.textContent = "Due soon";
  } else {
    pill.classList.add("status-pill--ok");
    pill.textContent = "Happy";
  }
  return pill;
}

function renderTags(tags) {
  const wrapper = document.createElement("div");
  wrapper.className = "tag-list";
  if (tags.length === 0) {
    const none = document.createElement("span");
    none.className = "tag tag--empty";
    none.textContent = "No tags";
    wrapper.appendChild(none);
    return wrapper;
  }
  tags.forEach((tag) => {
    const badge = document.createElement("span");
    badge.className = "tag";
    badge.textContent = tag;
    wrapper.appendChild(badge);
  });
  return wrapper;
}

function createActions(plant, state, vm) {
  const container = document.createElement("div");
  container.className = "village-plant-card__actions-inner";

  const waterButton = document.createElement("button");
  waterButton.type = "button";
  waterButton.className = "village-action";
  waterButton.textContent = "Log water";
  waterButton.disabled = state.pending.watering.includes(plant.id);
  waterButton.addEventListener("click", () => {
    if (!waterButton.disabled) {
      vm.logWater(plant.id).catch((error) => console.error("Water action failed", error));
    }
  });

  const photoInput = document.createElement("input");
  photoInput.type = "file";
  photoInput.accept = "image/*";
  photoInput.className = "visually-hidden";
  photoInput.addEventListener("change", () => {
    const file = photoInput.files?.[0];
    vm
      .addPhoto(plant.id, file)
      .catch((error) => console.error("Photo upload failed", error))
      .finally(() => {
        photoInput.value = "";
      });
  });

  const photoButton = document.createElement("button");
  photoButton.type = "button";
  photoButton.className = "village-action";
  photoButton.textContent = "Add photo";
  photoButton.disabled = state.pending.photos.includes(plant.id);
  photoButton.addEventListener("click", () => {
    if (!photoButton.disabled) {
      photoInput.click();
    }
  });

  const moveSelect = document.createElement("select");
  moveSelect.className = "village-action__select";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Move to…";
  moveSelect.appendChild(defaultOption);
  state.availableVillages.forEach((village) => {
    const option = document.createElement("option");
    option.value = String(village.id);
    option.textContent = village.name;
    moveSelect.appendChild(option);
  });
  moveSelect.disabled = state.pending.move.includes(plant.id) || state.availableVillages.length === 0;
  moveSelect.addEventListener("change", () => {
    const destination = moveSelect.value;
    if (!destination) {
      return;
    }
    vm
      .movePlant(plant.id, Number(destination))
      .catch((error) => console.error("Move plant failed", error))
      .finally(() => {
        moveSelect.value = "";
      });
  });

  container.appendChild(waterButton);
  container.appendChild(photoButton);
  container.appendChild(photoInput);
  container.appendChild(moveSelect);
  return container;
}
