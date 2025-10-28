export function AppShell(){
  const el = document.createElement('div');
  el.className = 'app-shell';
  el.innerHTML = `
    <div class="logo"><span class="leaf">🍃</span> <span>Plantit</span></div>
    <div class="spacer"></div>
    <input type="search" placeholder="Search plants, tags, logs...">
    <div class="icons">🔔 ⚙️ <span class="avatar"></span></div>
  `;
  return el;
}
