import {api} from '../apiClient.js';
import {Store} from '../store.js';
import {performWaterAction} from '../services/plantActions.js';
import {refreshDashboard} from '../vm/dashboard.vm.js';
import {refreshVillage} from '../vm/village.vm.js';

let container;
let unsubscribe;

async function createPlant(villageId, payload) {
  const body = {
    village_id: villageId,
    name: payload.name,
    species: payload.species,
    frequency_days: payload.frequency_days,
  };
  const result = await api.post('/api/plants', body);
  await Promise.all([
    refreshVillage(villageId, true),
    refreshDashboard(true),
  ]);
  return result;
}

function renderQuickAdd(villageId) {
  const wrap = document.createElement('section');
  wrap.className = 'quick-add-panel';
  wrap.innerHTML = `
    <h3>Quick add plant</h3>
    <form class="quick-add-form">
      <label>
        <span>Name</span>
        <input name="name" type="text" required placeholder="Fern"> 
      </label>
      <label>
        <span>Species</span>
        <input name="species" type="text" placeholder="Boston fern">
      </label>
      <label>
        <span>Water every (days)</span>
        <input name="frequency" type="number" min="1" value="3">
      </label>
      <button class="btn" type="submit">Add plant</button>
      <p class="form-message" aria-live="polite"></p>
    </form>
  `;

  const form = wrap.querySelector('form');
  const message = form.querySelector('.form-message');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const name = String(formData.get('name') || '').trim();
    const species = String(formData.get('species') || '').trim();
    const frequency = Number(formData.get('frequency')) || 3;

    if (!name) {
      message.textContent = 'Please provide a name.';
      form.querySelector('input[name="name"]').focus();
      return;
    }

    message.textContent = 'Saving…';
    form.classList.add('busy');
    try {
      await createPlant(villageId, {
        name,
        species: species || null,
        frequency_days: frequency,
      });
      form.reset();
      form.querySelector('input[name="frequency"]').value = '3';
      message.textContent = 'Plant added!';
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Unable to add plant.';
    } finally {
      form.classList.remove('busy');
    }
  });

  return wrap;
}

function renderPlants(village) {
  const list = document.createElement('section');
  list.className = 'plant-list';

  if (!village.plants.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No plants in this village yet.';
    list.appendChild(empty);
    return list;
  }

  for (const plant of village.plants) {
    const row = document.createElement('article');
    row.className = 'plant-row';
    row.innerHTML = `
      <div class="plant-meta">
        <h4>${plant.name}</h4>
        ${plant.species ? `<p class="meta">${plant.species}</p>` : ''}
        <p class="meta">Last watered ${plant.last_watered_human}</p>
      </div>
      <div class="plant-actions">
        <button class="btn" type="button" data-action="open">View</button>
        <button class="link-btn" type="button" data-action="water">Log water</button>
      </div>
    `;

    row.querySelector('[data-action="open"]').addEventListener('click', () => {
      Store.openPlant(plant.id);
    });

    row.querySelector('[data-action="water"]').addEventListener('click', async (event) => {
      const btn = event.currentTarget;
      btn.disabled = true;
      btn.textContent = 'Logging…';
      try {
        await performWaterAction(plant.id, village.id, {});
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Unable to log watering.');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Log water';
      }
    });

    list.appendChild(row);
  }

  return list;
}

function render(state) {
  if (!container) {
    return;
  }
  const isVillage = state.view === 'village';
  container.hidden = !isVillage;
  container.innerHTML = '';

  if (!isVillage) {
    return;
  }

  const villageId = state.selectedVillageId;
  if (!villageId) {
    const placeholder = document.createElement('p');
    placeholder.className = 'empty-state';
    placeholder.textContent = 'Select a village to continue.';
    container.appendChild(placeholder);
    return;
  }

  const village = state.cache.villages[villageId];
  if (!village) {
    const loading = document.createElement('div');
    loading.className = 'loading-state';
    loading.textContent = 'Loading village…';
    container.appendChild(loading);
    refreshVillage(villageId, true).catch((error) => console.error(error));
    return;
  }

  const header = document.createElement('header');
  header.className = 'village-header';
  header.innerHTML = `
    <button class="link-btn back" type="button">← Back to dashboard</button>
    <div class="village-title">
      <h2>${village.name}</h2>
      <div class="row">
        <span class="badge green">Due today ${village.due_today}</span>
        <span class="badge ${village.overdue > 0 ? 'red' : 'gray'}">${village.overdue > 0 ? village.overdue + ' overdue' : '0 overdue'}</span>
      </div>
    </div>
  `;
  header.querySelector('.back').addEventListener('click', () => {
    Store.navigateToDashboard();
    refreshDashboard(false).catch((error) => console.error(error));
  });

  container.appendChild(header);
  container.appendChild(renderQuickAdd(village.id));
  container.appendChild(renderPlants(village));
}

export function initVillageView(node) {
  container = node;
  container.hidden = true;
  if (unsubscribe) {
    unsubscribe();
  }
  unsubscribe = Store.subscribe(render);
}
