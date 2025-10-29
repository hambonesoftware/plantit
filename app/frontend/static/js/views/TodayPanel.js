import {api} from '../apiClient.js';
import {Calendar} from '../components/Calendar.js';
import {Store} from '../store.js';
import {refreshToday} from '../vm/dashboard.vm.js';

let container;
let unsubscribe;

function tasksFromState(state) {
  if (state.cache.today) {
    return state.cache.today.today;
  }
  if (state.cache.dashboard) {
    return state.cache.dashboard.today;
  }
  return [];
}

function optimisticComplete(task) {
  const previousDashboard = Store.state.cache.dashboard
    ? JSON.parse(JSON.stringify(Store.state.cache.dashboard))
    : null;
  const previousToday = Store.state.cache.today
    ? JSON.parse(JSON.stringify(Store.state.cache.today))
    : null;

  if (previousDashboard) {
    const updated = JSON.parse(JSON.stringify(previousDashboard));
    updated.today = updated.today.filter((item) => item.id !== task.id);
    const dotIndex = updated.calendar.dots.findIndex((dot) => dot.day === new Date(task.due_date).getDate());
    if (dotIndex >= 0) {
      updated.calendar.dots[dotIndex].count = Math.max(0, updated.calendar.dots[dotIndex].count - 1);
      if (updated.calendar.dots[dotIndex].count === 0) {
        updated.calendar.dots.splice(dotIndex, 1);
      }
    }
    const village = updated.villages.find((v) => v.id === task.village_id);
    if (village) {
      if (task.overdue_days > 0 && village.overdue > 0) {
        village.overdue -= 1;
      } else if (village.due_today > 0) {
        village.due_today -= 1;
      }
    }
    Store.setDashboard(updated);
  }

  if (previousToday) {
    Store.setToday({ today: previousToday.today.filter((item) => item.id !== task.id) });
  }

  return { previousDashboard, previousToday };
}

async function completeTask(task, checkbox) {
  const { previousDashboard, previousToday } = optimisticComplete(task);
  try {
    await api.post(`/api/tasks/${task.id}/complete`, {});
    await Promise.all([refreshDashboard(true), refreshToday(true)]);
  } catch (error) {
    if (previousDashboard) {
      Store.setDashboard(previousDashboard);
    }
    if (previousToday) {
      Store.setToday(previousToday);
    }
    checkbox.checked = false;
    alert(error instanceof Error ? error.message : 'Unable to complete task.');
  } finally {
    checkbox.disabled = false;
  }
}

function renderTasks(state) {
  const section = document.createElement('section');
  section.className = 'today-tasks';
  const list = document.createElement('div');
  list.className = 'today-list';
  const tasks = tasksFromState(state);

  if (!tasks.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'All caught up for today.';
    list.appendChild(empty);
  } else {
    for (const task of tasks) {
      const row = document.createElement('label');
      row.className = 'todo';
      row.innerHTML = `
        <input type="checkbox" data-id="${task.id}">
        <div>
          <div><strong>${task.plant_name}</strong> — ${task.kind}</div>
          <div class="meta">${task.village_name}${task.overdue_days > 0 ? ` · <span class="overdue">Overdue ${task.overdue_days}d</span>` : ''}</div>
        </div>
      `;
      const checkbox = row.querySelector('input');
      checkbox.addEventListener('change', async () => {
        checkbox.disabled = true;
        checkbox.checked = true;
        await completeTask(task, checkbox);
      });
      list.appendChild(row);
    }
  }

  section.appendChild(list);
  return section;
}

function renderCalendar(state) {
  const calendar = state.cache.dashboard?.calendar;
  if (!calendar) {
    return null;
  }
  const wrap = document.createElement('section');
  wrap.className = 'today-calendar';
  wrap.appendChild(Calendar(calendar));
  return wrap;
}

function render(state) {
  if (!container) {
    return;
  }
  container.innerHTML = '';

  const header = document.createElement('header');
  header.className = 'today-header';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'link-btn';
  toggle.textContent = state.prefs.todayCollapsed ? 'Expand' : 'Collapse';
  toggle.addEventListener('click', () => {
    Store.setTodayCollapsed(!state.prefs.todayCollapsed);
  });
  header.innerHTML = '<h3>Today</h3>';
  header.appendChild(toggle);
  container.appendChild(header);

  if (state.prefs.todayCollapsed) {
    return;
  }

  container.appendChild(renderTasks(state));
  const calendar = renderCalendar(state);
  if (calendar) {
    container.appendChild(calendar);
  }
}

export function initTodayPanel(node) {
  container = node;
  if (unsubscribe) {
    unsubscribe();
  }
  unsubscribe = Store.subscribe(render);
}
