import { DashboardViewModel, TodayPanelViewModel } from './dashboard/viewModel.js';
import { TodayPanel } from './dashboard/todayPanel.js';
import { downloadExportBundle, importBundleFromFile } from './services/importExport.js';
import { VillageDetailView } from './villages/detailView.js';
import {
  VillageDetailViewModel,
  VillageListViewModel,
  VillagePlantListViewModel,
} from './villages/viewModels.js';
import { VillageListView } from './villages/listView.js';
import { PlantListView } from './villages/plantListView.js';

const searchParams = new URLSearchParams(window.location.search);
const disableServiceWorkers = searchParams.get("no-sw") === "1";
const explicitSafeBoot = searchParams.get("safe") === "1";
const resumeSession = searchParams.get("resume") === "1";
const safeBoot = explicitSafeBoot || disableServiceWorkers;

const LAST_ROUTE_KEY = "plantit:lastRoute";
const MAX_ROUTE_LENGTH = 512;
const DEFAULT_ROUTE = "#dashboard";

const safeReadLocalStorage = (key, { maxLength = MAX_ROUTE_LENGTH, validator } = {}) => {
  if (!("localStorage" in window)) {
    return null;
  }

  try {
    const value = window.localStorage.getItem(key);
    if (typeof value !== "string") {
      return null;
    }

    if (value.length > maxLength) {
      console.warn(`Boot: ignoring oversized localStorage value for ${key}`);
      window.localStorage.removeItem(key);
      return null;
    }

    if (validator && !validator(value)) {
      return null;
    }

    return value;
  } catch (error) {
    console.warn(`Boot: failed to read localStorage key ${key}`, error);
    return null;
  }
};

