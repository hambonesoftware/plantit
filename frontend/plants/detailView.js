import { copyDiagnosticsToClipboard } from '../services/diagnostics.js';
import { showToast } from '../services/toast.js';
import { formatDate, formatHealthScore } from '../villages/shared.js';

const STAGE_LABELS = {
  seedling: 'Seedling',
  vegetative: 'Vegetative',
  flowering: 'Flowering',
  mature: 'Mature',
};

const EVENT_LABELS = {
  watering: 'Watering',
  fertilizer: 'Fertilizer',
  inspection: 'Inspection',
  transfer: 'Transfer',
  note: 'Note',
};

export class PlantDetailView {
  /**
   * @param {HTMLElement} root
   * @param {import('./viewModel.js').PlantDetailViewModel} viewModel
   * @param {{ onBack?: (context?: { villageId?: string | null }) => void, onViewVillage?: (villageId: string | null) => void }} [options]
   */
  constructor(root, viewModel, options = {}) {
    this.root = root;
    this.viewModel = viewModel;
    this.onBack = typeof options.onBack === 'function' ? options.onBack : () => {};
    this.onViewVillage =
      typeof options.onViewVillage === 'function' ? options.onViewVillage : () => {};
    this.lastKnownVillageId = null;

    this.placeholder = root.querySelector('[data-role="plant-placeholder"]');
    this.loading = root.querySelector('[data-role="plant-loading"]');
    this.errorPanel = root.querySelector('[data-role="plant-error"]');
    this.errorMessage = root.querySelector('[data-role="plant-error-message"]');
    this.retryButton = root.querySelector('[data-action="plant-detail-retry"]');
    this.copyButton = root.querySelector('[data-action="plant-detail-copy"]');
    this.backButton = root.querySelector('[data-action="plant-detail-back"]');
    this.villageButton = root.querySelector('[data-action="plant-detail-village"]');
    this.content = root.querySelector('[data-role="plant-content"]');
    this.name = root.querySelector('[data-role="plant-name"]');
    this.subtitle = root.querySelector('[data-role="plant-subtitle"]');
    this.stage = root.querySelector('[data-role="plant-stage"]');
    this.health = root.querySelector('[data-role="plant-health"]');
    this.lastWatered = root.querySelector('[data-role="plant-last-watered"]');
    this.notes = root.querySelector('[data-role="plant-notes"]');
    this.timeline = root.querySelector('[data-role="plant-timeline"]');
    this.timelineEmpty = root.querySelector('[data-role="plant-timeline-empty"]');
    this._currentErrorDetail = '';

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

    if (this.backButton) {
      this.backButton.addEventListener('click', () => {
        this.onBack({ villageId: this.lastKnownVillageId });
      });
    }

    if (this.villageButton) {
      this.villageButton.addEventListener('click', () => {
        this.onViewVillage(this.lastKnownVillageId);
      });
    }

    this.unsubscribe = this.viewModel.subscribe((state) => {
      this.render(state);
    });
  }

  /**
   * @param {import('./viewModel.js').PlantDetailState} state
   */
  render(state) {
    this.root.dataset.status = state.status;
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
    this.lastKnownVillageId = null;
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
   * @param {import('./viewModel.js').PlantDetailState} state
   */
  renderReady(state) {
    const detail = state.plant;
    if (!detail) {
      this.renderIdle();
      return;
    }

    this.lastKnownVillageId = detail.villageId || this.viewModel.getLastKnownVillageId();

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

    if (this.name) {
      this.name.textContent = detail.displayName || 'Unnamed plant';
    }
    if (this.subtitle) {
      const pieces = [detail.species || null, formatStage(detail.stage)];
      this.subtitle.textContent = pieces.filter(Boolean).join(' • ');
    }
    if (this.stage) {
      this.stage.textContent = formatStage(detail.stage) || 'Unknown';
    }
    if (this.health) {
      this.health.textContent = formatHealthScore(detail.healthScore);
    }
    if (this.lastWatered) {
      this.lastWatered.textContent = detail.lastWateredAt
        ? formatDateTime(detail.lastWateredAt)
        : '—';
    }
    if (this.notes) {
      this.notes.textContent = detail.notes ? detail.notes : 'No notes recorded yet.';
    }
    if (this.villageButton) {
      this.villageButton.textContent = detail.villageName
        ? `View ${detail.villageName}`
        : 'View village';
      this.villageButton.disabled = !this.lastKnownVillageId;
      this.villageButton.dataset.villageId = this.lastKnownVillageId ?? '';
    }

    if (this.timeline && this.timelineEmpty) {
      const events = Array.isArray(state.timeline) ? state.timeline : [];
      if (events.length === 0) {
        this.timeline.replaceChildren();
        this.timelineEmpty.hidden = false;
      } else {
        const items = events.map((event) => createTimelineItem(event));
        this.timeline.replaceChildren(...items);
        this.timelineEmpty.hidden = true;
      }
    }
  }

  /**
   * @param {import('./viewModel.js').PlantDetailState} state
   */
  renderError(state) {
    if (this.placeholder) {
      this.placeholder.hidden = true;
    }
    if (this.loading) {
      this.loading.hidden = true;
    }
    if (this.content) {
      this.content.hidden = Boolean(state.plant);
    }
    if (this.errorPanel) {
      this.errorPanel.hidden = false;
    }
    if (this.errorMessage) {
      this.errorMessage.textContent = state.error?.message ?? 'Unable to load plant details.';
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

function formatStage(stage) {
  const normalized = typeof stage === 'string' ? stage.trim().toLowerCase() : '';
  return STAGE_LABELS[normalized] ?? 'Unknown';
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
    console.warn('PlantDetailView: unable to format timestamp', value, error);
    return formatDate(value);
  }
}

function createTimelineItem(event) {
  const item = document.createElement('li');
  item.className = 'plant-detail-timeline-item';
  item.dataset.eventId = event.id;

  const header = document.createElement('div');
  header.className = 'plant-detail-timeline-header';

  const type = document.createElement('span');
  type.className = 'plant-detail-timeline-type';
  type.textContent = EVENT_LABELS[event.type] ?? 'Event';

  const occurred = document.createElement('time');
  occurred.className = 'plant-detail-timeline-date';
  occurred.dateTime = event.occurredAt;
  occurred.textContent = formatDateTime(event.occurredAt);

  header.append(type, occurred);

  const summary = document.createElement('p');
  summary.className = 'plant-detail-timeline-summary';
  summary.textContent = event.summary || 'No additional details provided.';

  item.append(header, summary);
  return item;
}
