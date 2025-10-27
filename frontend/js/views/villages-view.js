import { VillagesThinVM } from "../thinvms/VillagesThinVM.js";

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function villageCard(village) {
  const description = village.description
    ? `<p class="muted">${escapeHtml(village.description)}</p>`
    : "";
  const location = village.location
    ? `<p class="muted">${escapeHtml(village.location)}</p>`
    : "";
  return `
    <article class="card" data-village-id="${village.id}">
      <header class="card-header">
        <div>
          <h3>${escapeHtml(village.name)}</h3>
          ${location}
        </div>
        <div class="card-actions">
          <a class="button" href="#/villages/${village.id}">View details</a>
          <button class="button button-danger" type="button" data-delete-village>
            Delete
          </button>
        </div>
      </header>
      ${description}
      <details class="card-details">
        <summary>Edit village</summary>
        <form data-edit-village data-village-id="${village.id}">
          <label>
            <span>Name</span>
            <input name="name" required value="${escapeHtml(village.name)}" />
          </label>
          <label>
            <span>Location</span>
            <input name="location" value="${escapeHtml(village.location ?? "")}" />
          </label>
          <label>
            <span>Description</span>
            <textarea name="description">${escapeHtml(village.description ?? "")}</textarea>
          </label>
          <div class="card-actions">
            <button class="button" type="submit">Save changes</button>
          </div>
        </form>
      </details>
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
      <p class="feedback" data-alert aria-live="polite"></p>
    </section>
    <section data-list></section>
  `;
  root.replaceChildren(container);

  const form = container.querySelector("[data-form]");
  const list = container.querySelector("[data-list]");
  const alert = container.querySelector("[data-alert]");

  function setAlert(message) {
    if (!message) {
      alert.textContent = "";
      alert.removeAttribute("role");
      return;
    }
    alert.textContent = message;
    alert.setAttribute("role", "alert");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    try {
      await vm.createVillage({
        name: formData.get("name"),
        location: formData.get("location"),
        description: formData.get("description"),
      });
      form.reset();
      setAlert("Village created");
      list.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      setAlert(error instanceof Error ? error.message : "Request failed");
    }
  });

  list.addEventListener("submit", async (event) => {
    const formElement = event.target;
    if (!(formElement instanceof HTMLFormElement)) return;
    if (!formElement.matches("form[data-edit-village]")) return;
    event.preventDefault();
    const villageId = formElement.dataset.villageId;
    const formData = new FormData(formElement);
    try {
      await vm.updateVillage(villageId, {
        name: formData.get("name"),
        location: formData.get("location"),
        description: formData.get("description"),
      });
      const details = formElement.closest("details");
      if (details) details.open = false;
      setAlert("Village updated");
    } catch (error) {
      setAlert(error instanceof Error ? error.message : "Request failed");
    }
  });

  list.addEventListener("click", async (event) => {
    const button = event.target instanceof HTMLElement
      ? event.target.closest("[data-delete-village]")
      : null;
    if (!button) return;
    const card = button.closest("[data-village-id]");
    const villageId = card?.dataset.villageId;
    if (!villageId) return;
    const name = card.querySelector("h3")?.textContent ?? "this village";
    if (!window.confirm(`Delete ${name}?`)) {
      return;
    }
    try {
      await vm.deleteVillage(villageId);
      setAlert("Village deleted");
    } catch (error) {
      setAlert(error instanceof Error ? error.message : "Request failed");
    }
  });

  vm.subscribe((state) => {
    if (state.error) {
      setAlert(state.error);
    } else if (!state.loading) {
      setAlert("");
    }
    if (state.loading) {
      list.innerHTML = "<p>Loading villages...</p>";
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
