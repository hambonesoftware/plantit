import { VillageDetailThinVM } from "../thinvms/VillageDetailThinVM.js";

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function plantItem(plant) {
  const tags = (plant.tags || []).join(", ");
  const thumbnail =
    plant.has_photo && plant.thumbnail_url
      ? `<img class="plant-thumb" src="${plant.thumbnail_url}" alt="Thumbnail of ${escapeHtml(plant.name)}" />`
      : "";
  return `
    <article class="card" data-plant-id="${plant.id}">
      <div class="plant-card">
        ${thumbnail}
        <div class="plant-card__content">
          <h3>${escapeHtml(plant.name)}</h3>
          <p class="muted">${escapeHtml(plant.species ?? "")}</p>
          ${plant.notes ? `<p>${escapeHtml(plant.notes)}</p>` : ""}
          <p class="muted">Tags: ${escapeHtml(tags)}</p>
          <div class="card-actions">
            <a class="button" href="#/plants/${plant.id}">View plant</a>
            <button class="button button-danger" type="button" data-delete-plant>Delete</button>
          </div>
        </div>
      </div>
      <details class="card-details">
        <summary>Edit plant</summary>
        <form data-edit-plant data-plant-id="${plant.id}">
          <label>
            <span>Name</span>
            <input name="name" required value="${escapeHtml(plant.name)}" />
          </label>
          <label>
            <span>Species</span>
            <input name="species" value="${escapeHtml(plant.species ?? "")}" />
          </label>
          <label>
            <span>Notes</span>
            <textarea name="notes">${escapeHtml(plant.notes ?? "")}</textarea>
          </label>
          <label>
            <span>Tags (comma separated)</span>
            <input name="tags" value="${escapeHtml(tags)}" />
          </label>
          <div class="card-actions">
            <button class="button" type="submit">Save plant</button>
          </div>
        </form>
      </details>
    </article>
  `;
}

function renderSkeleton() {
  return `
    <div class="skeleton-stack" aria-hidden="true">
      <span class="skeleton-line skeleton-line--lg"></span>
      <span class="skeleton-line skeleton-line--md"></span>
      <span class="skeleton-line skeleton-line--sm"></span>
    </div>
  `;
}

function skeletonPlantCard() {
  return `
    <article class="card skeleton-card" aria-hidden="true">
      <span class="skeleton-line skeleton-line--lg"></span>
      <span class="skeleton-line"></span>
      <span class="skeleton-line skeleton-line--sm"></span>
    </article>
  `;
}

