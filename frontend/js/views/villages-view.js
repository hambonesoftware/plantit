import { VillagesThinVM } from "../thinvms/VillagesThinVM.js";

function villageCard(village) {
  return `
    <article class="card">
      <h3>${village.name}</h3>
      <p>${village.location ?? ""}</p>
      <p>${village.description ?? ""}</p>
      <a class="button" href="#/villages/${village.id}">View details</a>
    </article>
  `;
}

export function renderVillagesView(root) {
  const vm = new VillagesThinVM();
  const container = document.createElement("div");
  container.innerHTML = `
    <section class="card">
      <h2>Add Village</h2>
      <form data-form>
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
        <button class="button" type="submit">Create village</button>
      </form>
    </section>
    <section data-list></section>
  `;
  root.replaceChildren(container);

  const form = container.querySelector("[data-form]");
  const list = container.querySelector("[data-list]");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    await vm.createVillage({
      name: formData.get("name"),
      location: formData.get("location"),
      description: formData.get("description"),
    });
    form.reset();
    list.scrollIntoView({ behavior: "smooth" });
  });

  vm.subscribe((state) => {
    if (state.loading) {
      list.innerHTML = "<p>Loading villages...</p>";
      return;
    }
    if (state.error) {
      list.innerHTML = `<p role="alert">${state.error}</p>`;
      return;
    }
    if (!state.data.villages.length) {
      list.innerHTML = "<p>No villages yet. Add one above!</p>";
      return;
    }
    list.innerHTML = state.data.villages.map(villageCard).join("");
  });

  vm.load();
}
