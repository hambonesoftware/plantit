import { VillageDetailThinVM } from "../thinvms/VillageDetailThinVM.js";

function plantItem(plant) {
  return `
    <article class="card">
      <h3>${plant.name}</h3>
      <p>${plant.species ?? ""}</p>
      <p>${plant.notes ?? ""}</p>
      <p>Tags: ${(plant.tags || []).join(", ")}</p>
      <a class="button" href="#/plants/${plant.id}">View plant</a>
    </article>
  `;
}

export function renderVillageDetailView(root, villageId) {
  const vm = new VillageDetailThinVM(villageId);
  const container = document.createElement("div");
  container.innerHTML = `
    <section class="card" data-header>
      <h2>Village</h2>
      <div data-village>Loading...</div>
    </section>
    <section class="card">
      <h3>Add plant</h3>
      <form data-form>
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
    <section data-plants></section>
  `;
  root.replaceChildren(container);

  const villageContainer = container.querySelector("[data-village]");
  const plantsContainer = container.querySelector("[data-plants]");
  const form = container.querySelector("[data-form]");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    await vm.createPlant({
      name: formData.get("name"),
      species: formData.get("species"),
      notes: formData.get("notes"),
      tags: (formData.get("tags") || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    });
    form.reset();
  });

  vm.subscribe((state) => {
    if (state.loading) {
      villageContainer.innerHTML = "<p>Loading village...</p>";
      plantsContainer.innerHTML = "";
      return;
    }
    if (state.error) {
      villageContainer.innerHTML = `<p role="alert">${state.error}</p>`;
      plantsContainer.innerHTML = "";
      return;
    }
    const { village, plants } = state.data;
    villageContainer.innerHTML = `
      <p><strong>${village?.name ?? ""}</strong></p>
      <p>${village?.location ?? ""}</p>
      <p>${village?.description ?? ""}</p>
    `;
    if (!plants.length) {
      plantsContainer.innerHTML = "<p>No plants yet.</p>";
      return;
    }
    plantsContainer.innerHTML = plants.map(plantItem).join("");
  });

  vm.load();
}
