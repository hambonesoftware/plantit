import { Store } from '../store.js';

export function AppShell(){
  const el = document.createElement('header');
  el.className = 'app-shell';
  el.innerHTML = `
    <a class="logo" href="#/dashboard" aria-label="Plantit home">
      <span class="leaf" aria-hidden="true">🍃</span>
      <span>Plantit</span>
    </a>
    <div class="spacer"></div>
    <label class="search">
      <span class="sr-only">Search plants and logs</span>
      <input type="search" name="q" aria-label="Search plants and logs" placeholder="Search plants, tags, logs...">
    </label>
    <div class="icons" role="group" aria-label="User actions">
      <button class="icon-btn" type="button" aria-label="Notifications"><span aria-hidden="true">🔔</span></button>
      <button class="icon-btn" type="button" aria-label="Settings"><span aria-hidden="true">⚙️</span></button>
      <span class="avatar" aria-hidden="true"></span>
    </div>
  `;

  const logo = el.querySelector('.logo');
  logo.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    Store.navigateToDashboard();
  });
  return el;
}
