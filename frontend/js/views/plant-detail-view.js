import { PlantDetailThinVM } from "../thinvms/PlantDetailThinVM.js";

export function renderPlantDetailView(root, plantId) {
  const vm = new PlantDetailThinVM(plantId);
  const container = document.createElement("section");
  container.className = "card";
  container.innerHTML = `
    <h2>Plant</h2>
    <div data-content>Loading...</div>
  `;
  root.replaceChildren(container);

  const content = container.querySelector("[data-content]");

  vm.subscribe((state) => {
    if (state.loading) {
      content.innerHTML = "<p>Loading plant...</p>";
      return;
    }
    if (state.error) {
      content.innerHTML = `<p role="alert">${state.error}</p>`;
      return;
    }
    if (!state.data.plant) {
      content.innerHTML = "<p>Plant not found.</p>";
      return;
    }
    const plant = state.data.plant;
    content.innerHTML = `
      <p><strong>${plant.name}</strong></p>
      <p>${plant.species ?? ""}</p>
      <p>${plant.notes ?? ""}</p>
      <p>Tags: ${(plant.tags || []).join(", ")}</p>
      <a class="button" href="#/villages/${plant.village_id}">Back to village</a>
    `;
  });

  vm.load();
}