const safeWriteLocalStorage = (key, value) => {
  if (!("localStorage" in window)) {
    return;
  }

  if (typeof value !== "string" || value.length > MAX_ROUTE_LENGTH) {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Boot: failed to write localStorage key ${key}`, error);
  }
};

const lastRoute = safeReadLocalStorage(LAST_ROUTE_KEY, {
  validator: (value) => value === "" || value.startsWith("#"),
});

if (resumeSession && lastRoute && lastRoute.startsWith("#") && window.location.hash === "") {
  console.info("Boot: resuming last known route");
  window.location.hash = lastRoute;
} else if (!resumeSession && window.location.hash === "") {
  console.info("Boot: applying default route");
  window.location.hash = DEFAULT_ROUTE;
}

const persistRoute = () => {
  const route = window.location.hash || DEFAULT_ROUTE;
  safeWriteLocalStorage(LAST_ROUTE_KEY, route);
};

window.addEventListener("hashchange", persistRoute, { passive: true });
persistRoute();

const unregisterServiceWorkers = async () => {
  if (!disableServiceWorkers || !("serviceWorker" in navigator)) {
    return;
  }

  console.info("Boot: service worker disable requested");

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) {
      console.info("Boot: no service workers to unregister");
      return;
    }

    await Promise.all(
      registrations.map(async (registration) => {
        await registration.unregister();
      })
    );
    console.info("Boot: service workers unregistered");
  } catch (error) {
    console.warn("Boot: failed to unregister service workers", error);
  }
};

const createSafeModeBanner = () => {
  if (!safeBoot) {
    return null;
  }

  const banner = document.createElement("div");
  banner.id = "safe-mode-banner";
  banner.textContent = "Safe Mode — Router/Store disabled.";
  Object.assign(banner.style, {
    backgroundColor: "#7f1d1d",
    color: "#ffffff",
    fontWeight: "bold",
    padding: "0.75rem 1rem",
    textAlign: "center",
    width: "100%",
  });
  return banner;
};

console.info("Boot: pre-init");

unregisterServiceWorkers();

const onReady = () => {
  console.info("Boot: DOM ready");
  const root = document.getElementById("app");
  if (!root) {
    console.warn("Boot: missing #app root");
  } else if (safeBoot) {
    const banner = createSafeModeBanner();
    if (banner) {
      document.body.prepend(banner);
      root.style.marginTop = "1rem";
    }
    mountShell(root, { statusText: "Plantit — Safe Shell", safeMode: true });
  } else {
    mountShell(root, { statusText: "Plantit — Shell Ready", safeMode: false });
  }
  console.info("Boot: shell mounted");
};

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", onReady, { once: true });
} else {
  onReady();
}

function mountShell(root, { statusText, safeMode }) {
  root.innerHTML = "";
  const status = document.createElement("p");
  status.id = "shell-status";
  status.textContent = statusText;
  root.append(status);

  if (!safeMode) {
    const navigation = buildMainNavigation();
    root.append(navigation);

    const contentHost = document.createElement("div");
    contentHost.id = "shell-content";
    root.append(contentHost);

    const dashboardSection = buildDashboardSection();
    dashboardSection.dataset.route = "dashboard";
    toggleSection(dashboardSection, true);

    const villagesSection = buildVillagesSection();
    villagesSection.dataset.route = "villages";
    toggleSection(villagesSection, false);

    contentHost.append(dashboardSection, villagesSection);

    const dashboardViewModel = new DashboardViewModel();
    new DashboardView(dashboardSection, dashboardViewModel);
    dashboardViewModel.load();

    const todayPanelRoot = dashboardSection.querySelector('[data-role="today-panel-root"]');
    const todayPanelViewModel = new TodayPanelViewModel();
    if (todayPanelRoot) {
      new TodayPanel(todayPanelRoot, todayPanelViewModel);
    }
    todayPanelViewModel.load();

    const listRoot = villagesSection.querySelector('[data-role="village-list-root"]');
    const detailRoot = villagesSection.querySelector('[data-role="village-detail-root"]');
    const plantListRoot = villagesSection.querySelector('[data-role="plant-list-root"]');
    const villageListViewModel = new VillageListViewModel();
    const villageDetailViewModel = new VillageDetailViewModel();
    const villagePlantListViewModel = new VillagePlantListViewModel();

    if (!listRoot || !detailRoot || !plantListRoot) {
      console.warn("Boot: villages panel missing expected subtrees");
    }

    if (listRoot) {
      new VillageListView(listRoot, villageListViewModel, {
        onSelect: (villageId) => {
          const targetHash = villageId ? `#villages/${encodeURIComponent(villageId)}` : "#villages";
          if (window.location.hash !== targetHash) {
            window.location.hash = targetHash;
          }
        },
      });
    }

    if (detailRoot) {
      new VillageDetailView(detailRoot, villageDetailViewModel, {
        onBack: () => {
          if (window.location.hash !== "#villages") {
            window.location.hash = "#villages";
          } else {
            villageDetailViewModel.clear();
          }
        },
      });
    }

    if (plantListRoot) {
      new PlantListView(plantListRoot, villagePlantListViewModel);
    }

    const router = new HashRouter((route) => {
      handleRoute({
        route,
        navigation,
        dashboardSection,
        villagesSection,
        villageListViewModel,
        villageDetailViewModel,
        villagePlantListViewModel,
      });
    });
    router.start();
  }

  const transferPanel = buildTransferPanel();
  root.append(transferPanel);

  initializeImportExportControls(root);
}

function buildMainNavigation() {
  const nav = document.createElement("nav");
  nav.id = "main-nav";
  nav.setAttribute("aria-label", "Primary navigation");

  const dashboardLink = document.createElement("a");
  dashboardLink.href = "#dashboard";
  dashboardLink.dataset.route = "dashboard";
  dashboardLink.textContent = "Dashboard";

  const villagesLink = document.createElement("a");
  villagesLink.href = "#villages";
  villagesLink.dataset.route = "villages";
  villagesLink.textContent = "Villages";

  nav.append(dashboardLink, villagesLink);
  return nav;
}

