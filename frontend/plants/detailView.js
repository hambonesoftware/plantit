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
    this.breadcrumbs = root.querySelector('[data-role="plant-breadcrumbs"]');
    this.breadcrumbVillage = root.querySelector('[data-role="plant-breadcrumb-village"]');
    this.breadcrumbPlant = root.querySelector('[data-role="plant-breadcrumb-plant"]');
    this.content = root.querySelector('[data-role="plant-content"]');
    this.name = root.querySelector('[data-role="plant-name"]');
    this.subtitle = root.querySelector('[data-role="plant-subtitle"]');
    this.stage = root.querySelector('[data-role="plant-stage"]');
    this.health = root.querySelector('[data-role="plant-health"]');
    this.lastWatered = root.querySelector('[data-role="plant-last-watered"]');
    this.notes = root.querySelector('[data-role="plant-notes"]');
    this.timeline = root.querySelector('[data-role="plant-timeline"]');
    this.timelineEmpty = root.querySelector('[data-role="plant-timeline-empty"]');
    this.wateringSection = root.querySelector('[data-role="plant-watering-section"]');
    this.wateringNext = root.querySelector('[data-role="plant-next-watering"]');
    this.wateringEmpty = root.querySelector('[data-role="plant-watering-empty"]');
    this.wateringCalendar = root.querySelector('[data-role="plant-watering-calendar"]');
    this.waterTodayButton = root.querySelector('[data-action="plant-water-today"]');
    this.waterDateInput = root.querySelector('[data-role="plant-water-date"]');
    this.waterOnDateButton = root.querySelector('[data-action="plant-water-on-date"]');
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

    if (this.breadcrumbVillage) {
      this.breadcrumbVillage.addEventListener('click', (event) => {
        if (!this.lastKnownVillageId) {
          event.preventDefault();
          return;
        }
        this.onViewVillage(this.lastKnownVillageId);
      });
    }

    if (this.waterTodayButton) {
      this.waterTodayButton.addEventListener('click', async () => {
        if (this.waterTodayButton.disabled) {
          return;
        }
        try {
          await this.viewModel.markWateredToday();
          showToast({ message: 'Recorded watering for today.', tone: 'success' });
        } catch (error) {
          console.error('PlantDetailView: unable to record watering', error);
          showToast({ message: 'Unable to record watering. Try again.', tone: 'warning' });
        }
      });
    }

    if (this.waterOnDateButton && this.waterDateInput) {
      const defaultLabel = this.waterOnDateButton.textContent?.trim() || 'Add date';
      this.waterOnDateButton.dataset.defaultLabel = defaultLabel;
      this.waterOnDateButton.addEventListener('click', async () => {
        if (this.waterOnDateButton.disabled) {
          return;
        }
        const selected = this.waterDateInput.value;
        if (!selected) {
          showToast({ message: 'Select a date to record watering.', tone: 'warning' });
          this.waterDateInput.focus();
          return;
        }
        const today = todayIsoDate();
        if (selected > today) {
          showToast({ message: 'You can only record past watering dates.', tone: 'warning' });
          this.waterDateInput.focus();
          return;
        }
        const history = this.viewModel.getState().watering?.history ?? [];
        if (history.includes(selected)) {
          showToast({ message: 'Watering already recorded for that date.', tone: 'info' });
          return;
        }
        try {
          await this.viewModel.markWateredToday({ wateredAt: selected });
          showToast({ message: 'Recorded watering for the selected date.', tone: 'success' });
          this.waterDateInput.value = '';
        } catch (error) {
          console.error('PlantDetailView: unable to record watering for date', selected, error);
          showToast({ message: 'Unable to record watering. Try again.', tone: 'warning' });
        }
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
    if (this.breadcrumbs) {
      this.breadcrumbs.hidden = true;
    }
    if (this.content) {
      this.content.hidden = true;
    }
    if (this.breadcrumbVillage) {
      this.breadcrumbVillage.textContent = 'Village';
      this.breadcrumbVillage.dataset.villageId = '';
      this.breadcrumbVillage.removeAttribute('href');
      this.breadcrumbVillage.setAttribute('aria-disabled', 'true');
      this.breadcrumbVillage.classList.add('is-disabled');
      this.breadcrumbVillage.tabIndex = -1;
    }
    if (this.breadcrumbPlant) {
      this.breadcrumbPlant.textContent = 'Plant';
    }
    this._renderWatering(emptyWateringState(), false);
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
    if (this.breadcrumbs) {
      this.breadcrumbs.hidden = true;
    }
    if (this.content) {
      this.content.hidden = true;
    }
    if (this.breadcrumbVillage) {
      this.breadcrumbVillage.textContent = 'Village';
      this.breadcrumbVillage.dataset.villageId = '';
      this.breadcrumbVillage.removeAttribute('href');
      this.breadcrumbVillage.setAttribute('aria-disabled', 'true');
      this.breadcrumbVillage.classList.add('is-disabled');
      this.breadcrumbVillage.tabIndex = -1;
    }
    if (this.breadcrumbPlant) {
      this.breadcrumbPlant.textContent = 'Plant';
    }
    this._renderWatering(emptyWateringState(), false);
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
    if (this.breadcrumbs) {
      this.breadcrumbs.hidden = false;
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

    if (this.breadcrumbVillage) {
      const villageName = detail.villageName || 'Village';
      this.breadcrumbVillage.textContent = villageName;
      if (this.lastKnownVillageId) {
        this.breadcrumbVillage.dataset.villageId = this.lastKnownVillageId;
        this.breadcrumbVillage.href = `#villages/${encodeURIComponent(this.lastKnownVillageId)}`;
        this.breadcrumbVillage.removeAttribute('aria-disabled');
        this.breadcrumbVillage.classList.remove('is-disabled');
        this.breadcrumbVillage.removeAttribute('tabindex');
      } else {
        this.breadcrumbVillage.dataset.villageId = '';
        this.breadcrumbVillage.removeAttribute('href');
        this.breadcrumbVillage.setAttribute('aria-disabled', 'true');
        this.breadcrumbVillage.classList.add('is-disabled');
        this.breadcrumbVillage.tabIndex = -1;
      }
    }

    if (this.breadcrumbPlant) {
      this.breadcrumbPlant.textContent = detail.displayName || 'Plant';
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
    const watering = state.watering ?? detail.watering ?? emptyWateringState();
    this._renderWatering(watering, Boolean(state.isRecordingWatering));
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
    if (this.breadcrumbs) {
      this.breadcrumbs.hidden = true;
    }
    if (this.errorMessage) {
      this.errorMessage.textContent = state.error?.message ?? 'Unable to load plant details.';
    }
    if (this.breadcrumbVillage) {
      this.breadcrumbVillage.textContent = 'Village';
      this.breadcrumbVillage.dataset.villageId = '';
      this.breadcrumbVillage.removeAttribute('href');
      this.breadcrumbVillage.setAttribute('aria-disabled', 'true');
      this.breadcrumbVillage.classList.add('is-disabled');
      this.breadcrumbVillage.tabIndex = -1;
    }
    if (this.breadcrumbPlant) {
      this.breadcrumbPlant.textContent = 'Plant';
    }
    this._renderWatering(state.watering ?? emptyWateringState(), false);
    this._updateErrorContext(state.error?.detail ?? null, state.error?.category ?? null);
  }

  _renderWatering(watering, isSaving) {
    const resolved = watering && typeof watering === 'object' ? watering : emptyWateringState();
    const history = Array.isArray(resolved.history) ? resolved.history : [];
    const nextDate =
      typeof resolved.nextWateringDate === 'string' && resolved.nextWateringDate
        ? resolved.nextWateringDate
        : null;
    const hasToday = Boolean(resolved.hasWateringToday);

    if (this.waterTodayButton) {
      this.waterTodayButton.disabled = isSaving || hasToday;
      const label = hasToday ? 'Watered today' : 'Mark watered today';
      this.waterTodayButton.textContent = isSaving ? 'Saving…' : label;
    }

    if (this.waterOnDateButton) {
      const defaultLabel = this.waterOnDateButton.dataset.defaultLabel || 'Add date';
      this.waterOnDateButton.disabled = isSaving;
      this.waterOnDateButton.textContent = isSaving ? 'Saving…' : defaultLabel;
    }

    if (this.waterDateInput) {
      this.waterDateInput.max = todayIsoDate();
      this.waterDateInput.disabled = isSaving;
    }

    if (this.wateringNext) {
      this.wateringNext.textContent = nextDate ? formatDate(nextDate) : '—';
    }

    if (this.wateringEmpty) {
      this.wateringEmpty.hidden = history.length > 0;
    }

    if (this.wateringCalendar) {
      if (history.length === 0) {
        this.wateringCalendar.hidden = true;
        this.wateringCalendar.replaceChildren();
      } else {
        this.wateringCalendar.hidden = false;
        renderWateringCalendar(this.wateringCalendar, history);
      }
    }
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

function emptyWateringState() {
  return { history: [], nextWateringDate: null, hasWateringToday: false };
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

function renderWateringCalendar(container, history) {
  const today = todayIsoDate();
  const historySet = new Set(history);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const rangeStart = startOfCalendarMonth(monthStart);
  const rangeEnd = endOfCalendarMonth(monthEnd);

  const header = document.createElement('div');
  header.className = 'plant-watering-calendar-header';
  header.textContent = monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const weekdayRow = document.createElement('div');
  weekdayRow.className = 'plant-watering-calendar-weekdays';
  const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  for (let day = 0; day < 7; day += 1) {
    const refDate = new Date(Date.UTC(2023, 0, 1 + day));
    const weekday = document.createElement('span');
    weekday.textContent = weekdayFormatter.format(refDate);
    weekdayRow.append(weekday);
  }

  const grid = document.createElement('div');
  grid.className = 'plant-watering-calendar-grid';

  const cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    const iso = toIsoDate(cursor);
    const cell = document.createElement('div');
    cell.className = 'plant-watering-calendar-cell';
    if (cursor.getUTCMonth() !== monthStart.getUTCMonth()) {
      cell.classList.add('is-outside-month');
    }
    if (historySet.has(iso)) {
      cell.classList.add('is-watered');
      const dot = document.createElement('span');
      dot.className = 'plant-watering-calendar-dot';
      dot.setAttribute('aria-hidden', 'true');
      cell.append(dot);
      const srLabel = document.createElement('span');
      srLabel.className = 'sr-only';
      srLabel.textContent = String(cursor.getUTCDate());
      cell.append(srLabel);
    } else {
      cell.textContent = String(cursor.getUTCDate());
    }
    if (iso === today) {
      cell.classList.add('is-today');
    }
    const label = cursor.toLocaleDateString(undefined, {
      dateStyle: 'medium',
    });
    const annotatedLabel = historySet.has(iso) ? `${label} — watered` : label;
    cell.title = annotatedLabel;
    grid.append(cell);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  container.replaceChildren(header, weekdayRow, grid);
}

function startOfCalendarMonth(firstOfMonth) {
  const start = new Date(firstOfMonth);
  const dayOfWeek = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - dayOfWeek);
  return start;
}

function endOfCalendarMonth(lastOfMonth) {
  const end = new Date(lastOfMonth);
  const dayOfWeek = end.getUTCDay();
  end.setUTCDate(end.getUTCDate() + (6 - dayOfWeek));
  return end;
}

function toIsoDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function todayIsoDate() {
  const now = new Date();
  return toIsoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
}
