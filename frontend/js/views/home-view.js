import { HomeThinVM } from "../thinvms/HomeThinVM.js";

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
    return "No recent activity";
  }
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "No recent activity";
  }
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (Math.abs(diffMinutes) < 1) {
    return "Just now";
  }
  if (Math.abs(diffMinutes) < 60) {
    return relativeTimeFormatter.format(diffMinutes, "minute");
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return relativeTimeFormatter.format(diffHours, "hour");
  }
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) {
    return relativeTimeFormatter.format(diffDays, "day");
  }
  const diffWeeks = Math.round(diffDays / 7);
  if (Math.abs(diffWeeks) < 5) {
    return relativeTimeFormatter.format(diffWeeks, "week");
  }
  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return relativeTimeFormatter.format(diffMonths, "month");
  }
  const diffYears = Math.round(diffDays / 365);
  return relativeTimeFormatter.format(diffYears, "year");
}

function renderVillageSummaries(summaries) {
  if (!summaries.length) {
    return "<p class=\"muted\">No villages yet. Create one to get started.</p>";
  }
  return `
    <div class="village-summary-grid">
      ${summaries
        .map((item, index) => {
          const activity = formatRelativeTime(item.last_activity);
          const activityLabel =
            activity === "No recent activity" ? activity : `Updated ${activity}`;
          const variant = (index % 3) + 1;
          return `
            <article class="village-summary-card village-summary-card--variant-${variant}" data-village-id="${item.id}">
              <div class="village-summary-card__media" aria-hidden="true"></div>
              <div class="village-summary-card__body">
                <div class="village-summary-card__meta">
                  <span class="chip chip--muted">${escapeHtml(activityLabel)}</span>
                  <span class="chip">${item.plant_total} ${
                    item.plant_total === 1 ? "plant" : "plants"
                  }</span>
                </div>
                <h3>${escapeHtml(item.name)}</h3>
                ${
                  item.location
                    ? `<p class="muted">${escapeHtml(item.location)}</p>`
                    : ""
                }
                <div class="village-summary-card__actions">
                  <a class="button button-ghost" href="#/villages/${item.id}">Open</a>
                  <a class="button button-text" href="#/villages">Quick add village</a>
                </div>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderRecentPlants(plants) {
  if (!plants.length) {
    return "<p class=\"muted\">No plants yet.</p>";
  }
  return `
    <ul class="tasks-list recent-list">
      ${plants
        .map((plant) => {
          const updated = formatRelativeTime(plant.updated_at ?? "");
          const updatedLabel =
            updated === "No recent activity" ? "No recent updates" : `Updated ${updated}`;
          return `
            <li>
              <div>
                <strong>${escapeHtml(plant.name)}</strong>
                <div class="muted">${escapeHtml(updatedLabel)}</div>
              </div>
              <a class="button button-text" href="#/plants/${plant.id}">View</a>
            </li>
          `;
        })
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
          ? `<ul class="tasks-list">${dueToday
              .map(
                (task) => `
                  <li>
                    <strong>${escapeHtml(task.title)}</strong>
                    <div class="muted">${escapeHtml(task.plant.name)}</div>
                    <div class="muted">Due ${escapeHtml(task.due_date)}</div>
                  </li>
                `,
              )
              .join("")}</ul>`
          : "<p class=\"muted\">Nothing due today.</p>"
      }
      ${
        overdueCount
          ? `<p class="warning">${overdueCount} overdue task${
              overdueCount === 1 ? "" : "s"
            }.</p>`
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

function renderCalendar(tasks) {
  const today = new Date();
  const monthLabel = today.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const leadingEmpty = startOfMonth.getDay();
  const todayIso = today.toISOString().slice(0, 10);
  const dueToday = new Set((tasks?.due_today ?? []).map((task) => task.due_date));
  const nextTaskDate = tasks?.next_task?.due_date ?? null;

  const cells = [];
  for (let index = 0; index < leadingEmpty; index += 1) {
    cells.push('<span class="calendar__cell calendar__cell--muted" aria-hidden="true"></span>');
  }

  for (let day = 1; day <= endOfMonth.getDate(); day += 1) {
    const current = new Date(today.getFullYear(), today.getMonth(), day);
    const iso = current.toISOString().slice(0, 10);
    const classes = ["calendar__cell"];
    if (iso === todayIso) {
      classes.push("calendar__cell--today");
    }
    if (dueToday.has(iso)) {
      classes.push("calendar__cell--due");
    }
    if (nextTaskDate === iso) {
      classes.push("calendar__cell--next");
    }
    const descriptors = [];
    if (iso === todayIso) descriptors.push("Today");
    if (dueToday.has(iso)) descriptors.push("Tasks due");
    if (nextTaskDate === iso) descriptors.push("Next task");
    const ariaLabel = `${current.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
    })}${descriptors.length ? ` – ${descriptors.join(", ")}` : ""}`;
    cells.push(`<span class="${classes.join(" ")}" aria-label="${ariaLabel}">${day}</span>`);
  }

  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    .map((label) => `<span>${label}</span>`)
    .join("");

  return `
    <div class="calendar" role="grid" aria-label="Calendar for ${monthLabel}">
      <div class="calendar__title">${monthLabel}</div>
      <div class="calendar__header" role="row">${weekdayLabels}</div>
      <div class="calendar__grid" role="rowgroup">${cells.join("")}</div>
    </div>
  `;
}

function renderStatsSkeleton() {
  return `
    <div class="stat-grid" aria-hidden="true">
      <div class="stat-card">
        <span class="skeleton-line skeleton-line--lg"></span>
        <span class="skeleton-line skeleton-line--sm"></span>
      </div>
      <div class="stat-card">
        <span class="skeleton-line skeleton-line--lg"></span>
        <span class="skeleton-line skeleton-line--sm"></span>
      </div>
    </div>
  `;
}

function renderVillageSkeleton() {
  return `
    <div class="village-summary-grid" aria-hidden="true">
      ${Array.from({ length: 3 })
        .map(
          () => `
            <article class="village-summary-card">
              <div class="skeleton-stack">
                <span class="skeleton-line skeleton-line--lg"></span>
                <span class="skeleton-line"></span>
                <span class="skeleton-line skeleton-line--sm"></span>
              </div>
            </article>
          `,
        )
        .join("")}
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