function buildVillagesSection() {
  const section = document.createElement("section");
  section.id = "villages-panel";
  section.innerHTML = `
    <div class="villages-header">
      <h2>Villages</h2>
      <div class="villages-controls">
        <form class="villages-search" data-role="village-search-form">
          <label class="sr-only" for="village-search-input">Search villages</label>
          <input id="village-search-input" type="search" data-role="village-search" placeholder="Search villages" />
          <button type="submit">Search</button>
        </form>
        <button type="button" class="villages-refresh" data-action="refresh">Refresh</button>
      </div>
    </div>
    <div class="villages-body">
      <div class="villages-list-root" data-role="village-list-root">
        <p class="villages-loading" data-role="village-loading" role="status" aria-live="polite">Loading villages…</p>
        <p class="villages-empty" data-role="village-empty">No villages match the current filters.</p>
        <ul class="villages-list" data-role="village-list" role="listbox" aria-label="Villages"></ul>
        <div class="villages-error" data-role="village-error" role="alert" hidden>
          <p class="villages-error-message" data-role="village-error-message">Unable to load villages.</p>
          <button type="button" class="villages-retry" data-action="retry">Retry</button>
        </div>
      </div>
      <div class="villages-detail-root" data-role="village-detail-root">
        <div class="village-detail">
          <p class="village-detail-placeholder" data-role="detail-placeholder">Select a village from the list to see its details.</p>
          <p class="village-detail-loading" data-role="detail-loading" role="status" aria-live="polite">Loading village details…</p>
          <div class="village-detail-error" data-role="detail-error" role="alert" hidden>
            <p data-role="detail-error-message">Unable to load village details.</p>
            <button type="button" class="village-detail-retry" data-action="detail-retry">Retry</button>
          </div>
          <article class="village-detail-card" data-role="detail-content" hidden>
            <header class="village-detail-header">
              <span class="village-detail-climate" data-role="detail-climate"></span>
              <h3 data-role="detail-name"></h3>
              <p class="village-detail-description" data-role="detail-description"></p>
            </header>
            <dl class="village-detail-stats">
              <div><dt>Established</dt><dd data-role="detail-established"></dd></div>
              <div><dt>Plants</dt><dd data-role="detail-plants"></dd></div>
              <div><dt>Health</dt><dd data-role="detail-health"></dd></div>
              <div><dt>Irrigation</dt><dd data-role="detail-irrigation"></dd></div>
            </dl>
            <button type="button" class="village-detail-back" data-action="detail-back">Back to list</button>
          </article>
        </div>
        <div class="village-plants-panel" data-role="plant-list-root">
          <div class="village-plants-header" data-role="plant-header" hidden>
            <div class="village-plants-header-text">
              <h3>Plants</h3>
              <p class="village-plants-subtitle" data-role="plant-village-name"></p>
              <p class="village-plants-updated" data-role="plant-updated" role="status" aria-live="polite">No data loaded yet</p>
            </div>
            <button type="button" class="village-plants-refresh" data-action="plant-refresh">Refresh</button>
          </div>
          <p class="village-plants-placeholder" data-role="plant-placeholder">Select a village to see its plants.</p>
          <p class="village-plants-loading" data-role="plant-loading" role="status" aria-live="polite" hidden>Loading plants…</p>
          <div class="village-plants-error" data-role="plant-error" role="alert" hidden>
            <p data-role="plant-error-message">Unable to load plants.</p>
            <button type="button" class="village-plants-retry" data-action="plant-retry">Retry</button>
          </div>
          <div class="village-plants-content" data-role="plant-content" hidden>
            <ul class="village-plants-list" data-role="plant-list"></ul>
            <p class="village-plants-empty" data-role="plant-empty">No plants recorded for this village yet.</p>
          </div>
        </div>
      </div>
    </div>
  `;
  return section;
}

function toggleSection(section, isVisible) {
  if (!section) {
    return;
  }
  section.hidden = !isVisible;
  section.setAttribute("aria-hidden", String(!isVisible));
}

function setActiveNavigation(navigation, activeRoute) {
  if (!navigation) {
    return;
  }
  navigation.querySelectorAll('[data-route]').forEach((link) => {
    if (!(link instanceof HTMLElement)) {
      return;
    }
    const isActive = link.dataset.route === activeRoute;
    if (isActive) {
      link.setAttribute("aria-current", "page");
      link.dataset.active = "true";
    } else {
      link.removeAttribute("aria-current");
      link.dataset.active = "false";
    }
  });
}

