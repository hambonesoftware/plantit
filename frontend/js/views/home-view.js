import { createSummarySkeleton, createVillageCardSkeletons } from "../ui/skeleton.js";
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
    <div class="village-card__media" aria-hidden="true"></div>
    <div class="village-card__content">
      <header class="village-card__header">
        <div>
          <h3>${village.name}</h3>
          <p class="village-card__meta">${formatLastWatered(village.last_watered_days)}</p>
        </div>
        <span class="village-card__due">
          <span class="village-card__due-label">Due today</span>
          <span class="village-card__due-value">${village.due_today}</span>
        </span>
      </header>
      <div class="village-card__metrics">
        <p class="village-card__count"><strong>${village.plant_count}</strong> ${village.plant_count === 1 ? "plant" : "plants"}</p>
        <div class="village-card__chips"></div>
      </div>
    </div>
    <div class="village-card__footer">
      <a class="village-card__link" href="#/v/${village.id}">Open</a>
      <form class="village-card__quick-add">
        <label class="visually-hidden" for="quick-add-${village.id}">Quick add plant to ${village.name}</label>
        <input id="quick-add-${village.id}" type="text" name="name" placeholder="Quick add plant" autocomplete="off" />
        <button type="submit">
          <img src="./assets/icons/plus.svg" alt="" aria-hidden="true" />
          <span>Add</span>
        </button>
      </form>
    </div>
  `;

  const interactiveSelector = "a, button, input, textarea, select, label, form";
  const navigateToVillage = () => {
    window.location.hash = `#/v/${village.id}`;
  };

  article.dataset.villageId = String(village.id);
  article.setAttribute("role", "link");
  article.tabIndex = 0;
  article.setAttribute("aria-label", `Open ${village.name}`);

  article.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest(interactiveSelector)) {
      return;
    }
    if (typeof event.button === "number" && event.button !== 0) {
      return;
    }
    navigateToVillage();
  });

  article.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) {
      return;
    }
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      navigateToVillage();
    }
  });

  const media = article.querySelector(".village-card__media");
  if (media instanceof HTMLElement) {
    const hashSource = `${village.name ?? ""}${village.id ?? ""}`;
    let hash = 0;
    for (const char of hashSource) {
      hash = (hash + char.charCodeAt(0)) % 360;
    }
    const hue = 120 + (hash % 28);
    const secondaryHue = (hue + 18) % 360;
    media.style.background = `linear-gradient(135deg, hsl(${hue} 48% 70% / 0.9), hsl(${secondaryHue} 58% 78% / 0.6))`;
  }

  const chips = article.querySelector(".village-card__chips");
  const quickAddForm = article.querySelector(".village-card__quick-add");
  const quickAddInput = quickAddForm.querySelector("input");
  const quickAddButton = quickAddForm.querySelector("button");

  const overdueChip = document.createElement("span");
  overdueChip.className = "chip chip--warning";
  overdueChip.textContent = `${village.overdue} overdue`;
  chips?.appendChild(overdueChip);

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
        <form class="home-view__create" hidden>
          <fieldset>
            <legend class="visually-hidden">Create a new village</legend>
            <div class="field">
              <label for="home-view-create-name">Village name</label>
              <input id="home-view-create-name" name="name" type="text" required maxlength="120" autocomplete="off" />
            </div>
            <div class="field">
              <label for="home-view-create-description">Description <span class="home-view__optional">(optional)</span></label>
              <textarea id="home-view-create-description" name="description" maxlength="500" rows="3"></textarea>
            </div>
          </fieldset>
          <div class="home-view__create-actions">
            <button type="submit" class="home-view__create-submit">Create village</button>
            <button type="button" class="home-view__create-cancel" data-action="cancel">Cancel</button>
          </div>
        </form>
        <section class="home-view__summary" aria-label="Totals"></section>
        <section class="home-view__cards" aria-live="polite"></section>
      `;
      target.appendChild(container);

      const summaryEl = container.querySelector(".home-view__summary");
      const cardsEl = container.querySelector(".home-view__cards");
      const ctaButton = container.querySelector(".home-view__cta");
      const createForm = container.querySelector(".home-view__create");
      const nameInput = createForm?.querySelector("[name='name']");
      const descriptionInput = createForm?.querySelector("[name='description']");
      const cancelButton = createForm?.querySelector("[data-action='cancel']");

      let latestState = vm.snapshot();

      const resetCreateForm = () => {
        if (!(createForm instanceof HTMLFormElement)) {
          return;
        }
        createForm.reset();
      };

      const applyCreateFormState = (state) => {
        latestState = state;
        const isCreating = Boolean(state.pending?.creatingVillage);
        if (createForm instanceof HTMLFormElement) {
          createForm.toggleAttribute("aria-busy", isCreating);
          const controls = Array.from(createForm.elements ?? []);
          controls.forEach((element) => {
            if (element instanceof HTMLButtonElement) {
              if (element.type === "submit") {
                element.disabled = isCreating;
                element.textContent = isCreating ? "Creating…" : "Create village";
              } else {
                element.disabled = isCreating;
              }
            } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
              element.toggleAttribute("disabled", isCreating);
            }
          });
        }
        if (ctaButton instanceof HTMLButtonElement) {
          ctaButton.disabled = isCreating;
        }
      };

      const setCreateFormVisible = (visible) => {
        if (createForm instanceof HTMLFormElement) {
          createForm.hidden = !visible;
        }
        if (ctaButton instanceof HTMLButtonElement) {
          ctaButton.hidden = visible;
        }
        if (visible) {
          if (nameInput instanceof HTMLInputElement) {
            nameInput.focus({ preventScroll: true });
          }
        }
        applyCreateFormState(latestState);
      };

      const handleNewVillage = () => {
        setCreateFormVisible(true);
      };

      const handleCreateSubmit = (event) => {
        if (!(createForm instanceof HTMLFormElement)) {
          return;
        }
        event.preventDefault();
        if (latestState.pending?.creatingVillage) {
          return;
        }
        const formData = new FormData(createForm);
        const name = formData.get("name");
        const description = formData.get("description");
        vm
          .createVillage({
            name: typeof name === "string" ? name : "",
            description: typeof description === "string" ? description : descriptionInput?.value ?? "",
          })
          .then(() => {
            resetCreateForm();
            setCreateFormVisible(false);
            if (ctaButton instanceof HTMLButtonElement) {
              ctaButton.focus({ preventScroll: true });
            }
          })
          .catch((error) => {
            console.error("Village creation failed", error);
            if (nameInput instanceof HTMLInputElement) {
              nameInput.focus({ preventScroll: true });
              nameInput.select();
            }
          });
      };

      const handleCreateCancel = () => {
        resetCreateForm();
        setCreateFormVisible(false);
        if (ctaButton instanceof HTMLButtonElement) {
          ctaButton.focus({ preventScroll: true });
        }
      };

      const handleCreateKeydown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          handleCreateCancel();
        }
      };

      ctaButton.addEventListener("click", handleNewVillage);
      cleanup.push(() => ctaButton.removeEventListener("click", handleNewVillage));

      if (createForm instanceof HTMLFormElement) {
        createForm.addEventListener("submit", handleCreateSubmit);
        createForm.addEventListener("keydown", handleCreateKeydown);
        cleanup.push(() => {
          createForm.removeEventListener("submit", handleCreateSubmit);
          createForm.removeEventListener("keydown", handleCreateKeydown);
        });
      }

      if (cancelButton instanceof HTMLButtonElement) {
        cancelButton.addEventListener("click", handleCreateCancel);
        cleanup.push(() => cancelButton.removeEventListener("click", handleCreateCancel));
      }

      todayPanel = createTodayPanel(vm);
      shell.setSidebar(todayPanel.element);

      const render = (state) => {
        applyCreateFormState(state);
        const showSkeleton = state.loading && state.villages.length === 0;
        if (showSkeleton) {
          summaryEl.replaceChildren(createSummarySkeleton());
          cardsEl.replaceChildren(createVillageCardSkeletons(3));
        } else {
          renderSummary(summaryEl, state.metrics);
          renderCards(cardsEl, state, vm);
        }
        container.classList.toggle("home-view--loading", state.loading);
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
