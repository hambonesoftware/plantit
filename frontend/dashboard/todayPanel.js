const TASK_TYPE_LABELS = {
  water: 'Water',
  fertilize: 'Fertilize',
  inspect: 'Inspect',
  transplant: 'Transplant',
};

const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

/**
 * Render and orchestrate the dashboard "Today" task panel.
 */
export class TodayPanel {
  /**
   * @param {HTMLElement} root
   * @param {import('./viewModel.js').TodayPanelViewModel} viewModel
   */
  constructor(root, viewModel) {
    this.root = root;
    this.viewModel = viewModel;

    this.placeholder = root.querySelector('[data-role="today-placeholder"]');
    this.loading = root.querySelector('[data-role="today-loading"]');
    this.content = root.querySelector('[data-role="today-content"]');
    this.listElement = root.querySelector('[data-role="today-task-list"]');
    this.emptyMessage = root.querySelector('[data-role="today-empty"]');
    this.errorPanel = root.querySelector('[data-role="today-error"]');
    this.errorMessage = root.querySelector('[data-role="today-error-message"]');
    this.retryButton = root.querySelector('[data-action="today-retry"]');
    this.refreshButton = root.querySelector('[data-action="today-refresh"]');
    this.updated = root.querySelector('[data-role="today-updated"]');

    if (this.refreshButton) {
      this.refreshButton.addEventListener('click', () => {
        this.viewModel.refresh();
      });
    }

    if (this.retryButton) {
      this.retryButton.addEventListener('click', () => {
        this.viewModel.retry();
      });
    }

    this.unsubscribe = this.viewModel.subscribe((state) => {
      this.render(state);
    });
  }

  /**
   * @param {import('./viewModel.js').TodayPanelState} state
   */
  render(state) {
    this.root.dataset.status = state.status;
    this.updateHeader(state);

    switch (state.status) {
      case 'idle':
        this.renderIdle();
        break;
      case 'loading':
        this.renderLoading(state);
        break;
      case 'ready':
        this.renderReady(state);
        break;
      case 'error':
        this.renderError(state);
        break;
      default:
        break;
    }
  }

  /**
   * @param {import('./viewModel.js').TodayPanelState} state
   */
  updateHeader(state) {
    if (this.updated) {
      if (state.lastUpdated) {
        this.updated.textContent = formatUpdated(state.lastUpdated);
      } else if (state.status === 'loading') {
        this.updated.textContent = 'Loading today\'s tasks…';
      } else {
        this.updated.textContent = 'Today\'s tasks not loaded yet';
      }
    }

    if (this.refreshButton) {
      this.refreshButton.disabled = state.status === 'loading';
    }
  }

  renderIdle() {
    if (this.placeholder) {
      this.placeholder.hidden = false;
    }
    if (this.loading) {
      this.loading.hidden = true;
    }
    if (this.content) {
      this.content.hidden = true;
    }
    if (this.errorPanel) {
      this.errorPanel.hidden = true;
    }
  }

  /**
   * @param {import('./viewModel.js').TodayPanelState} state
   */
  renderLoading(state) {
    const hasTasks = Array.isArray(state.tasks) && state.tasks.length > 0;
    if (this.placeholder) {
      this.placeholder.hidden = hasTasks;
    }
    if (this.loading) {
      this.loading.hidden = false;
    }
    if (this.errorPanel) {
      this.errorPanel.hidden = true;
    }
    if (this.content) {
      this.content.hidden = !hasTasks;
    }
  }

  /**
   * @param {import('./viewModel.js').TodayPanelState} state
   */
  renderReady(state) {
    if (this.placeholder) {
      this.placeholder.hidden = true;
    }
    if (this.loading) {
      this.loading.hidden = true;
    }
    if (this.errorPanel) {
      this.errorPanel.hidden = true;
    }
    if (this.content) {
      this.content.hidden = false;
    }

    if (!this.listElement || !this.emptyMessage) {
      return;
    }

    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    if (tasks.length === 0) {
      this.listElement.hidden = true;
      this.listElement.replaceChildren();
      this.emptyMessage.hidden = false;
      this.emptyMessage.textContent = state.emptyMessage || 'No tasks scheduled for today.';
      return;
    }

    const items = tasks.map((task) => createTaskListItem(task));
    this.listElement.hidden = false;
    this.emptyMessage.hidden = true;
    this.listElement.replaceChildren(...items);
  }

  /**
   * @param {import('./viewModel.js').TodayPanelState} state
   */
  renderError(state) {
    const hasTasks = Array.isArray(state.tasks) && state.tasks.length > 0;
    if (this.loading) {
      this.loading.hidden = true;
    }
    if (this.placeholder) {
      this.placeholder.hidden = hasTasks;
    }
    if (this.content) {
      this.content.hidden = !hasTasks;
    }
    if (this.errorPanel) {
      this.errorPanel.hidden = false;
    }
    if (this.errorMessage) {
      this.errorMessage.textContent = state.error?.message ?? 'Unable to load today\'s tasks.';
    }
  }
}

function formatUpdated(timestamp) {
  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return 'Updated just now';
    }
    return `Updated ${date.toLocaleString()}`;
  } catch (error) {
    console.warn('Unable to format today panel timestamp', timestamp, error);
    return 'Updated just now';
  }
}

/**
 * @param {import('../services/api.js').DailyTask} task
 */
function createTaskListItem(task) {
  const item = document.createElement('li');
  item.className = 'today-task-item';
  item.dataset.taskId = task.id;

  const header = document.createElement('div');
  header.className = 'today-task-item-header';

  const type = document.createElement('span');
  type.className = `today-task-type type-${sanitizeTaskType(task.type)}`;
  type.textContent = TASK_TYPE_LABELS[sanitizeTaskType(task.type)] ?? 'Task';

  const priority = document.createElement('span');
  priority.className = `today-task-priority priority-${sanitizePriority(task.priority)}`;
  priority.textContent = `${PRIORITY_LABELS[sanitizePriority(task.priority)] ?? 'Priority'} priority`;

  header.append(type, priority);

  const plant = document.createElement('p');
  plant.className = 'today-task-plant';
  plant.textContent = task.plantName;

  const meta = document.createElement('p');
  meta.className = 'today-task-meta';
  meta.textContent = `${task.villageName} • Due ${formatDueAt(task.dueAt)}`;

  item.append(header, plant, meta);
  return item;
}

function sanitizeTaskType(type) {
  if (type === 'water' || type === 'fertilize' || type === 'inspect' || type === 'transplant') {
    return type;
  }
  return 'inspect';
}

function sanitizePriority(priority) {
  if (priority === 'low' || priority === 'medium' || priority === 'high') {
    return priority;
  }
  return 'medium';
}

function formatDueAt(value) {
  if (!value) {
    return 'soon';
  }
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'soon';
    }
    return date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch (error) {
    console.warn('Unable to format dueAt timestamp', value, error);
    return 'soon';
  }
}