function renderCalendarSkeleton() {
  return `
    <div class="skeleton-stack" aria-hidden="true">
      <span class="skeleton-line skeleton-line--md"></span>
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
    <div class="page-header page-header--split">
      <div>
        <h2>Villages</h2>
        <p class="muted">Keep an eye on every growing space and what needs care today.</p>
      </div>
      <a class="button button-primary" href="#/villages">New village</a>
    </div>
    <div class="dashboard-grid">
      <div class="dashboard-main">
        <section class="card">
          <h3 class="sr-only">Totals</h3>
          <div data-stats aria-live="polite">${renderStatsSkeleton()}</div>
        </section>
        <section class="card" data-section="villages">
          <div class="section-heading">
            <h3>Villages</h3>
            <a class="button button-ghost" href="#/villages">Manage villages</a>
          </div>
          <div data-village-summaries aria-live="polite">${renderVillageSkeleton()}</div>
        </section>
        <section class="card" data-section="plants">
          <div class="section-heading">
            <h3>Recent plants</h3>
          </div>
          <div data-recent-plants aria-live="polite">${renderPanelSkeleton()}</div>
        </section>
      </div>
      <aside class="dashboard-sidebar">
        <section class="card today-card" data-section="tasks">
          <div class="section-heading">
            <h3>Today</h3>
          </div>
          <div data-tasks aria-live="polite">${renderPanelSkeleton()}</div>
          <div data-calendar aria-live="polite">${renderCalendarSkeleton()}</div>
        </section>
        <section class="card">
          <h3>Data</h3>
          <div class="card-actions">
            <button class="button button-ghost" type="button">Export</button>
            <button class="button button-ghost" type="button">Import</button>
          </div>
        </section>
      </aside>
    </div>
  `;
  root.replaceChildren(container);

  const statsContainer = container.querySelector("[data-stats]");
  const villagesContainer = container.querySelector("[data-village-summaries]");
  const recentContainer = container.querySelector("[data-recent-plants]");
  const tasksContainer = container.querySelector("[data-tasks]");
  const calendarContainer = container.querySelector("[data-calendar]");

  vm.subscribe((state) => {
    if (state.loading) {
      statsContainer.innerHTML = renderStatsSkeleton();
      villagesContainer.innerHTML = renderVillageSkeleton();
      recentContainer.innerHTML = renderPanelSkeleton();
      tasksContainer.innerHTML = renderPanelSkeleton();
      calendarContainer.innerHTML = renderCalendarSkeleton();
      return;
    }

    if (state.error) {
      const message = `<p role="alert" class="warning">${escapeHtml(state.error)}</p>`;
      statsContainer.innerHTML = message;
      villagesContainer.innerHTML = message;
      recentContainer.innerHTML = message;
      tasksContainer.innerHTML = message;
      calendarContainer.innerHTML = renderCalendarSkeleton();
      return;
    }

    if (!state.data) {
      const message = "<p class=\"muted\">No data yet.</p>";
      statsContainer.innerHTML = message;
      villagesContainer.innerHTML = message;
      recentContainer.innerHTML = message;
      tasksContainer.innerHTML = message;
      calendarContainer.innerHTML = renderCalendarSkeleton();
      return;
    }

    const { villages, plants, tasks } = state.data;
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
    villagesContainer.innerHTML = renderVillageSummaries(villages.summaries ?? []);
    recentContainer.innerHTML = renderRecentPlants(plants.recent ?? []);
    tasksContainer.innerHTML = renderTasksContent(tasks);
    calendarContainer.innerHTML = renderCalendar(tasks);
  });

  vm.load();
}
