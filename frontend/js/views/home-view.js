import { emit } from "../state.js";
import { createTodayPanel } from "./today-panel.js";

function formatLastWatered(days) {
  if (days === null || days === undefined) {
    return "No watering data yet";
  }
  if (days === 0) {
    return "Watered today";
  }
  if (days === 1) {
    return "Watered yesterday";
  }
  return `Watered ${days} days ago`;
}

function createSummaryChip(label, value) {
  const chip = document.createElement("div");
  chip.className = "home-view__summary-chip";
  chip.innerHTML = `
    <span class="home-view__summary-value">${value}</span>
    <span class="home-view__summary-label">${label}</span>
  `;
  return chip;
}

function createVillageCard(village, state, vm) {
  const article = document.createElement("article");
  article.className = "village-card";
  article.innerHTML = `
    <header class="village-card__header">
      <div>
        <h3>${village.name}</h3>
        <p class="village-card__meta">${formatLastWatered(village.last_watered_days)}</p>
      </div>
      <a class="village-card__link" href="#/v/${village.id}">View</a>
    </header>
    <div class="village-card__body">
      <p class="village-card__count"><strong>${village.plant_count}</strong> plants</p>
      <div class="village-card__chips"></div>
      <form class="village-card__quick-add">
        <label class="visually-hidden" for="quick-add-${village.id}">Quick add plant</label>
        <input id="quick-add-${village.id}" type="text" name="name" placeholder="Quick add plant" autocomplete="off" />
        <button type="submit">
          <img src="./assets/icons/plus.svg" alt="" aria-hidden="true" />
          <span>Add</span>
        </button>
      </form>
    </div>
  `;

  const chips = article.querySelector(".village-card__chips");
  const quickAddForm = article.querySelector(".village-card__quick-add");
  const quickAddInput = quickAddForm.querySelector("input");
  const quickAddButton = quickAddForm.querySelector("button");

  const dueChip = document.createElement("span");
  dueChip.className = "chip";
  dueChip.textContent = `${village.due_today} due today`;
  chips.appendChild(dueChip);

  const overdueChip = document.createElement("span");
  overdueChip.className = "chip chip--warning";
  overdueChip.textContent = `${village.overdue} overdue`;
  chips.appendChild(overdueChip);

  const pending = state.pending.quickAdd.includes(village.id);
  quickAddInput.disabled = pending;
  quickAddButton.disabled = pending;

  quickAddForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (quickAddInput.disabled) {
      return;
    }
    const name = quickAddInput.value.trim();
    quickAddInput.disabled = true;
    quickAddButton.disabled = true;
    vm
      .quickAddPlant(village.id, { name })
      .then(() => {
        quickAddInput.value = "";
      })
      .catch((error) => {
        console.error("Quick add failed", error);
      })
      .finally(() => {
        quickAddInput.disabled = false;
        quickAddButton.disabled = false;
        quickAddInput.focus({ preventScroll: true });
      });
  });

  return article;
}

export function createHomeView({ vm, shell, resetSidebar }) {
  let unsubscribe;
  let todayPanel;
  const cleanup = [];

  return {
    async mount(target) {
      const container = document.createElement("section");
      container.className = "home-view";
      container.innerHTML = `
        <header class="home-view__header">
          <div>
            <h1>Villages</h1>
            <p class="home-view__intro">Organize plants into thriving communities and track their care at a glance.</p>
          </div>
          <button class="home-view__cta">New Village</button>
        </header>
        <section class="home-view__summary" aria-label="Totals"></section>
        <section class="home-view__cards" aria-live="polite"></section>
      `;
      target.appendChild(container);

      const summaryEl = container.querySelector(".home-view__summary");
      const cardsEl = container.querySelector(".home-view__cards");
      const ctaButton = container.querySelector(".home-view__cta");

      const handleNewVillage = () => {
        emit("toast", {
          type: "info",
          message: "Village creation will arrive in a later phase.",
        });
      };
      ctaButton.addEventListener("click", handleNewVillage);
      cleanup.push(() => ctaButton.removeEventListener("click", handleNewVillage));

      todayPanel = createTodayPanel(vm);
      shell.setSidebar(todayPanel.element);

      const render = (state) => {
        renderSummary(summaryEl, state.metrics);
        renderCards(cardsEl, state, vm);
        if (state.loading) {
          container.classList.add("home-view--loading");
        } else {
          container.classList.remove("home-view--loading");
        }
        if (state.error) {
          container.setAttribute("data-error", state.error);
        } else {
          container.removeAttribute("data-error");
        }
      };

      unsubscribe = vm.subscribe(render);
      try {
        await vm.loadDashboard();
      } catch (error) {
        console.error("Failed to load dashboard", error);
      }
    },
    unmount() {
      unsubscribe?.();
      todayPanel?.destroy();
      cleanup.forEach((fn) => fn());
      if (typeof resetSidebar === "function") {
        resetSidebar();
      } else {
        shell.setSidebar(null);
      }
    },
  };
}

function renderSummary(container, metrics) {
  container.replaceChildren();
  const items = [
    createSummaryChip("villages", metrics.totalVillages),
    createSummaryChip("plants", metrics.totalPlants),
    createSummaryChip("due today", metrics.dueToday),
    createSummaryChip("overdue", metrics.overdue),
  ];
  items.forEach((chip) => container.appendChild(chip));
}

function renderCards(container, state, vm) {
  container.replaceChildren();
  if (state.villages.length === 0) {
    const empty = document.createElement("p");
    empty.className = "home-view__empty";
    empty.textContent = "No villages yet. Create one to start organizing your plants.";
    container.appendChild(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  state.villages.forEach((village) => {
    const card = createVillageCard(village, state, vm);
    fragment.appendChild(card);
  });
  container.appendChild(fragment);
}
