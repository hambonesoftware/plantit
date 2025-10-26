export function initShell(root = document.getElementById("app-shell")) {
  if (!root) {
    throw new Error("Shell root element '#app-shell' not found");
  }

  root.innerHTML = `
    <header class="app-shell__topbar" role="banner">
      <a class="app-shell__logo" href="#/" aria-label="Plantit home">
        🌱 Plantit
      </a>
      <form class="app-shell__search" role="search">
        <label class="visually-hidden" for="global-search">Search plants and villages</label>
        <input id="global-search" type="search" name="q" placeholder="Search villages, plants, tasks" autocomplete="off" />
        <svg class="app-shell__search-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24">
          <path fill="currentColor" d="M10.5 3a7.5 7.5 0 0 1 5.966 12.11l3.712 3.712a1 1 0 0 1-1.414 1.414l-3.712-3.712A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11a5.5 5.5 0 0 0 0-11Z" />
        </svg>
      </form>
      <nav aria-label="Primary" class="app-shell__actions">
        <a href="#/tasks">Tasks</a>
        <a href="#/settings">Settings</a>
        <span class="app-shell__profile" aria-hidden="true">PR</span>
      </nav>
    </header>
    <div class="app-shell__content">
      <main class="app-shell__main" id="main-content" tabindex="-1" aria-live="polite"></main>
      <aside class="app-shell__sidebar" aria-label="Secondary"></aside>
    </div>
  `;

  const main = root.querySelector(".app-shell__main");
  const sidebar = root.querySelector(".app-shell__sidebar");

  return {
    root,
    main,
    sidebar,
    focusMain() {
      main?.focus({ preventScroll: false });
    },
    setSidebar(content) {
      sidebar.replaceChildren();
      if (content instanceof HTMLElement) {
        sidebar.appendChild(content);
      } else if (typeof content === "string") {
        sidebar.innerHTML = content;
      }
    },
  };
}
