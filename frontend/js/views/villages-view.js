import { VillagesThinVM } from "../thinvms/VillagesThinVM.js";

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatRelativeTime(isoValue) {
  if (!isoValue) {
    return "Updated just now";
  }
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "Updated just now";
  }
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (Math.abs(diffMinutes) < 1) {
    return "Updated just now";
  }
  if (Math.abs(diffMinutes) < 60) {
    return `Updated ${relativeTimeFormatter.format(diffMinutes, "minute")}`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return `Updated ${relativeTimeFormatter.format(diffHours, "hour")}`;
  }
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) {
    return `Updated ${relativeTimeFormatter.format(diffDays, "day")}`;
  }
  const diffWeeks = Math.round(diffDays / 7);
  if (Math.abs(diffWeeks) < 5) {
    return `Updated ${relativeTimeFormatter.format(diffWeeks, "week")}`;
  }
  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return `Updated ${relativeTimeFormatter.format(diffMonths, "month")}`;
  }
  const diffYears = Math.round(diffDays / 365);
  return `Updated ${relativeTimeFormatter.format(diffYears, "year")}`;
}

function villageCard(village) {
  const description = village.description
    ? `<p>${escapeHtml(village.description)}</p>`
    : "";
  const location = village.location
    ? `<p class="muted">${escapeHtml(village.location)}</p>`
    : "";
  const updatedLabel = formatRelativeTime(village.updated_at);
  return `
    <article class="card village-card" data-village-id="${village.id}">
      <div class="village-card__media" aria-hidden="true"></div>
      <div class="village-card__header">
        <div>
          <h3>${escapeHtml(village.name)}</h3>
          ${location}
        </div>
        <div class="village-card__meta">
          <span class="chip chip--muted">${escapeHtml(updatedLabel)}</span>
        </div>
      </div>
      ${description}
      <div class="village-card__actions">
        <a class="button button-ghost" href="#/villages/${village.id}">Open</a>
        <button class="button button-danger" type="button" data-delete-village>
          Delete
        </button>
      </div>
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
    <article class="card village-card skeleton-card" aria-hidden="true">
      <div class="village-card__media" aria-hidden="true"></div>
      <span class="skeleton-line skeleton-line--lg"></span>
      <span class="skeleton-line"></span>
      <span class="skeleton-line skeleton-line--sm"></span>
    </article>
  `;
}

export function renderVillagesView(root) {
  const vm = new VillagesThinVM();
  const container = document.createElement("div");
  container.className = "page";
  container.innerHTML = `
    <div class="page-header page-header--split">
      <div>
        <h2>Villages</h2>
        <p class="muted">Design every growing space and keep track of their story.</p>
      </div>
      <button class="button button-primary" type="button" data-scroll-to-form>New village</button>
    </div>
    <div class="villages-layout">
      <section class="card" id="create-village">
        <h3>Add village</h3>
        <p class="muted">Capture the basics so you can start planting right away.</p>
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
          <button class="button button-primary" type="submit">Create village</button>
        </form>
        <p class="feedback" data-alert aria-live="polite"></p>
      </section>
      <section class="card">
        <div class="section-heading">
          <h3>All villages</h3>
          <p class="muted">Open a village to add plants, notes, and photos.</p>
        </div>
        <div class="village-collection" data-list aria-live="polite"></div>
      </section>
    </div>
  `;
  root.replaceChildren(container);

  const form = container.querySelector("[data-form]");
  const list = container.querySelector("[data-list]");
  const alert = container.querySelector("[data-alert]");
  const scrollButton = container.querySelector("[data-scroll-to-form]");

  if (scrollButton) {
    scrollButton.addEventListener("click", () => {
      form.scrollIntoView({ behavior: "smooth" });
      const firstInput = form.querySelector("input[name='name']");
      if (firstInput instanceof HTMLElement) {
        firstInput.focus({ preventScroll: true });
      }
    });
  }

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
