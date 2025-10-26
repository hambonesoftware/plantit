function formatDateLabel(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatWeekday(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

export function createTodayPanel(vm) {
  const container = document.createElement("section");
  container.className = "today-panel";
  container.innerHTML = `
    <header>
      <h2>Today</h2>
      <p class="today-panel__subtitle">Check off your plant care tasks.</p>
    </header>
    <div class="today-panel__list" role="list"></div>
    <div class="today-panel__empty" hidden>
      <p>No tasks due today. Enjoy the greenery!</p>
    </div>
    <section class="today-panel__calendar" aria-label="Upcoming tasks calendar">
      <h3>Upcoming</h3>
      <div class="today-panel__calendar-grid"></div>
    </section>
    <footer class="today-panel__footer">
      <a href="#/settings" class="today-panel__link">Export data</a>
      <a href="#/settings" class="today-panel__link">Import data</a>
    </footer>
  `;

  const listEl = container.querySelector(".today-panel__list");
  const emptyState = container.querySelector(".today-panel__empty");
  const calendarGrid = container.querySelector(".today-panel__calendar-grid");

  const unsubscribe = vm.subscribe((state) => {
    renderTasks(state);
    renderCalendar(state);
  });

  function renderTasks(state) {
    listEl.replaceChildren();
    if (state.today.length === 0) {
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;
    state.today.forEach((task) => {
      const item = document.createElement("div");
      item.className = "today-panel__item";
      item.setAttribute("role", "listitem");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.setAttribute("aria-label", `Complete ${task.title}`);
      checkbox.dataset.taskId = String(task.id);
      checkbox.disabled = state.pending.tasks.includes(task.id);

      const label = document.createElement("label");
      label.className = "today-panel__item-label";
      label.appendChild(document.createTextNode(task.title));
      if (task.due_date) {
        const due = document.createElement("span");
        due.className = "today-panel__item-due";
        const dueDate = new Date(task.due_date);
        due.textContent = dueDate.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        label.appendChild(due);
      }
      const meta = document.createElement("span");
      meta.className = "today-panel__item-meta";
      meta.textContent = `${task.plant.name} • ${task.village.name}`;
      label.appendChild(meta);

      item.appendChild(checkbox);
      item.appendChild(label);
      listEl.appendChild(item);
    });
  }

  function renderCalendar(state) {
    const window = vm.getCalendarWindow(14);
    calendarGrid.replaceChildren();
    window.forEach((entry) => {
      const day = document.createElement("div");
      day.className = "today-panel__calendar-day";
      const count = state.calendar.find((bucket) => bucket.date === entry.date)?.count ?? 0;
      day.dataset.count = String(count);
      if (count > 0) {
        day.classList.add("today-panel__calendar-day--active");
      }
      const ariaLabel = `${formatWeekday(entry.date)} ${formatDateLabel(entry.date)}${count > 0 ? ` – ${count} tasks` : " – no tasks"}`;
      day.setAttribute("aria-label", ariaLabel);
      const weekday = document.createElement("span");
      weekday.className = "today-panel__calendar-weekday";
      weekday.textContent = formatWeekday(entry.date);
      const label = document.createElement("span");
      label.className = "today-panel__calendar-label";
      label.textContent = formatDateLabel(entry.date);
      const dot = document.createElement("span");
      dot.className = "today-panel__calendar-dot";
      dot.setAttribute("aria-hidden", "true");
      day.appendChild(weekday);
      day.appendChild(label);
      day.appendChild(dot);
      calendarGrid.appendChild(day);
    });
  }

  container.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") {
      return;
    }
    const id = Number.parseInt(target.dataset.taskId ?? "", 10);
    if (Number.isNaN(id)) {
      return;
    }
    target.disabled = true;
    vm.completeTask(id).catch((error) => {
      console.error("Failed to complete task", error);
      target.checked = false;
      target.disabled = false;
    });
  });

  return {
    element: container,
    destroy() {
      unsubscribe();
    },
  };
}
