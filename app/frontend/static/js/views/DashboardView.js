import {api} from '../apiClient.js';
import {VillageCard} from '../components/VillageCard.js';
import {Store} from '../store.js';
import {refreshDashboard} from '../vm/dashboard.vm.js';
import {refreshVillage} from '../vm/village.vm.js';

let container;
let unsubscribe;

function render(state) {
  if (!container) {
    return;
  }
  const isDashboard = state.view === 'dashboard';
  container.hidden = !isDashboard;
  if (!isDashboard) {
    return;
  }

  const dashboard = state.cache.dashboard;
  container.innerHTML = '';

  if (!dashboard) {
    const placeholder = document.createElement('div');
    placeholder.className = 'loading-state';
    placeholder.textContent = 'Loading dashboard…';
    container.appendChild(placeholder);
    return;
  }

  if (!dashboard.villages.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No villages yet. Add your first village to get started!';
    container.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const village of dashboard.villages) {
    const card = VillageCard(village, {
      onOpen: (vm) => {
        Store.navigateToVillage(vm.id);
        refreshVillage(vm.id, false).catch((error) => console.error(error));
      },
      onQuickAdd: async (vm, payload) => {
        const body = {
          village_id: vm.id,
          name: payload.name,
          species: payload.species,
          frequency_days: payload.frequency_days,
        };
        const result = await api.post('/api/plants', body);
        await Promise.all([
          refreshDashboard(true),
          refreshVillage(vm.id, true),
        ]);
        return result;
      },
    });
    fragment.appendChild(card);
  }

  container.appendChild(fragment);
}

export function initDashboardView(node) {
  container = node;
  container.hidden = true;
  if (unsubscribe) {
    unsubscribe();
  }
  unsubscribe = Store.subscribe(render);
}