function handleRoute({
  route,
  navigation,
  dashboardSection,
  villagesSection,
  villageListViewModel,
  villageDetailViewModel,
  villagePlantListViewModel,
}) {
  const segments = Array.isArray(route.segments) ? route.segments : [];
  const [firstSegment = ""] = segments;
  const activeSegment = firstSegment || "dashboard";

  if (activeSegment === "dashboard") {
    setActiveNavigation(navigation, "dashboard");
    toggleSection(dashboardSection, true);
    toggleSection(villagesSection, false);
    if (!firstSegment && window.location.hash !== DEFAULT_ROUTE) {
      window.location.hash = DEFAULT_ROUTE;
    }
    return;
  }

  if (activeSegment === "villages") {
    setActiveNavigation(navigation, "villages");
    toggleSection(dashboardSection, false);
    toggleSection(villagesSection, true);

    villageListViewModel.ensureLoaded();
    const selectedId = segments[1] || null;
    villageListViewModel.setSelectedVillageId(selectedId);
    if (selectedId) {
      villageDetailViewModel.load(selectedId);
      villagePlantListViewModel.load(selectedId);
    } else {
      villageDetailViewModel.clear();
      villagePlantListViewModel.clear();
    }
    return;
  }

  if (window.location.hash !== DEFAULT_ROUTE) {
    window.location.hash = DEFAULT_ROUTE;
  }
}

class HashRouter {
  constructor(onChange) {
    this._onChange = onChange;
    this._listener = () => {
      this._emit();
    };
  }

  start() {
    window.addEventListener("hashchange", this._listener, { passive: true });
    this._emit();
  }

  stop() {
    window.removeEventListener("hashchange", this._listener);
  }

  _emit() {
    const rawHash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const trimmed = rawHash.trim();
    const segments = trimmed
      ? trimmed.split("/").map((segment) => {
          try {
            return decodeURIComponent(segment);
          } catch (error) {
            console.warn("HashRouter: failed to decode segment", segment, error);
            return segment;
          }
        })
      : [];
    this._onChange({
      raw: window.location.hash,
      hash: trimmed,
      segments,
    });
  }
}

function initializeImportExportControls(root) {
  const importButton = root.querySelector("#import-button");
  const importInput = root.querySelector("#import-file-input");
  const importStatus = root.querySelector("#import-status");
  const exportButton = root.querySelector("#export-button");
  const exportStatus = root.querySelector("#export-status");

  if (!importButton || !importInput || !importStatus || !exportButton || !exportStatus) {
    console.warn("Boot: missing import/export controls");
    return;
  }

  importButton.addEventListener("click", () => {
    importStatus.textContent = "Choose a Plantit bundle (.json).";
    importInput.click();
  });

  importInput.addEventListener("change", async () => {
    if (!importInput.files || importInput.files.length === 0) {
      importStatus.textContent = "No file selected.";
      return;
    }

    const file = importInput.files[0];
    importStatus.textContent = `Reading ${file.name}…`;

    try {
      await importBundleFromFile(file, (event) => {
        importStatus.textContent = event.message;
        console.info(`Import progress: ${event.stage}`, event);
      });
      importStatus.textContent = "Import preview complete. Ready for full app.";
    } catch (error) {
      console.error("Import bundle failed", error);
      importStatus.textContent = error?.message || "Import failed.";
    } finally {
      importInput.value = "";
    }
  });

  exportButton.addEventListener("click", async () => {
    exportStatus.textContent = "Preparing export…";

    try {
      await downloadExportBundle(exportStatus);
    } catch (error) {
      console.error("Export bundle failed", error);
      exportStatus.textContent = error?.message || "Export failed.";
    }
  });
}

function buildTransferPanel() {
  const transferPanel = document.createElement("section");
  transferPanel.id = "transfer-panel";
  transferPanel.innerHTML = `
    <h2>Data Transfer</h2>
    <p class="panel-subtitle">Import bundles or download a backup.</p>
    <div class="transfer-group">
      <button id="import-button" type="button">Import Bundle</button>
      <input id="import-file-input" type="file" accept="application/json" hidden />
      <p id="import-status" class="status-text" role="status" aria-live="polite"></p>
    </div>
    <div class="transfer-group">
      <button id="export-button" type="button">Download Export</button>
      <p id="export-status" class="status-text" role="status" aria-live="polite"></p>
    </div>
  `;
  return transferPanel;
}

const DASHBOARD_CARD_CONFIG = [
  { key: "totalPlants", label: "Total Plants" },
  { key: "activeVillages", label: "Active Villages" },
  {
    key: "successRate",
    label: "Avg Health Score",
    formatter: (value) => `${Math.round(Math.max(0, Math.min(1, value ?? 0)) * 100)}%`,
  },
  { key: "upcomingTasks", label: "Upcoming Tasks" },
];

