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
      <div data-content>Loading...</div>
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
      await vm.updatePlant({
        name: formData.get("name"),
        species: formData.get("species"),
        notes: formData.get("notes"),
        tags: (formData.get("tags") || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      });
      setAlert("Plant updated");
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
      setAlert("Plant deleted");
      if (villageId) {
        window.location.hash = `#/villages/${villageId}`;
      } else {
        window.location.hash = "#/villages";
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
      await vm.addPhoto(file);
      uploadForm.reset();
      setAlert("Photo uploaded");
    } catch (error) {
      setAlert(error instanceof Error ? error.message : "Request failed");
    }
  });

  photoList.addEventListener("click", async (event) => {
    const button = event.target instanceof HTMLElement
      ? event.target.closest("[data-delete-photo]")
      : null;
    if (!button) return;
    const figure = button.closest("[data-photo-id]");
    const photoId = figure?.dataset.photoId;
    if (!photoId) return;
    if (!window.confirm("Remove this photo?")) {
      return;
    }
    try {
      await vm.removePhoto(photoId);
      setAlert("Photo removed");
    } catch (error) {
      setAlert(error instanceof Error ? error.message : "Request failed");
    }
  });

  vm.subscribe((state) => {
    if (state.loading) {
      content.innerHTML = "<p>Loading plant...</p>";
      photoList.innerHTML = "";
      return;
    }
    if (state.error) {
      content.innerHTML = `<p role="alert">${escapeHtml(state.error)}</p>`;
      photoList.innerHTML = "";
      setAlert(state.error);
      return;
    }
    if (!state.data.plant) {
      content.innerHTML = "<p>Plant not found.</p>";
      photoList.innerHTML = "";
      return;
    }
    const plant = state.data.plant;
    latestPlant = plant;
    const tags = (plant.tags || []).join(", ");
    content.innerHTML = `
      <p><strong>${escapeHtml(plant.name)}</strong></p>
      <p class="muted">${escapeHtml(plant.species ?? "")}</p>
      <p>${escapeHtml(plant.notes ?? "")}</p>
      <p class="muted">Tags: ${escapeHtml(tags)}</p>
      <a class="button" href="#/villages/${plant.village_id}">Back to village</a>
    `;
    editForm.querySelector("[name=name]").value = plant.name;
    editForm.querySelector("[name=species]").value = plant.species ?? "";
    editForm.querySelector("[name=notes]").value = plant.notes ?? "";
    editForm.querySelector("[name=tags]").value = tags;
    photoList.innerHTML = renderPhotos(plant.photos ?? [], plant.name);
    setAlert("");
  });

  vm.load();
}
