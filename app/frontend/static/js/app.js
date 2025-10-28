import {AppShell} from './components/AppShell.js';
import {DashboardView} from './views/DashboardView.js';

const root = document.getElementById('app');

function mount() {
  const shell = AppShell();
  root.appendChild(shell);

  const main = document.createElement('div');
  main.className = 'grid';

  const cards = document.createElement('div');
  cards.className = 'cards';
  cards.id = 'cards';

  const right = document.createElement('div');
  right.className = 'panel';
  right.id = 'right-panel';

  main.appendChild(cards);
  main.appendChild(right);

  root.appendChild(main);

  const footer = document.createElement('div');
  footer.className = 'footer';
  footer.innerHTML = '<button class="link-btn" id="exportBtn">Export</button><button class="link-btn" id="importBtn">Import</button>';
  root.appendChild(footer);

  DashboardView(); // boot the dashboard
}

document.addEventListener('DOMContentLoaded', mount);
