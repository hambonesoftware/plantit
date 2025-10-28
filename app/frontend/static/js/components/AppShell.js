export function AppShell(){
  const el = document.createElement('header');
  el.className = 'app-shell';
  el.innerHTML = `
    <a class="logo" href="/" aria-label="Plantit home">
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
  return el;
}