function buildDashboardSection() {
  const section = document.createElement("section");
  section.id = "dashboard-panel";

  const header = document.createElement("div");
  header.className = "dashboard-header";

  const heading = document.createElement("h2");
  heading.textContent = "Dashboard";

  const updated = document.createElement("p");
  updated.className = "dashboard-updated";
  updated.setAttribute("role", "status");
  updated.setAttribute("aria-live", "polite");
  updated.textContent = "Loading dashboard…";

  header.append(heading, updated);

  const content = document.createElement("div");
  content.className = "dashboard-content";

  const cards = document.createElement("div");
  cards.className = "dashboard-cards";

  for (const cardConfig of DASHBOARD_CARD_CONFIG) {
    const card = document.createElement("article");
    card.className = "dashboard-card";
    card.dataset.cardKey = cardConfig.key;

    const label = document.createElement("span");
    label.className = "dashboard-card-label";
    label.textContent = cardConfig.label;

    const value = document.createElement("span");
    value.className = "dashboard-card-value";
    value.dataset.placeholder = "true";
    value.textContent = "\u00A0";

    card.append(label, value);
    cards.append(card);
  }

  const alerts = document.createElement("div");
  alerts.className = "dashboard-alerts";

  const alertsHeading = document.createElement("h3");
  alertsHeading.textContent = "Alerts";

  const alertList = document.createElement("ul");
  alertList.className = "dashboard-alert-list";
  alertList.setAttribute("aria-live", "polite");

  const emptyState = document.createElement("p");
  emptyState.className = "dashboard-alert-empty";
  emptyState.textContent = "All clear. No alerts right now.";
  emptyState.hidden = true;

  alerts.append(alertsHeading, alertList, emptyState);

  const today = document.createElement("div");
  today.className = "today-panel";
  today.dataset.role = "today-panel-root";
  today.innerHTML = `
    <div class="today-panel-header">
      <div class="today-panel-title">
        <h3>Today</h3>
        <p class="today-panel-updated" data-role="today-updated" role="status" aria-live="polite">Today's tasks not loaded yet</p>
      </div>
      <button type="button" class="today-panel-refresh" data-action="today-refresh">Refresh</button>
    </div>
    <p class="today-panel-placeholder" data-role="today-placeholder">Refresh to see today's scheduled tasks.</p>
    <p class="today-panel-loading" data-role="today-loading" role="status" aria-live="polite" hidden>Loading today's tasks…</p>
    <div class="today-panel-error" data-role="today-error" role="alert" hidden>
      <p data-role="today-error-message">Unable to load today's tasks.</p>
      <button type="button" data-action="today-retry">Retry</button>
    </div>
    <div class="today-panel-content" data-role="today-content" hidden>
      <ul class="today-task-list" data-role="today-task-list"></ul>
      <p class="today-panel-empty" data-role="today-empty">No tasks scheduled for today.</p>
    </div>
  `;

  content.append(cards, alerts, today);

  const errorPanel = document.createElement("div");
  errorPanel.className = "dashboard-error";
  errorPanel.setAttribute("role", "alert");
  errorPanel.hidden = true;

  const errorMessage = document.createElement("p");
  errorMessage.className = "dashboard-error-message";
  errorMessage.textContent = "Unable to load dashboard.";

  const retryButton = document.createElement("button");
  retryButton.className = "dashboard-retry-button";
  retryButton.type = "button";
  retryButton.textContent = "Retry";

  errorPanel.append(errorMessage, retryButton);

  section.append(header, content, errorPanel);

  return section;
}

class DashboardView {
  constructor(section, viewModel) {
    this.section = section;
    this.viewModel = viewModel;
    this.updated = section.querySelector(".dashboard-updated");
    this.content = section.querySelector(".dashboard-content");
    this.cards = new Map();

    section.querySelectorAll(".dashboard-card").forEach((card) => {
      const key = card.dataset.cardKey;
      const value = card.querySelector(".dashboard-card-value");
      if (key && value) {
        this.cards.set(key, value);
      }
    });

    this.alertList = section.querySelector(".dashboard-alert-list");
    this.alertEmpty = section.querySelector(".dashboard-alert-empty");
    this.errorPanel = section.querySelector(".dashboard-error");
    this.errorMessage = section.querySelector(".dashboard-error-message");
    this.retryButton = section.querySelector(".dashboard-retry-button");

    if (this.retryButton) {
      this.retryButton.addEventListener("click", () => {
        this.viewModel.retry();
      });
    }

    this.unsubscribe = this.viewModel.subscribe((state) => {
      this.render(state);
    });
  }

