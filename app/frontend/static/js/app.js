import {AppShell} from './components/AppShell.js';
import {Store} from './store.js';
import {initDashboardView} from './views/DashboardView.js';
import {initPlantModal} from './views/PlantView.js';
import {initTodayPanel} from './views/TodayPanel.js';
import {initVillageView} from './views/VillageView.js';
import {refreshDashboard} from './vm/dashboard.vm.js';
import {refreshVillage} from './vm/village.vm.js';
import {downloadExportBundle, importBundleFromFile} from './services/importExport.js';

const logStep = (message, details) => {
  const timestamp = new Date().toISOString();
  if (typeof details === 'undefined') {
    console.info(`[Plantit Launch][${timestamp}] ${message}`);
  } else {
    console.info(`[Plantit Launch][${timestamp}] ${message}`, details);
  }
};

logStep('Evaluating application bootstrap script.');

const root = document.getElementById('app');
logStep('Queried root container element.', {found: Boolean(root)});

function mount() {
  logStep('Mount routine invoked.');
  if (!root) {
    console.error('Unable to mount Plantit UI: #app container is missing.');
    return;
  }
  console.groupCollapsed('[Plantit Launch] DOM construction sequence');
  const shell = AppShell();
  logStep('Created AppShell root component.');
  root.appendChild(shell);
  logStep('AppShell mounted into root container.');

  const main = document.createElement('main');
  main.className = 'layout';
  main.setAttribute('aria-label', 'Village overview');
  logStep('Main layout element prepared.');

  const viewStack = document.createElement('div');
  viewStack.className = 'view-stack';
  logStep('View stack container created.');

  const dashboardSection = document.createElement('section');
  dashboardSection.className = 'cards';
  dashboardSection.id = 'dashboard-view';
  dashboardSection.setAttribute('aria-live', 'polite');
  logStep('Dashboard section initialised.');

  const villageSection = document.createElement('section');
  villageSection.className = 'cards village-view';
  villageSection.id = 'village-view';
  villageSection.setAttribute('aria-live', 'polite');
  logStep('Village section initialised.');

  viewStack.appendChild(dashboardSection);
  viewStack.appendChild(villageSection);
  logStep('View stack populated with dashboard and village sections.');

  const right = document.createElement('aside');
  right.className = 'panel';
  right.id = 'right-panel';
  right.setAttribute('aria-label', 'Today panel');
  logStep('Right-hand panel created.');

  main.appendChild(viewStack);
  main.appendChild(right);
  logStep('Main layout populated with primary sections.');

  root.appendChild(main);
  logStep('Main layout mounted into root container.');

  const footer = document.createElement('footer');
  footer.className = 'footer';
  logStep('Footer container created.');

  const status = document.createElement('p');
  status.className = 'status-text';
  status.id = 'footerStatus';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.tabIndex = -1;
  logStep('Footer status element configured.');

  const buttons = document.createElement('div');
  buttons.className = 'footer-buttons';
  logStep('Footer button container created.');

  const exportBtn = document.createElement('button');
  exportBtn.className = 'link-btn';
  exportBtn.type = 'button';
  exportBtn.id = 'exportBtn';
  exportBtn.textContent = 'Export';
  logStep('Export button created.');

  const importBtn = document.createElement('button');
  importBtn.className = 'link-btn';
  importBtn.type = 'button';
  importBtn.id = 'importBtn';
  importBtn.textContent = 'Import';
  logStep('Import button created.');

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json';
  fileInput.style.display = 'none';
  logStep('Hidden file input initialised for import workflow.');

  exportBtn.addEventListener('click', () => {
    logStep('Export button clicked; starting export workflow.');
    downloadExportBundle(status);
  });

  importBtn.addEventListener('click', () => {
    logStep('Import button clicked; triggering file selector.');
    fileInput.click();
  });

  fileInput.addEventListener('change', async (event) => {
    const [file] = event.target.files;
    logStep('Import file selected; launching import pipeline.', {fileName: file?.name});
    await importBundleFromFile(file, status);
    fileInput.value = '';
    logStep('Import pipeline completed; input reset.');
  });

  buttons.append(exportBtn, importBtn);
  footer.append(status, buttons, fileInput);
  root.appendChild(footer);
  logStep('Footer assembled and mounted.');

  Store.init();
  logStep('Store initialised with persisted state.', Store.state);
  initDashboardView(dashboardSection);
  logStep('Dashboard view initialised.');
  initVillageView(villageSection);
  logStep('Village view initialised.');
  initTodayPanel(right);
  logStep('Today panel initialised.');
  initPlantModal();
  logStep('Plant modal initialised.');

  if (Store.state.view === 'village' && Store.state.selectedVillageId) {
    logStep('Detected stored village context; refreshing village data.', {
      villageId: Store.state.selectedVillageId
    });
    refreshVillage(Store.state.selectedVillageId).catch((error) => console.error(error));
  } else {
    logStep('Defaulting to dashboard refresh.');
    refreshDashboard().catch((error) => console.error(error));
  }
  console.groupEnd();
  logStep('Mount routine complete. Awaiting asynchronous refresh operations.');
}

if (document.readyState === 'loading') {
  logStep('Document still loading; deferring mount to DOMContentLoaded.');
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  logStep('Document ready; queueing mount via microtask.');
  queueMicrotask(mount);
}
