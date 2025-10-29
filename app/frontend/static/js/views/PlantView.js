import {Store} from '../store.js';
import {performWaterAction} from '../services/plantActions.js';
import {refreshDashboard} from '../vm/dashboard.vm.js';
import {refreshPlant} from '../vm/plant.vm.js';
import {refreshVillage} from '../vm/village.vm.js';
import {api} from '../apiClient.js';

let overlay;
let panel;
let unsubscribe;
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function handleFocusTrap(event) {
  if (!overlay || overlay.classList.contains('hidden')) {
    return;
  }
  if (event.key !== 'Tab') {
    return;
  }
  const focusable = overlay.querySelectorAll(FOCUSABLE_SELECTOR);
  if (!focusable.length) {
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey) {
    if (active === first || !overlay.contains(active)) {
      event.preventDefault();
      last.focus();
    }
  } else if (active === last) {
    event.preventDefault();
    first.focus();
  }
}

function ensureOverlay() {
  if (overlay) {
    return;
  }
  overlay = document.createElement('div');
  overlay.className = 'plant-modal hidden';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="modal-backdrop" data-dismiss="true"></div>
    <section class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="plantModalTitle">
      <button class="icon-btn close" type="button" aria-label="Close plant details">×</button>
      <div class="modal-content" id="plantModalContent"></div>
    </section>
  `;
  document.body.appendChild(overlay);
  panel = overlay.querySelector('#plantModalContent');

  overlay.querySelector('[data-dismiss]').addEventListener('click', () => {
    Store.closePlant();
  });
  overlay.querySelector('.close').addEventListener('click', () => {
    Store.closePlant();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !overlay.classList.contains('hidden')) {
      Store.closePlant();
    }
  });

  document.addEventListener('keydown', handleFocusTrap, true);
}

function renderLogs(logs) {
  const section = document.createElement('section');
  section.className = 'plant-logs';
  section.innerHTML = '<h3>Recent log</h3>';
  const list = document.createElement('ul');
  list.className = 'log-list';

  if (!logs.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'No logs yet.';
    list.appendChild(empty);
  } else {
    for (const entry of logs) {
      const item = document.createElement('li');
      const ts = new Date(entry.ts);
      item.innerHTML = `
        <span class="log-kind">${entry.kind}</span>
        <span class="log-date">${ts.toLocaleString()}</span>
        ${entry.note ? `<span class="log-note">${entry.note}</span>` : ''}
      `;
      list.appendChild(item);
    }
  }

  section.appendChild(list);
  return section;
}

function renderScheduleForm(plant) {
  const form = document.createElement('form');
  form.className = 'schedule-form';
  form.innerHTML = `
    <h3>Watering schedule</h3>
    <label>
      <span>Water every (days)</span>
      <input name="frequency" type="number" min="1" value="${plant.frequency_days}">
    </label>
    <div class="form-row">
      <button class="btn" type="submit">Save schedule</button>
      <p class="form-message" aria-live="polite" role="status"></p>
    </div>
  `;

  const message = form.querySelector('.form-message');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = Number(form.frequency.value);
    if (!Number.isFinite(value) || value < 1) {
      message.textContent = 'Frequency must be at least 1 day.';
      form.frequency.focus();
      return;
    }
    message.textContent = 'Saving…';
    form.classList.add('busy');
    try {
      await api.put(`/api/plants/${plant.id}`, { frequency_days: value });
      await Promise.all([
        refreshPlant(plant.id, true),
        refreshVillage(plant.village_id, true),
        refreshDashboard(true),
      ]);
      message.textContent = 'Schedule updated.';
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Unable to save schedule.';
    } finally {
      form.classList.remove('busy');
    }
  });

  return form;
}

function renderWaterForm(plant) {
  const form = document.createElement('form');
  form.className = 'water-form';
  form.innerHTML = `
    <h3>Log watering</h3>
    <label>
      <span>Note (optional)</span>
      <textarea name="note" rows="2" placeholder="What did you observe?"></textarea>
    </label>
    <div class="form-row">
      <button class="btn" type="submit">Log water now</button>
      <p class="form-message" aria-live="polite" role="status"></p>
    </div>
  `;

  const message = form.querySelector('.form-message');
  const textarea = form.querySelector('textarea');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = 'Logging…';
    form.classList.add('busy');
    try {
      await performWaterAction(plant.id, plant.village_id, {
        note: textarea.value.trim() || undefined,
      });
      await refreshPlant(plant.id, true);
      message.textContent = 'Water logged!';
      textarea.value = '';
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Unable to log water.';
    } finally {
      form.classList.remove('busy');
    }
  });

  return form;
}

function renderContent(plant) {
  const content = document.createElement('div');
  content.className = 'plant-modal-body';
  content.innerHTML = `
    <header class="plant-modal-header">
      <h2 id="plantModalTitle">${plant.name}</h2>
      <p class="meta">${plant.species || 'Unknown species'}</p>
      <p class="meta">Village: ${plant.village_name}</p>
      <p class="meta">Last watered ${plant.last_watered_human}</p>
    </header>
  `;

  content.appendChild(renderScheduleForm(plant));
  content.appendChild(renderWaterForm(plant));
  content.appendChild(renderLogs(plant.logs));
  return content;
}

async function handleState(state) {
  ensureOverlay();

  const plantId = state.selectedPlantId;
  if (!plantId) {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    panel.innerHTML = '';
    return;
  }

  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  panel.innerHTML = '<p class="loading-state">Loading plant…</p>';

  const plant = state.cache.plants[plantId];
  if (!plant) {
    try {
      await refreshPlant(plantId, true);
    } catch (error) {
      panel.innerHTML = `<p class="error-state">${error instanceof Error ? error.message : 'Unable to load plant.'}</p>`;
    }
    return;
  }

  panel.innerHTML = '';
  panel.appendChild(renderContent(plant));
  const closeButton = overlay.querySelector('.close');
  if (closeButton) {
    closeButton.focus();
  }
}

export function initPlantModal() {
  ensureOverlay();
  if (unsubscribe) {
    unsubscribe();
  }
  unsubscribe = Store.subscribe(handleState);
}
