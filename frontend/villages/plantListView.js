import { copyDiagnosticsToClipboard } from '../services/diagnostics.js';
import { showToast } from '../services/toast.js';
import { formatDate, formatHealthScore } from './shared.js';

const STAGE_LABELS = {
  seedling: 'Seedling',
  vegetative: 'Vegetative',
  flowering: 'Flowering',
  mature: 'Mature',
};

/**
 * Render the list of plants within a selected village.
 */
export class PlantListView {
  /**
   * @param {HTMLElement} root
   * @param {import('./viewModels.js').VillagePlantListViewModel} viewModel
   * @param {{ onSelect?: (plantId: string) => void }} [options]
   */
  constructor(root, viewModel, options = {}) {
    this.root = root;
    this.viewModel = viewModel;
    this.onSelect = typeof options.onSelect === 'function' ? options.onSelect : () => {};

    this.placeholder = root.querySelector('[data-role="plant-placeholder"]');
    this.loading = root.querySelector('[data-role="plant-loading"]');
    this.errorPanel = root.querySelector('[data-role="plant-error"]');
    this.errorMessage = root.querySelector('[data-role="plant-error-message"]');
    this.retryButton = root.querySelector('[data-action="plant-retry"]');
    this.copyButton = root.querySelector('[data-action="plant-copy-error"]');
    this.refreshButton = root.querySelector('[data-action="plant-refresh"]');
    this.updated = root.querySelector('[data-role="plant-updated"]');
    this.header = root.querySelector('[data-role="plant-header"]');
    this.villageName = root.querySelector('[data-role="plant-village-name"]');
    this.content = root.querySelector('[data-role="plant-content"]');
    this.listElement = root.querySelector('[data-role="plant-list"]');
    this.emptyMessage = root.querySelector('[data-role="plant-empty"]');
    this._currentErrorDetail = '';

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

    if (this.copyButton) {
      this.copyButton.addEventListener('click', async () => {
        const success = await copyDiagnosticsToClipboard(this._currentErrorDetail);
        if (success) {
          showToast({ message: 'Error details copied to clipboard.', tone: 'success' });
        } else {
          showToast({ message: 'Unable to copy error details. Copy manually if needed.', tone: 'warning' });
        }
      });
    }

    this.root.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) {
        return;
      }
      const trigger = target.closest('[data-action="plant-open"]');
      if (!trigger) {
        return;
      }
      const item = trigger.closest('.village-plants-item');
      if (!item) {
        return;
      }
      const plantId = item.dataset.plantId;
      if (plantId) {
        this.onSelect(plantId);
      }
    });

    this.unsubscribe = this.viewModel.subscribe((state) => {
      this.render(state);
    });
  }

  /**
   * @param {import('./viewModels.js').VillagePlantListState} state
   */
  render(state) {
    this.root.dataset.status = state.status;
    this.updateHeader(state);

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

  /**
   * @param {import('./viewModels.js').VillagePlantListState} state
   */
  updateHeader(state) {
    if (this.villageName) {
      this.villageName.textContent = state.village?.name ?? 'Select a village';
    }
    if (this.refreshButton) {
      this.refreshButton.disabled = state.status === 'loading' || !state.village;
    }
    if (this.updated) {
      if (state.lastUpdated) {
        this.updated.textContent = formatUpdated(state.lastUpdated);
      } else if (state.status === 'loading' && state.village) {
        this.updated.textContent = 'Refreshing…';
      } else {
        this.updated.textContent = 'No data loaded yet';
      }
    }
    if (this.header) {
      this.header.hidden = !state.village;
    }
  }

  renderIdle() {
    if (this.placeholder) {
      this.placeholder.hidden = false;
    }
    if (this.loading) {
      this.loading.hidden = true;
    }
    if (this.errorPanel) {
      this.errorPanel.hidden = true;
    }
    if (this.content) {
      this.content.hidden = true;
    }
    this._updateErrorContext(null, null);
  }

  renderLoading() {
    if (this.placeholder) {
      this.placeholder.hidden = true;
    }
    if (this.loading) {
      this.loading.hidden = false;
    }
    if (this.errorPanel) {
      this.errorPanel.hidden = true;
    }
    if (this.content) {
      this.content.hidden = true;
    }
    this._updateErrorContext(null, null);
  }

  /**
   * @param {import('./viewModels.js').VillagePlantListState} state
   */
  renderReady(state) {
    if (!state.village) {
      this.renderIdle();
      return;
    }

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
    this._updateErrorContext(null, null);

    if (!this.listElement || !this.emptyMessage) {
      return;
    }

    const plants = Array.isArray(state.plants) ? state.plants : [];
    if (plants.length === 0) {
      this.listElement.hidden = true;
      this.listElement.replaceChildren();
      this.emptyMessage.hidden = false;
      return;
    }

    const items = plants.map((plant) => createPlantListItem(plant));
    this.listElement.hidden = false;
    this.emptyMessage.hidden = true;
    this.listElement.replaceChildren(...items);
  }

  /**
   * @param {import('./viewModels.js').VillagePlantListState} state
   */
  renderError(state) {
    if (this.loading) {
      this.loading.hidden = true;
    }
    if (this.placeholder) {
      this.placeholder.hidden = Boolean(state.village);
    }
    if (this.content) {
      this.content.hidden = !state.village || !state.plants || state.plants.length === 0;
    }
    if (this.errorPanel) {
      this.errorPanel.hidden = false;
    }
    if (this.errorMessage) {
      this.errorMessage.textContent = state.error?.message ?? 'Unable to load plants.';
    }
    this._updateErrorContext(state.error?.detail ?? null, state.error?.category ?? null);
  }

  _updateErrorContext(detail, category) {
    this._currentErrorDetail = typeof detail === 'string' ? detail : '';
    if (this.copyButton) {
      this.copyButton.disabled = !this._currentErrorDetail;
    }
    if (this.errorPanel) {
      if (category) {
        this.errorPanel.dataset.category = category;
      } else {
        delete this.errorPanel.dataset.category;
      }
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
    console.warn('Unable to format plant list timestamp', timestamp, error);
    return 'Updated just now';
  }
}

/**
 * @param {import('../services/api.js').PlantListItem} plant
 */
function createPlantListItem(plant) {
  const item = document.createElement('li');
  item.className = 'village-plants-item';
  item.dataset.plantId = plant.id;
  item.dataset.updatedAt = plant.updatedAt || '';
  item.dataset.stage = plant.stage;
  item.dataset.healthScore = String(plant.healthScore ?? '');
  item.dataset.lastWateredAt = plant.lastWateredAt || '';
  if ('notes' in plant) {
    item.dataset.notes = plant.notes ?? '';
  }
  item.dataset.displayName = plant.displayName;
  item.dataset.species = plant.species;

  const header = document.createElement('div');
  header.className = 'village-plants-item-header';

  const name = document.createElement('span');
  name.className = 'village-plants-item-name';
  name.textContent = plant.displayName;

  const stage = document.createElement('span');
  stage.className = `village-plants-item-stage stage-${sanitizeStage(plant.stage)}`;
  stage.textContent = STAGE_LABELS[sanitizeStage(plant.stage)] ?? 'Unknown';

  header.append(name, stage);

  const species = document.createElement('p');
  species.className = 'village-plants-item-species';
  species.textContent = plant.species;

  const meta = document.createElement('p');
  meta.className = 'village-plants-item-meta';
  meta.textContent = `Last watered ${formatDateTime(plant.lastWateredAt)} • Health ${formatHealthScore(plant.healthScore)}`;

  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'village-plants-item-open';
  openButton.dataset.action = 'plant-open';
  openButton.setAttribute('aria-label', `View ${plant.displayName}`);
  openButton.append(header, species, meta);

  const actions = document.createElement('div');
  actions.className = 'village-plants-item-actions';

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.className = 'village-plants-item-edit';
  editButton.dataset.action = 'plant-edit';
  editButton.textContent = 'Edit';

  actions.append(editButton);

  item.append(openButton, actions);
  return item;
}

function sanitizeStage(stage) {
  if (stage === 'seedling' || stage === 'vegetative' || stage === 'flowering' || stage === 'mature') {
    return stage;
  }
  return 'vegetative';
}

function formatDateTime(value) {
  if (!value) {
    return formatDate(value);
  }
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return formatDate(value);
    }
    return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch (error) {
    console.warn('Unable to format plant timestamp', value, error);
    return formatDate(value);
  }
}