export function renderVillageDetailView(root, villageId) {
  const vm = new VillageDetailThinVM(villageId);
  const container = document.createElement("div");
  container.className = "page";
  container.innerHTML = `
    <div class="page-header">
      <h2>Village</h2>
      <p class="muted">Review details and manage every plant in this village.</p>
    </div>
    <section class="card" data-header>
      <header class="card-header">
        <h3>Village details</h3>
        <button class="button button-danger" type="button" data-delete-village>
          Delete village
        </button>
      </header>
      <div data-village>${renderSkeleton()}</div>
      <details class="card-details">
        <summary>Edit village</summary>
        <form data-edit-village>
          <label>
            <span>Name</span>
            <input name="name" required />
          </label>
          <label>
            <span>Location</span>
            <input name="location" />
          </label>
          <label>
            <span>Description</span>
            <textarea name="description"></textarea>
          </label>
          <div class="card-actions">
            <button class="button" type="submit">Save village</button>
          </div>
        </form>
      </details>
      <p class="feedback" data-alert aria-live="polite"></p>
    </section>
    <section class="card">
      <h3>Add plant</h3>
      <form data-create-plant>
        <label>
          <span>Name</span>
          <input name="name" required />
        </label>
        <label>
          <span>Species</span>
          <input name="species" />
        </label>
        <label>
          <span>Notes</span>
          <textarea name="notes"></textarea>
        </label>
        <label>
          <span>Tags (comma separated)</span>
          <input name="tags" />
        </label>
        <button type="submit" class="button">Add plant</button>
      </form>
    </section>
    <section>
      <h3>Plants</h3>
      <div class="card-grid" data-plants aria-live="polite"></div>
    </section>
  `;
  root.replaceChildren(container);

  const villageContainer = container.querySelector("[data-village]");
  const plantsContainer = container.querySelector("[data-plants]");
  const createForm = container.querySelector("[data-create-plant]");
  const editVillageForm = container.querySelector("[data-edit-village]");
  const deleteVillageButton = container.querySelector("[data-delete-village]");
  const alert = container.querySelector("[data-alert]");

  let latestVillage = null;
  let latestPlants = [];

  function setAlert(message) {
    if (!message) {
      alert.textContent = "";
      alert.removeAttribute("role");
      return;
    }
    alert.textContent = message;
    alert.setAttribute("role", "alert");
  }

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(createForm);
    try {
      const result = await vm.createPlant({
        name: formData.get("name"),
        species: formData.get("species"),
        notes: formData.get("notes"),
        tags: (formData.get("tags") || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      });
      if (!result?.queued) {
        createForm.reset();
        setAlert("Plant added");
      } else {
        setAlert("Plant creation queued. We'll sync when you're online.");
      }
    } catch (error) {
      setAlert(error instanceof Error ? error.message : "Request failed");
    }
  });

  editVillageForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(editVillageForm);
    try {
      const result = await vm.updateVillage({
        name: formData.get("name"),
        location: formData.get("location"),
        description: formData.get("description"),
      });
      if (!result?.queued) {
        setAlert("Village updated");
      } else {
        setAlert("Update queued. Changes will sync once you're back online.");
      }
    } catch (error) {
      setAlert(error instanceof Error ? error.message : "Request failed");
    }
  });

  deleteVillageButton.addEventListener("click", async () => {
    if (!latestVillage) return;
    if (!window.confirm(`Delete ${latestVillage.name}?`)) {
      return;
    }
    try {
      const result = await vm.deleteVillage();
      if (!result?.queued) {
        setAlert("Village deleted");
        window.location.hash = "#/villages";
      } else {
        setAlert("Deletion queued. We'll remove it once you're back online.");
      }
    } catch (error) {
      setAlert(error instanceof Error ? error.message : "Request failed");
    }
  });

  plantsContainer.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!form.matches("form[data-edit-plant]")) return;
    event.preventDefault();
    const plantId = form.dataset.plantId;
    const formData = new FormData(form);
    try {
      const result = await vm.updatePlant(plantId, {
        name: formData.get("name"),
        species: formData.get("species"),
        notes: formData.get("notes"),
        tags: (formData.get("tags") || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      });
      if (!result?.queued) {
        const details = form.closest("details");
        if (details) details.open = false;
        setAlert("Plant updated");
      } else {
        setAlert("Update queued. We'll sync changes online.");
      }
    } catch (error) {
      setAlert(error instanceof Error ? error.message : "Request failed");
    }
  });

  plantsContainer.addEventListener("click", async (event) => {
    const button = event.target instanceof HTMLElement
      ? event.target.closest("[data-delete-plant]")
      : null;
    if (!button) return;
    const card = button.closest("[data-plant-id]");
    const plantId = card?.dataset.plantId;
    if (!plantId) return;
    const plant = latestPlants.find((item) => item.id === plantId);
    const name = plant?.name ?? "this plant";
    if (!window.confirm(`Delete ${name}?`)) {
      return;
    }
    try {
      const result = await vm.deletePlant(plantId);
      if (!result?.queued) {
        setAlert("Plant deleted");
      } else {
        setAlert("Deletion queued. We'll remove it once you're online.");
      }
    } catch (error) {
      setAlert(error instanceof Error ? error.message : "Request failed");
    }
  });

  vm.subscribe((state) => {
    if (state.notice) {
      setAlert(state.notice);
    } else if (state.error) {
      setAlert(state.error);
    } else {
      setAlert("");
    }
    if (state.loading) {
      villageContainer.innerHTML = renderSkeleton();
      plantsContainer.innerHTML = `${skeletonPlantCard()}${skeletonPlantCard()}`;
      return;
    }
    if (state.error) {
      villageContainer.innerHTML = `<p role="alert">${escapeHtml(state.error)}</p>`;
      plantsContainer.innerHTML = `<article class="card card--empty"><p role="alert">${escapeHtml(state.error)}</p></article>`;
      return;
    }
    const { village, plants } = state.data;
    latestVillage = village;
    latestPlants = plants;
    if (village) {
      villageContainer.innerHTML = `
        <p><strong>${escapeHtml(village.name)}</strong></p>
        <p class="muted">${escapeHtml(village.location ?? "")}</p>
        <p>${escapeHtml(village.description ?? "")}</p>
      `;
      editVillageForm.querySelector("[name=name]").value = village.name;
      editVillageForm.querySelector("[name=location]").value = village.location ?? "";
      editVillageForm.querySelector("[name=description]").value = village.description ?? "";
    }
    if (!plants.length) {
      plantsContainer.innerHTML = "<article class=\"card card--empty\"><p>No plants yet.</p></article>";
      return;
    }
    plantsContainer.innerHTML = plants.map(plantItem).join("");
  });

  vm.load();
}
