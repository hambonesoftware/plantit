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

function skeletonCard() {
  return `
    <article class="card skeleton-card">
      <div class="skeleton-line skeleton-line--lg"></div>
      <div class="skeleton-line skeleton-line--sm"></div>
      <div class="skeleton-line skeleton-line--md"></div>
    </article>
  `;
}

export function renderVillagesView(root) {
  const vm = new VillagesThinVM();
  const container = document.createElement("div");
  container.className = "page";
  container.innerHTML = `
    <div class="page-header">
      <h2>Villages</h2>
      <p class="muted">Create and update the growing spaces you care for.</p>
    </div>
    <section class="card">
      <h3>Add village</h3>
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
    <section>
      <h3>All villages</h3>
      <div class="card-grid" data-list aria-live="polite"></div>
    </section>
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
      const result = await vm.createVillage({
        name: formData.get("name"),
        location: formData.get("location"),
        description: formData.get("description"),
      });
      if (!result?.queued) {
        form.reset();
        setAlert("Village created");
        list.scrollIntoView({ behavior: "smooth" });
      } else {
        setAlert("Village queued. We'll sync it when you're back online.");
      }
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
      const result = await vm.updateVillage(villageId, {
        name: formData.get("name"),
        location: formData.get("location"),
        description: formData.get("description"),
      });
      if (!result?.queued) {
        const details = formElement.closest("details");
        if (details) details.open = false;
        setAlert("Village updated");
      } else {
        setAlert("Update queued. Changes will sync when you're online.");
      }
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
      const result = await vm.deleteVillage(villageId);
      if (!result?.queued) {
        setAlert("Village deleted");
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
    } else if (!state.loading) {
      setAlert("");
    }

    if (state.loading) {
      list.innerHTML = `${skeletonCard()}${skeletonCard()}`;
      return;
    }
    if (!state.data.villages.length) {
      list.innerHTML = "<article class=\"card card--empty\"><p>No villages yet. Add one above!</p></article>";
      return;
    }
    list.innerHTML = state.data.villages.map(villageCard).join("");
  });

  vm.load();
}
