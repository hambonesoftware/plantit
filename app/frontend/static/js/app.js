import {AppShell} from './components/AppShell.js';
import {Store} from './store.js';
import {initDashboardView} from './views/DashboardView.js';
import {initPlantModal} from './views/PlantView.js';
import {initTodayPanel} from './views/TodayPanel.js';
import {initVillageView} from './views/VillageView.js';
import {refreshDashboard} from './vm/dashboard.vm.js';
import {refreshVillage} from './vm/village.vm.js';

const root = document.getElementById('app');

function mount() {
  const shell = AppShell();
  root.appendChild(shell);

  const main = document.createElement('main');
  main.className = 'layout';
  main.setAttribute('aria-label', 'Village overview');

  const viewStack = document.createElement('div');
  viewStack.className = 'view-stack';

  const dashboardSection = document.createElement('section');
  dashboardSection.className = 'cards';
  dashboardSection.id = 'dashboard-view';
  dashboardSection.setAttribute('aria-live', 'polite');

  const villageSection = document.createElement('section');
  villageSection.className = 'cards village-view';
  villageSection.id = 'village-view';
  villageSection.setAttribute('aria-live', 'polite');

  viewStack.appendChild(dashboardSection);
  viewStack.appendChild(villageSection);

  const right = document.createElement('aside');
  right.className = 'panel';
  right.id = 'right-panel';
  right.setAttribute('aria-label', 'Today panel');

  main.appendChild(viewStack);
  main.appendChild(right);

  root.appendChild(main);

  const footer = document.createElement('footer');
  footer.className = 'footer';
  footer.innerHTML = `
    <button class="link-btn" id="exportBtn" type="button">Export</button>
    <button class="link-btn" id="importBtn" type="button">Import</button>
  `;
  root.appendChild(footer);

  Store.init();
  initDashboardView(dashboardSection);
  initVillageView(villageSection);
  initTodayPanel(right);
  initPlantModal();

  if (Store.state.view === 'village' && Store.state.selectedVillageId) {
    refreshVillage(Store.state.selectedVillageId).catch((error) => console.error(error));
  } else {
    refreshDashboard().catch((error) => console.error(error));
  }
}

document.addEventListener('DOMContentLoaded', mount);
