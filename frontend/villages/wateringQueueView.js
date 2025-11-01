import { showToast } from '../services/toast.js';
import { formatDate } from './shared.js';

function describeDueStatus(dateString) {
  if (!dateString) {
    return { label: 'Due date unavailable', overdue: false };
  }
  try {
    const dueDate = new Date(dateString);
    if (Number.isNaN(dueDate.getTime())) {
      return { label: `Due ${dateString}`, overdue: false };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    if (due.getTime() === today.getTime()) {
      return { label: `Due today (${formatDate(dateString)})`, overdue: false };
    }
    if (due < today) {
      return { label: `Overdue since ${formatDate(dateString)}`, overdue: true };
    }
    return { label: `Due ${formatDate(dateString)}`, overdue: false };
  } catch (error) {
    console.warn('WateringQueueView: unable to parse due date', dateString, error);
    return { label: `Due ${dateString}`, overdue: false };
  }
}

function createQueueItem(plant) {
  const item = document.createElement('li');
  item.className = 'village-watering-queue-item';
  item.dataset.plantId = plant.id;

  const info = document.createElement('div');
  info.className = 'village-watering-queue-info';

  const name = document.createElement('h4');
  name.className = 'village-watering-queue-name';
  name.textContent = plant.displayName;

  const due = document.createElement('p');
  due.className = 'village-watering-queue-due';
  const dueStatus = describeDueStatus(plant.nextWateringDate);
  due.textContent = dueStatus.label;
  if (dueStatus.overdue) {
    due.dataset.overdue = 'true';
  }

  const meta = document.createElement('p');
  meta.className = 'village-watering-queue-meta';
  const village = plant.villageName || 'Unknown village';
  const lastWatered = formatDate(plant.lastWateredAt);
  meta.textContent = `${village} • Last watered ${lastWatered}`;

  info.append(name, due, meta);

  const actions = document.createElement('div');
  actions.className = 'village-watering-queue-actions';

  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  dismissButton.className = 'village-watering-queue-dismiss';
  dismissButton.dataset.action = 'watering-dismiss';
  dismissButton.dataset.plantId = plant.id;
  dismissButton.textContent = 'Dismiss for today';
  dismissButton.setAttribute('aria-label', `Dismiss ${plant.displayName} from watering queue for today`);

  actions.append(dismissButton);
  item.append(info, actions);
  return item;
}

export class WateringQueueView {
  constructor(root, viewModel) {
    this.root = root;
    this.viewModel = viewModel;

    this.listElement = root.querySelector('[data-role="watering-list"]');
    this.loadingMessage = root.querySelector('[data-role="watering-loading"]');
    this.emptyMessage = root.querySelector('[data-role="watering-empty"]');
    this.errorPanel = root.querySelector('[data-role="watering-error"]');
    this.errorMessage = root.querySelector('[data-role="watering-error-message"]');
    this.refreshButton = root.querySelector('[data-action="watering-refresh"]');
    this.retryButton = root.querySelector('[data-action="watering-retry"]');

    if (this.refreshButton) {
      this.refreshButton.addEventListener('click', () => {
        this.viewModel.refresh();
      });
    }

    if (this.retryButton) {
      this.retryButton.addEventListener('click', () => {
        this.viewModel.refresh();
      });
    }

    this.root.addEventListener('click', async (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) {
        return;
      }
      const dismissButton = target.closest('[data-action="watering-dismiss"]');
      if (dismissButton) {
        const plantId = dismissButton.dataset.plantId;
        if (!plantId) {
          return;
        }
        dismissButton.disabled = true;
        try {
          const dismissed = await this.viewModel.dismiss(plantId);
          if (dismissed) {
            showToast({ message: 'Plant dismissed from today\'s queue.', tone: 'success' });
          }
        } catch (error) {
          const message = error?.message || 'Unable to dismiss plant. Try again.';
          showToast({ message, tone: 'danger' });
        } finally {
          dismissButton.disabled = false;
        }
      }
    });

    this.unsubscribe = this.viewModel.subscribe((state) => {
      this.render(state);
    });
  }

  render(state) {
    this.root.dataset.status = state.status;
    if (this.refreshButton) {
      this.refreshButton.disabled = state.status === 'loading';
    }
    switch (state.status) {
      case 'idle':
        this.renderIdle();
        break;
      case 'loading':
        this.renderLoading();
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

  renderIdle() {
    if (this.loadingMessage) {
      this.loadingMessage.hidden = false;
    }
    if (this.listElement) {
      this.listElement.hidden = true;
      this.listElement.replaceChildren();
    }
    if (this.emptyMessage) {
      this.emptyMessage.hidden = true;
    }
    if (this.errorPanel) {
      this.errorPanel.hidden = true;
    }
  }

  renderLoading() {
    if (this.loadingMessage) {
      this.loadingMessage.hidden = false;
    }
    if (this.listElement) {
      this.listElement.hidden = true;
      this.listElement.replaceChildren();
    }
    if (this.emptyMessage) {
      this.emptyMessage.hidden = true;
    }
    if (this.errorPanel) {
      this.errorPanel.hidden = true;
    }
  }

  renderReady(state) {
    if (this.loadingMessage) {
      this.loadingMessage.hidden = true;
    }
    if (this.errorPanel) {
      this.errorPanel.hidden = true;
    }

    const plants = Array.isArray(state.plants) ? state.plants : [];
    if (!this.listElement || !this.emptyMessage) {
      return;
    }
    if (plants.length === 0) {
      this.listElement.hidden = true;
      this.listElement.replaceChildren();
      this.emptyMessage.hidden = false;
      return;
    }

    const items = plants.map((plant) => createQueueItem(plant));
    this.listElement.hidden = false;
    this.emptyMessage.hidden = true;
    this.listElement.replaceChildren(...items);
  }

  renderError(state) {
    if (this.loadingMessage) {
      this.loadingMessage.hidden = true;
    }
    if (this.listElement) {
      this.listElement.hidden = true;
      this.listElement.replaceChildren();
    }
    if (this.emptyMessage) {
      this.emptyMessage.hidden = true;
    }
    if (this.errorPanel) {
      this.errorPanel.hidden = false;
    }
    if (this.errorMessage) {
      this.errorMessage.textContent = state.error?.message || 'Unable to load watering queue.';
    }
  }

  destroy() {
    if (typeof this.unsubscribe === 'function') {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}