  render(state) {
    this.section.dataset.status = state.status;
    switch (state.status) {
      case "idle":
      case "loading":
        this.renderLoading();
        break;
      case "ready":
        this.renderReady(state);
        break;
      case "error":
        this.renderError(state);
        break;
      default:
        break;
    }
  }

  renderLoading() {
    if (this.errorPanel) {
      this.errorPanel.hidden = true;
    }
    if (this.content) {
      this.content.hidden = false;
    }
    if (this.updated) {
      this.updated.textContent = "Loading dashboard…";
    }
    for (const value of this.cards.values()) {
      value.dataset.placeholder = "true";
      value.textContent = "\u00A0";
    }
    if (this.alertList) {
      this.alertList.replaceChildren(...createAlertPlaceholders());
    }
    if (this.alertEmpty) {
      this.alertEmpty.hidden = true;
    }
  }

  renderReady(state) {
    if (this.errorPanel) {
      this.errorPanel.hidden = true;
    }
    if (this.content) {
      this.content.hidden = false;
    }

    const summary = state.summary;

    for (const [key, element] of this.cards.entries()) {
      if (summary && key in summary && typeof summary[key] === "number") {
        const formatter = DASHBOARD_CARD_CONFIG.find((item) => item.key === key)?.formatter;
        element.textContent = formatter
          ? formatter(summary[key])
          : Number(summary[key]).toLocaleString();
        delete element.dataset.placeholder;
      } else {
        element.dataset.placeholder = "true";
        element.textContent = "\u00A0";
      }
    }

    if (this.updated) {
      this.updated.textContent = formatLastUpdated(state.lastUpdated);
    }

    if (this.alertList) {
      if (state.alerts.length === 0) {
        this.alertList.replaceChildren();
        if (this.alertEmpty) {
          this.alertEmpty.hidden = false;
        }
      } else {
        const alertItems = state.alerts.map((alert) => createAlertListItem(alert));
        this.alertList.replaceChildren(...alertItems);
        if (this.alertEmpty) {
          this.alertEmpty.hidden = true;
        }
      }
    }
  }

  renderError(state) {
    if (this.content) {
      this.content.hidden = true;
    }
    if (this.errorPanel) {
      this.errorPanel.hidden = false;
    }
    if (this.alertEmpty) {
      this.alertEmpty.hidden = true;
    }
    if (this.alertList) {
      this.alertList.replaceChildren();
    }
    if (this.updated) {
      this.updated.textContent = "Dashboard unavailable";
    }
    if (this.errorMessage) {
      this.errorMessage.textContent = state.error?.message ?? "Unable to load dashboard.";
    }
  }
}

function createAlertPlaceholders() {
  return [1, 2].map(() => {
    const item = document.createElement("li");
    item.className = "dashboard-alert-item";

    const badge = document.createElement("span");
    badge.className = "dashboard-alert-badge";
    badge.dataset.placeholder = "true";
    badge.textContent = "\u00A0";

    const message = document.createElement("p");
    message.className = "dashboard-alert-message";
    message.dataset.placeholder = "true";
    message.textContent = "\u00A0";

    item.append(badge, message);
    return item;
  });
}

function createAlertListItem(alert) {
  const item = document.createElement("li");
  item.className = "dashboard-alert-item";

  const badge = document.createElement("span");
  badge.className = `dashboard-alert-badge level-${sanitizeLevel(alert.level)}`;
  badge.textContent = formatAlertLevel(alert.level);

  const message = document.createElement("p");
  message.className = "dashboard-alert-message";
  message.textContent = alert.message;

  if (alert.relatedPlantId) {
    message.dataset.relatedPlantId = alert.relatedPlantId;
  }

  item.append(badge, message);
  return item;
}

function sanitizeLevel(level) {
  if (level === "critical" || level === "warning" || level === "info") {
    return level;
  }
  return "info";
}

function formatAlertLevel(level) {
  const normalized = sanitizeLevel(level);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatLastUpdated(timestamp) {
  if (!timestamp) {
    return "Updated just now";
  }
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return "Updated just now";
  }
  return `Updated ${parsed.toLocaleString()}`;
}

export { safeBoot };
