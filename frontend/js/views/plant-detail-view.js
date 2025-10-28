import { PlantDetailThinVM } from "../thinvms/PlantDetailThinVM.js";

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderPhotos(photos, plantName) {
  if (!photos.length) {
    return "<p>No photos yet.</p>";
  }
  return `
    <div class="photo-grid">
      ${photos
        .map(
          (photo) => `
            <figure class="photo-card" data-photo-id="${photo.id}">
              <a href="${photo.original_url}" target="_blank" rel="noopener">
                <img src="${photo.thumbnail_url}" alt="Photo of ${escapeHtml(plantName)}" />
              </a>
              <figcaption class="muted">${Math.round(photo.width)}×${Math.round(photo.height)}</figcaption>
              <button class="button button-danger" type="button" data-delete-photo>Remove</button>
            </figure>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderCareProfiles(profiles) {
  if (!profiles.length) {
    return "<p class=\"muted\">No care profiles yet.</p>";
  }
  return `
    <ul class="list-plain">
      ${profiles
        .map(
          (profile) => `
            <li>
              <strong>${escapeHtml(profile.title)}</strong>
              <div class="muted">Cadence: ${escapeHtml(profile.cadence.type)}</div>
              <div class="muted">Next due: ${escapeHtml(profile.next_due_date ?? "n/a")}</div>
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
}

function renderPendingTasks(tasks) {
  if (!tasks.length) {
    return "<p class=\"muted\">No pending tasks.</p>";
  }
  return `
    <ul class="list-plain">
      ${tasks
        .map(
          (task) => `
            <li>
              <strong>${escapeHtml(task.title)}</strong>
              <span class="muted">Due ${escapeHtml(task.due_date)}</span>
            </li>
          `,
        )
        .join("")}
    </ul>
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

export function renderPlantDetailView(root, plantId) {
  const vm = new PlantDetailThinVM(plantId);
  const container = document.createElement("div");
  container.innerHTML = `
    <section class="card" data-plant-card>
      <header class="card-header">
        <h2>Plant</h2>
        <button class="button button-danger" type="button" data-delete-plant>
          Delete plant
        </button>
      </header>
      <div data-content>${renderSkeleton()}</div>
      <details class="card-details">
        <summary>Edit plant</summary>
        <form data-edit-plant>
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
          <div class="card-actions">
            <button class="button" type="submit">Save plant</button>
          </div>
        </form>
      </details>
      <p class="feedback" data-alert aria-live="polite"></p>
    </section>
    <section class="card" data-photos-card>
      <h3>Photos</h3>
      <form data-upload-photo>
        <label class="file-input">
          <span>Upload photo</span>
          <input name="photo" type="file" accept="image/*" required />
        </label>
        <button class="button" type="submit">Upload</button>
      </form>
      <div data-photo-list></div>
    </section>
  `;
  root.replaceChildren(container);

  const content = container.querySelector("[data-content]");
  const editForm = container.querySelector("[data-edit-plant]");
  const deleteButton = container.querySelector("[data-delete-plant]");
  const alert = container.querySelector("[data-alert]");
  const uploadForm = container.querySelector("[data-upload-photo]");
  const photoList = container.querySelector("[data-photo-list]");

  let latestPlant = null;

  function setAlert(message) {
    if (!message) {
      alert.textContent = "";
      alert.removeAttribute("role");
      return;
    }
    alert.textContent = message;
    alert.setAttribute("role", "alert");
  }

  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(editForm);
    try {
      const result = await vm.updatePlant({
        name: formData.get("name"),
        species: formData.get("species"),
        notes: formData.get("notes"),
        tags: (formData.get("tags") || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      });
      if (!result?.queued) {
        setAlert("Plant updated");
      } else {
        setAlert("Update queued. We'll sync when you're online.");
      }
    } catch (error) {
      setAlert(error instanceof Error ? error.message : "Request failed");
    }
  });

  deleteButton.addEventListener("click", async () => {
    if (!latestPlant) return;
    if (!window.confirm(`Delete ${latestPlant.name}?`)) {
      return;
    }
    try {
      const villageId = await vm.deletePlant();
      if (villageId) {
        setAlert("Plant deleted");
        window.location.hash = `#/villages/${villageId}`;
      } else if (villageId === null) {
        setAlert("Deletion queued. We'll remove it once you're online.");
      }
    } catch (error) {
      setAlert(error instanceof Error ? error.message : "Request failed");
    }
  });

  uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fileInput = uploadForm.querySelector("input[name=photo]");
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const result = await vm.addPhoto(file);
      if (!result?.queued) {
        uploadForm.reset();
        setAlert("Photo uploaded");
      } else {
        setAlert("Photo upload requires a connection. We'll retry online.");
      }
    } catch (error) {
      setAlert(error instanceof Error ? error.message : "Request failed");
    }
  });

  photoList.addEventListener("click", async (event) => {
    const button = event.target instanceof HTMLElement
      ? event.target.closest("[data-delete-photo]")
      : null;
    if (!button) return;
    const photoId = button.closest("[data-photo-id]")?.dataset.photoId;
    if (!photoId) return;
    try {
      const result = await vm.removePhoto(photoId);
      if (!result?.queued) {
        setAlert("Photo removed");
      } else {
        setAlert("Photo deletion queued. We'll sync once online.");
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
    }

    if (state.loading) {
      content.innerHTML = renderSkeleton();
      photoList.innerHTML = "";
      return;
    }
    if (state.error) {
      content.innerHTML = `<p role="alert">${escapeHtml(state.error)}</p>`;
      photoList.innerHTML = "";
      return;
    }
    const plantData = state.data.plant;
    latestPlant = plantData;
    if (!plantData) {
      content.innerHTML = "<p>Plant not found.</p>";
      photoList.innerHTML = "";
      return;
    }
    editForm.querySelector("[name=name]").value = plantData.name;
    editForm.querySelector("[name=species]").value = plantData.species ?? "";
    editForm.querySelector("[name=notes]").value = plantData.notes ?? "";
    editForm.querySelector("[name=tags]").value = (plantData.tags || []).join(", ");

    content.innerHTML = `
      <div>
        <p><strong>${escapeHtml(plantData.name)}</strong></p>
        <p class="muted">${escapeHtml(plantData.species ?? "")}</p>
        <p>${escapeHtml(plantData.notes ?? "")}</p>
        <p class="muted">Tags: ${escapeHtml((plantData.tags || []).join(", "))}</p>
      </div>
      <section>
        <h3>Care profiles</h3>
        ${renderCareProfiles(plantData.care_profiles ?? [])}
      </section>
      <section>
        <h3>Pending tasks</h3>
        ${renderPendingTasks(plantData.pending_tasks ?? [])}
      </section>
    `;
    photoList.innerHTML = renderPhotos(plantData.photos ?? [], plantData.name);
  });

  vm.load();
}
