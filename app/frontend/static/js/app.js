import {AppShell} from './components/AppShell.js';
import {Store} from './store.js';
import {initDashboardView} from './views/DashboardView.js';
import {initPlantModal} from './views/PlantView.js';
import {initTodayPanel} from './views/TodayPanel.js';
import {initVillageView} from './views/VillageView.js';
import {refreshDashboard} from './vm/dashboard.vm.js';
import {refreshVillage} from './vm/village.vm.js';
import {downloadExportBundle, importBundleFromFile} from './services/importExport.js';

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

  const status = document.createElement('p');
  status.className = 'status-text';
  status.id = 'footerStatus';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.tabIndex = -1;

  const buttons = document.createElement('div');
  buttons.className = 'footer-buttons';

  const exportBtn = document.createElement('button');
  exportBtn.className = 'link-btn';
  exportBtn.type = 'button';
  exportBtn.id = 'exportBtn';
  exportBtn.textContent = 'Export';

  const importBtn = document.createElement('button');
  importBtn.className = 'link-btn';
  importBtn.type = 'button';
  importBtn.id = 'importBtn';
  importBtn.textContent = 'Import';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json';
  fileInput.style.display = 'none';

  exportBtn.addEventListener('click', () => {
    downloadExportBundle(status);
  });

  importBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async (event) => {
    const [file] = event.target.files;
    await importBundleFromFile(file, status);
    fileInput.value = '';
  });

  buttons.append(exportBtn, importBtn);
  footer.append(status, buttons, fileInput);
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
