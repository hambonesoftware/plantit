import { HomeThinVM } from "../thinvms/HomeThinVM.js";

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderVillageSummaries(summaries) {
  if (!summaries.length) {
    return "<p class=\"muted\">No villages yet.</p>";
  }
  return `
    <ul class="list-plain">
      ${summaries
        .map(
          (item) => `
            <li>
              <strong>${escapeHtml(item.name)}</strong>
              <span class="muted">${escapeHtml(item.location ?? "")}</span>
              <div class="muted">${item.plant_total} plants • Last activity ${
                item.last_activity ? escapeHtml(item.last_activity) : "n/a"
              }</div>
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
}

function renderRecentPlants(plants) {
  if (!plants.length) {
    return "<p class=\"muted\">No plants yet.</p>";
  }
  return `
    <ul class="list-plain">
      ${plants
        .map(
          (plant) => `
            <li>
              <strong>${escapeHtml(plant.name)}</strong>
              <span class="muted">Updated ${escapeHtml(plant.updated_at ?? "")}</span>
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
}

function renderTasks(tasks) {
  if (!tasks) {
    return "<p class=\"muted\">No tasks tracked.</p>";
  }
  const dueToday = tasks.due_today ?? [];
  const overdueCount = tasks.overdue_count ?? 0;
  const nextTask = tasks.next_task ?? null;
  return `
    <div>
      <h3>Tasks due today</h3>
      ${
        dueToday.length
          ? `<ul class="list-plain">${dueToday
              .map(
                (task) => `
                  <li>
                    <strong>${escapeHtml(task.title)}</strong>
                    <span class="muted">${escapeHtml(task.due_date)}</span>
                    <div class="muted">${escapeHtml(task.plant.name)}</div>
                  </li>
                `,
              )
              .join("")}</ul>`
          : "<p class=\"muted\">Nothing due today.</p>"
      }
      ${
        overdueCount
          ? `<p class="warning">${overdueCount} overdue task${overdueCount === 1 ? "" : "s"}.</p>`
          : ""
      }
      ${
        nextTask
          ? `<p class="muted">Next upcoming: <strong>${escapeHtml(
              nextTask.title,
            )}</strong> on ${escapeHtml(nextTask.due_date)}</p>`
          : ""
      }
    </div>
  `;
}

export function renderHomeView(root) {
  const vm = new HomeThinVM();
  const section = document.createElement("section");
  section.className = "card";
  section.innerHTML = `
    <h2>Overview</h2>
    <div data-state="content">
      <p>Loading...</p>
    </div>
  `;
  root.replaceChildren(section);

  const content = section.querySelector('[data-state="content"]');

  vm.subscribe((state) => {
    if (state.loading) {
      content.innerHTML = "<p>Loading...</p>";
      return;
    }
    if (state.error) {
      content.innerHTML = `<p role="alert">${state.error}</p>`;
      return;
    }
    const { villages, plants, tasks } = state.data;
    const summaries = renderVillageSummaries(villages.summaries ?? []);
    const recent = renderRecentPlants(plants.recent ?? []);
    const tasksMarkup = renderTasks(tasks);
    content.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card">
          <span class="stat-count">${villages.total}</span>
          <span class="stat-label">Villages</span>
        </div>
        <div class="stat-card">
          <span class="stat-count">${plants.total}</span>
          <span class="stat-label">Plants</span>
        </div>
      </div>
      <div class="home-layout">
        <section>
          <h3>Village activity</h3>
          ${summaries}
        </section>
        <section>
          <h3>Recent plants</h3>
          ${recent}
        </section>
        <section>
          ${tasksMarkup}
        </section>
      </div>
    `;
  });

  vm.load();
}
