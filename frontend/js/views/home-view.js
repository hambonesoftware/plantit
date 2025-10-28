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

function renderTasksContent(tasks) {
  if (!tasks) {
    return "<p class=\"muted\">No tasks tracked.</p>";
  }
  const dueToday = tasks.due_today ?? [];
  const overdueCount = tasks.overdue_count ?? 0;
  const nextTask = tasks.next_task ?? null;
  return `
    <div class="stacked-text">
      <h4>Due today</h4>
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

function renderStatsSkeleton() {
  return `
    <div class="stat-grid" aria-hidden="true">
      <div class="stat-card"><span class="skeleton-line skeleton-line--lg"></span></div>
      <div class="stat-card"><span class="skeleton-line skeleton-line--lg"></span></div>
    </div>
  `;
}

function renderPanelSkeleton() {
  return `
    <div class="skeleton-stack" aria-hidden="true">
      <span class="skeleton-line"></span>
      <span class="skeleton-line"></span>
      <span class="skeleton-line"></span>
    </div>
  `;
}

export function renderHomeView(root) {
  const vm = new HomeThinVM();
  const container = document.createElement("div");
  container.className = "page";
  container.innerHTML = `
    <div class="page-header">
      <h2>Overview</h2>
      <p class="muted">Monitor activity across your villages and plants.</p>
    </div>
    <section class="card">
      <h3>Totals</h3>
      <div data-stats aria-live="polite">${renderStatsSkeleton()}</div>
    </section>
    <div class="card-grid">
      <section class="card" data-panel="villages">
        <h3>Village activity</h3>
        <div data-panel-content>${renderPanelSkeleton()}</div>
      </section>
      <section class="card" data-panel="plants">
        <h3>Recent plants</h3>
        <div data-panel-content>${renderPanelSkeleton()}</div>
      </section>
      <section class="card" data-panel="tasks">
        <h3>Tasks</h3>
        <div data-panel-content>${renderPanelSkeleton()}</div>
      </section>
    </div>
  `;
  root.replaceChildren(container);

  const statsContainer = container.querySelector("[data-stats]");
  const villagePanel = container.querySelector('[data-panel="villages"] [data-panel-content]');
  const plantPanel = container.querySelector('[data-panel="plants"] [data-panel-content]');
  const tasksPanel = container.querySelector('[data-panel="tasks"] [data-panel-content]');

  vm.subscribe((state) => {
    if (state.loading) {
      statsContainer.innerHTML = renderStatsSkeleton();
      villagePanel.innerHTML = renderPanelSkeleton();
      plantPanel.innerHTML = renderPanelSkeleton();
      tasksPanel.innerHTML = renderPanelSkeleton();
      return;
    }
    if (state.error) {
      const message = `<p role="alert">${escapeHtml(state.error)}</p>`;
      statsContainer.innerHTML = message;
      villagePanel.innerHTML = message;
      plantPanel.innerHTML = message;
      tasksPanel.innerHTML = message;
      return;
    }
    if (!state.data) {
      const message = "<p class=\"muted\">No data yet.</p>";
      statsContainer.innerHTML = message;
      villagePanel.innerHTML = message;
      plantPanel.innerHTML = message;
      tasksPanel.innerHTML = message;
      return;
    }
    const { villages, plants, tasks } = state.data;
    const summaries = renderVillageSummaries(villages.summaries ?? []);
    const recent = renderRecentPlants(plants.recent ?? []);
    const tasksMarkup = renderTasksContent(tasks);
    statsContainer.innerHTML = `
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
    `;
    villagePanel.innerHTML = summaries;
    plantPanel.innerHTML = recent;
    tasksPanel.innerHTML = tasksMarkup;
  });

  vm.load();
}
