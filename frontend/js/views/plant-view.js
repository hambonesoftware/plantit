import { initTabs } from "../ui/tabs.js";
import { emit } from "../state.js";

const TASK_CATEGORIES = [
  { value: "custom", label: "Custom" },
  { value: "watering", label: "Watering" },
  { value: "feeding", label: "Feeding" },
  { value: "pruning", label: "Pruning" },
  { value: "misting", label: "Misting" },
  { value: "inspection", label: "Inspection" },
];

const LOG_ACTIONS = [
  { value: "watered", label: "Watered" },
  { value: "fed", label: "Fed" },
  { value: "pruned", label: "Pruned" },
  { value: "misted", label: "Misted" },
  { value: "inspected", label: "Inspected" },
  { value: "noted", label: "Noted" },
];

function formatDate(iso) {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function renderSidebar(shell, detail) {
  if (!shell?.setSidebar) {
    return;
  }
  if (!detail) {
    shell.setSidebar("<p>Select a plant to view details.</p>");
    return;
  }
  const wrapper = document.createElement("section");
  wrapper.className = "plant-sidebar";
  wrapper.innerHTML = `
    <h2>${detail.name ?? "Plant"}</h2>
    <dl class="plant-sidebar__metrics">
      <div>
        <dt>Due today</dt>
        <dd>${detail.metrics?.due_tasks ?? 0}</dd>
      </div>
      <div>
        <dt>Overdue</dt>
        <dd>${detail.metrics?.overdue_tasks ?? 0}</dd>
      </div>
      <div>
        <dt>Last log</dt>
        <dd>${detail.metrics?.last_logged_at ? formatDate(detail.metrics.last_logged_at) : "Never"}</dd>
      </div>
    </dl>
    <h3>Tags</h3>
    <p>${detail.tags?.length ? detail.tags.map((tag) => `<span class="tag">${tag}</span>`).join(" ") : "No tags"}</p>
  `;
  shell.setSidebar(wrapper);
}

function populateOverviewForm(form, detail, pending) {
  if (!form || !detail) {
    return;
  }
  form.querySelector('[name="name"]').value = detail.name ?? "";
  form.querySelector('[name="species"]').value = detail.species ?? "";
  form.querySelector('[name="variety"]').value = detail.variety ?? "";
  form.querySelector('[name="notes"]').value = detail.notes ?? "";
  form.querySelector('[name="tags"]').value = Array.isArray(detail.tags) ? detail.tags.join(", ") : "";
  Array.from(form.elements).forEach((element) => {
    if (element instanceof HTMLButtonElement) {
      element.disabled = pending.overview;
    } else {
      element.toggleAttribute("disabled", pending.overview && element.name !== "tags");
    }
  });
}

function renderTasks(list, detail, pending) {
  if (!list || !detail) {
    return;
  }
  list.replaceChildren();
  if (!detail.tasks?.length) {
    const empty = document.createElement("p");
    empty.className = "plant-tasks__empty";
    empty.textContent = "No scheduled tasks.";
    list.appendChild(empty);
    return;
  }
  detail.tasks.forEach((task) => {
    const item = document.createElement("article");
    item.className = "plant-task";
    item.innerHTML = `
      <header>
        <h4>${task.title}</h4>
        <p>${task.category}</p>
      </header>
      <p class="plant-task__due">Due ${task.due_date ? formatDate(task.due_date) : "anytime"}</p>
      <button type="button" data-complete="${task.id}">Complete</button>
    `;
    const button = item.querySelector("button");
    if (button) {
      button.disabled = pending.complete.includes(task.id);
    }
    list.appendChild(item);
  });
}

function populateCareForm(form, detail, pending) {
  if (!form || !detail) {
    return;
  }
  const care = detail.care_profile ?? {};
  form.querySelector('[name="watering_interval_days"]').value = care.watering_interval_days ?? "";
  form.querySelector('[name="feeding_interval_days"]').value = care.feeding_interval_days ?? "";
  form.querySelector('[name="pruning_interval_days"]').value = care.pruning_interval_days ?? "";
  form.querySelector('[name="misting_interval_days"]').value = care.misting_interval_days ?? "";
  form.querySelector('[name="care_notes"]').value = care.notes ?? "";
  const submit = form.querySelector("button[type='submit']");
  if (submit) {
    submit.disabled = pending.care;
  }
}

function renderLogs(list, detail) {
  if (!list || !detail) {
    return;
  }
  list.replaceChildren();
  if (!detail.logs?.length) {
    const empty = document.createElement("p");
    empty.textContent = "No history yet.";
    list.appendChild(empty);
    return;
  }
  detail.logs.forEach((log) => {
    const item = document.createElement("div");
    item.className = "plant-log";
    item.innerHTML = `
      <h4>${log.action}</h4>
      <p>${log.notes ?? ""}</p>
      <time datetime="${log.performed_at}">${formatDate(log.performed_at)}</time>
    `;
    list.appendChild(item);
  });
}

function renderPhotos(grid, detail, pending) {
  if (!grid || !detail) {
    return;
  }
  grid.replaceChildren();
  if (!detail.photos?.length) {
    const empty = document.createElement("p");
    empty.textContent = "No photos yet.";
    grid.appendChild(empty);
    return;
  }
  detail.photos.forEach((photo) => {
    const card = document.createElement("figure");
    card.className = "plant-photo";
    const image = document.createElement("img");
    image.loading = "lazy";
    const src = photo.thumbnail_path ? `/media/${photo.thumbnail_path}` : "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
    image.src = src;
    image.alt = photo.caption ?? detail.name ?? "Plant photo";
    card.appendChild(image);
    const caption = document.createElement("figcaption");
    caption.textContent = photo.caption ?? "";
    card.appendChild(caption);
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.deletePhoto = String(photo.id);
    button.textContent = "Delete";
    if (pending.deletes.includes(photo.id)) {
      button.disabled = true;
    }
    card.appendChild(button);
    grid.appendChild(card);
  });
}

function updateHero(hero, detail, pending) {
  if (!hero) {
    return;
  }
  const image = hero.querySelector("img");
  if (detail?.hero_photo?.thumbnail_path) {
    image.src = `/media/${detail.hero_photo.thumbnail_path}`;
    image.alt = detail.hero_photo.caption || `${detail.name ?? "Plant"} hero photo`;
    image.hidden = false;
  } else {
    image.src = "";
    image.alt = "";
    image.hidden = true;
  }
  const button = hero.querySelector("button[data-upload]");
  if (button) {
    button.disabled = pending.uploads.length > 0;
  }
}

function extractOverviewPayload(form) {
  const formData = new FormData(form);
  const payload = {
    name: formData.get("name")?.toString().trim(),
    species: formData.get("species")?.toString().trim() || null,
    variety: formData.get("variety")?.toString().trim() || null,
    notes: formData.get("notes")?.toString() ?? null,
  };
  const tagsValue = formData.get("tags")?.toString() ?? "";
  const tags = tagsValue
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  payload.tags = tags;
  return payload;
}

function extractCarePayload(form) {
  const formData = new FormData(form);
  const mapNumber = (field) => {
    const value = formData.get(field);
    if (value === null || value === "") {
      return null;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };
  return {
    watering_interval_days: mapNumber("watering_interval_days"),
    feeding_interval_days: mapNumber("feeding_interval_days"),
    pruning_interval_days: mapNumber("pruning_interval_days"),
    misting_interval_days: mapNumber("misting_interval_days"),
    notes: formData.get("care_notes")?.toString() ?? null,
  };
}

function extractTaskPayload(form) {
  const formData = new FormData(form);
  return {
    title: formData.get("task_title")?.toString().trim(),
    due_date: formData.get("task_due")?.toString() || null,
    description: formData.get("task_notes")?.toString() || null,
    category: formData.get("task_category")?.toString() || "custom",
  };
}

function extractLogPayload(form) {
  const formData = new FormData(form);
  return {
    action: formData.get("log_action")?.toString() || "noted",
    notes: formData.get("log_notes")?.toString() || null,
  };
}

export function createPlantView({ vm, shell, resetSidebar }) {
  let unsubscribe;
  const cleanup = [];
  let destroyTabs = () => {};
  let fileInput;

  return {
    async mount(target) {
      const container = document.createElement("section");
      container.className = "plant-view";
      container.innerHTML = `
        <header class="plant-view__header">
          <div class="plant-view__hero">
            <img alt="" hidden />
            <button type="button" data-upload>Add photo</button>
            <input type="file" accept="image/*" class="visually-hidden" data-upload-input />
          </div>
          <div class="plant-view__summary">
            <a class="plant-view__back" href="#/">← Back</a>
            <h1 class="plant-view__name">Plant</h1>
            <p class="plant-view__species"></p>
          </div>
        </header>
        <div class="plant-view__tabs" role="tablist" aria-label="Plant sections">
          <button role="tab" aria-controls="plant-tab-overview" aria-selected="true" id="plant-tab-overview-tab">Overview</button>
          <button role="tab" aria-controls="plant-tab-care" aria-selected="false" id="plant-tab-care-tab">Care</button>
          <button role="tab" aria-controls="plant-tab-history" aria-selected="false" id="plant-tab-history-tab">History</button>
          <button role="tab" aria-controls="plant-tab-photos" aria-selected="false" id="plant-tab-photos-tab">Photos</button>
        </div>
        <section class="plant-view__panels">
          <section id="plant-tab-overview" role="tabpanel" aria-labelledby="plant-tab-overview-tab">
            <form class="plant-overview__form">
              <div class="field">
                <label>Name <input name="name" required maxlength="120" /></label>
              </div>
              <div class="field">
                <label>Species <input name="species" maxlength="120" /></label>
              </div>
              <div class="field">
                <label>Variety <input name="variety" maxlength="120" /></label>
              </div>
              <div class="field">
                <label>Tags <input name="tags" placeholder="herb, shade" /></label>
              </div>
              <div class="field">
                <label>Notes <textarea name="notes" rows="3"></textarea></label>
              </div>
              <button type="submit">Save overview</button>
            </form>
            <section class="plant-tasks">
              <h3>Scheduled tasks</h3>
              <div class="plant-tasks__list"></div>
              <form class="plant-tasks__form">
                <div class="field">
                  <label>Title <input name="task_title" required maxlength="200" /></label>
                </div>
                <div class="field">
                  <label>Due date <input name="task_due" type="date" /></label>
                </div>
                <div class="field">
                  <label>Category
                    <select name="task_category">
                      ${TASK_CATEGORIES.map((option) => `<option value="${option.value}">${option.label}</option>`).join("")}
                    </select>
                  </label>
                </div>
                <div class="field">
                  <label>Notes <textarea name="task_notes" rows="2"></textarea></label>
                </div>
                <button type="submit">Schedule task</button>
              </form>
            </section>
          </section>
          <section id="plant-tab-care" role="tabpanel" aria-labelledby="plant-tab-care-tab" hidden>
            <form class="plant-care__form">
              <div class="field">
                <label>Watering interval (days) <input type="number" min="1" max="365" name="watering_interval_days" /></label>
              </div>
              <div class="field">
                <label>Feeding interval (days) <input type="number" min="1" max="365" name="feeding_interval_days" /></label>
              </div>
              <div class="field">
                <label>Pruning interval (days) <input type="number" min="1" max="365" name="pruning_interval_days" /></label>
              </div>
              <div class="field">
                <label>Misting interval (days) <input type="number" min="1" max="365" name="misting_interval_days" /></label>
              </div>
              <div class="field">
                <label>Care notes <textarea name="care_notes" rows="3"></textarea></label>
              </div>
              <button type="submit">Save care profile</button>
            </form>
          </section>
          <section id="plant-tab-history" role="tabpanel" aria-labelledby="plant-tab-history-tab" hidden>
            <form class="plant-history__form">
              <label>Action
                <select name="log_action">
                  ${LOG_ACTIONS.map((action) => `<option value="${action.value}">${action.label}</option>`).join("")}
                </select>
              </label>
              <label>Notes <textarea name="log_notes" rows="3"></textarea></label>
              <button type="submit">Add log</button>
            </form>
            <div class="plant-history__list"></div>
          </section>
          <section id="plant-tab-photos" role="tabpanel" aria-labelledby="plant-tab-photos-tab" hidden>
            <form class="plant-photos__form">
              <label>Caption <input name="photo_caption" maxlength="300" /></label>
              <button type="button" data-trigger-upload>Select photo…</button>
              <input type="file" accept="image/*" class="visually-hidden" data-photos-input />
            </form>
            <div class="plant-photos__grid"></div>
          </section>
        </section>
      `;
      target.appendChild(container);
      resetSidebar?.();

      const hero = container.querySelector(".plant-view__hero");
      fileInput = hero?.querySelector("input[data-upload-input]");
      const overviewForm = container.querySelector(".plant-overview__form");
      const tasksList = container.querySelector(".plant-tasks__list");
      const addTaskForm = container.querySelector(".plant-tasks__form");
      const careForm = container.querySelector(".plant-care__form");
      const historyForm = container.querySelector(".plant-history__form");
      const historyList = container.querySelector(".plant-history__list");
      const photosGrid = container.querySelector(".plant-photos__grid");
      const photosForm = container.querySelector(".plant-photos__form");
      const tabContainer = container.querySelector(".plant-view__tabs");
      destroyTabs = initTabs(tabContainer);

      const onOverviewSubmit = (event) => {
        event.preventDefault();
        const payload = extractOverviewPayload(overviewForm);
        vm.saveOverview(payload).catch((error) => console.error("Failed to save overview", error));
      };
      overviewForm?.addEventListener("submit", onOverviewSubmit);
      cleanup.push(() => overviewForm?.removeEventListener("submit", onOverviewSubmit));

      const onTaskSubmit = (event) => {
        event.preventDefault();
        const payload = extractTaskPayload(addTaskForm);
        if (!payload.title) {
          emit("toast", { type: "warning", message: "Task title is required." });
          return;
        }
        vm.scheduleTask(payload)
          .then(() => addTaskForm.reset())
          .catch((error) => console.error("Failed to schedule task", error));
      };
      addTaskForm?.addEventListener("submit", onTaskSubmit);
      cleanup.push(() => addTaskForm?.removeEventListener("submit", onTaskSubmit));

      const onTaskAction = (event) => {
        const button = event.target.closest("button[data-complete]");
        if (!button) {
          return;
        }
        const id = Number(button.dataset.complete);
        vm.completeTask(id).catch((error) => console.error("Failed to complete task", error));
      };
      tasksList?.addEventListener("click", onTaskAction);
      cleanup.push(() => tasksList?.removeEventListener("click", onTaskAction));

      const onCareSubmit = (event) => {
        event.preventDefault();
        const payload = extractCarePayload(careForm);
        vm.saveCareProfile(payload).catch((error) => console.error("Failed to save care profile", error));
      };
      careForm?.addEventListener("submit", onCareSubmit);
      cleanup.push(() => careForm?.removeEventListener("submit", onCareSubmit));

      const onHistorySubmit = (event) => {
        event.preventDefault();
        const payload = extractLogPayload(historyForm);
        vm.addLog(payload)
          .then(() => historyForm.reset())
          .catch((error) => console.error("Failed to add log", error));
      };
      historyForm?.addEventListener("submit", onHistorySubmit);
      cleanup.push(() => historyForm?.removeEventListener("submit", onHistorySubmit));

      const onDeletePhoto = (event) => {
        const button = event.target.closest("button[data-delete-photo]");
        if (!button) {
          return;
        }
        const id = Number(button.dataset.deletePhoto);
        vm.deletePhoto(id).catch((error) => console.error("Failed to delete photo", error));
      };
      photosGrid?.addEventListener("click", onDeletePhoto);
      cleanup.push(() => photosGrid?.removeEventListener("click", onDeletePhoto));

      const triggerUpload = photosForm?.querySelector("button[data-trigger-upload]");
      const photosInput = photosForm?.querySelector("input[data-photos-input]");
      const onPhotosSubmit = (event) => {
        event.preventDefault();
      };
      photosForm?.addEventListener("submit", onPhotosSubmit);
      cleanup.push(() => photosForm?.removeEventListener("submit", onPhotosSubmit));

      const onFileChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) {
          return;
        }
        const caption = photosForm?.querySelector('[name="photo_caption"]').value;
        vm
          .uploadPhoto(file, { caption })
          .then(() => {
            if (photosForm) {
              photosForm.reset();
            }
            event.target.value = "";
          })
          .catch((error) => console.error("Failed to upload photo", error));
      };
      photosInput?.addEventListener("change", onFileChange);
      cleanup.push(() => photosInput?.removeEventListener("change", onFileChange));

      const onHeroUpload = () => {
        fileInput?.click();
      };
      hero?.querySelector("button[data-upload]")?.addEventListener("click", onHeroUpload);
      cleanup.push(() => hero?.querySelector("button[data-upload]")?.removeEventListener("click", onHeroUpload));

      if (triggerUpload && photosInput) {
        const triggerHandler = () => photosInput.click();
        triggerUpload.addEventListener("click", triggerHandler);
        cleanup.push(() => triggerUpload.removeEventListener("click", triggerHandler));
      }

      if (fileInput) {
        const onHeroChange = (event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }
          vm
            .uploadPhoto(file)
            .then(() => {
              event.target.value = "";
            })
            .catch((error) => console.error("Failed to upload photo", error));
        };
        fileInput.addEventListener("change", onHeroChange);
        cleanup.push(() => fileInput?.removeEventListener("change", onHeroChange));
      }

      const render = (state) => {
        container.toggleAttribute("data-loading", state.loading);
        const detail = state.detail;
        const pending = state.pending;
        const nameEl = container.querySelector(".plant-view__name");
        const speciesEl = container.querySelector(".plant-view__species");
        if (nameEl) {
          nameEl.textContent = detail?.name ?? "Plant";
        }
        if (speciesEl) {
          speciesEl.textContent = detail?.species ?? "";
        }
        populateOverviewForm(overviewForm, detail, pending);
        renderTasks(tasksList, detail, pending);
        populateCareForm(careForm, detail, pending);
        renderLogs(historyList, detail);
        renderPhotos(photosGrid, detail, pending);
        updateHero(hero, detail, pending);
        renderSidebar(shell, detail);
      };

      unsubscribe = vm.subscribe(render);
      try {
        await vm.load();
      } catch (error) {
        console.error("Failed to load plant", error);
      }
    },
    unmount() {
      unsubscribe?.();
      destroyTabs?.();
      cleanup.forEach((fn) => fn());
      resetSidebar?.();
      if (typeof vm.destroy === "function") {
        vm.destroy();
      }
    },
  };
}

export default { createPlantView };
