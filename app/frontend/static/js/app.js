import {AppShell} from './components/AppShell.js';
import {DashboardView} from './views/DashboardView.js';

const root = document.getElementById('app');

function mount() {
  const shell = AppShell();
  root.appendChild(shell);

  const main = document.createElement('main');
  main.className = 'layout';
  main.setAttribute('aria-label', 'Village overview');

  const cards = document.createElement('section');
  cards.className = 'cards';
  cards.id = 'cards';
  cards.setAttribute('aria-live', 'polite');

  const right = document.createElement('aside');
  right.className = 'panel';
  right.id = 'right-panel';
  right.setAttribute('aria-label', 'Today panel');

  main.appendChild(cards);
  main.appendChild(right);

  root.appendChild(main);

  const footer = document.createElement('footer');
  footer.className = 'footer';
  footer.innerHTML = `
    <button class="link-btn" id="exportBtn" type="button">Export</button>
    <button class="link-btn" id="importBtn" type="button">Import</button>
  `;
  root.appendChild(footer);

  DashboardView();
}

document.addEventListener('DOMContentLoaded', mount);
