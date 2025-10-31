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
import { copyDiagnosticsToClipboard } from './services/diagnostics.js';
import { createToastHost, registerToastHost, showToast } from './services/toast.js';
import { HttpError, NetworkError } from './services/api.js';
import { fetchAuthStatus, login as loginRequest, logout as logoutRequest } from './services/auth.js';

const searchParams = new URLSearchParams(window.location.search);
const disableServiceWorkers = searchParams.get("no-sw") === "1";
const explicitSafeBoot = searchParams.get("safe") === "1";
const resumeSession = searchParams.get("resume") === "1";
const safeBoot = explicitSafeBoot || disableServiceWorkers;

const LAST_ROUTE_KEY = "plantit:lastRoute";
const MAX_ROUTE_LENGTH = 512;
const DEFAULT_ROUTE = "#dashboard";

const authController = createAuthController();

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

function createAuthController() {
  const state = {
    enabled: false,
    authenticated: true,
    username: null,
  };

  let initialized = false;
  let overlay = null;
  let form = null;
  let usernameInput = null;
  let passwordInput = null;
  let errorMessage = null;
  let submitButton = null;
  let navButton = null;
  let submitting = false;
  let navBusy = false;

  function initialize() {
    if (initialized) {
      return;
    }
    initialized = true;
    overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <h2 id="auth-title">Sign in to manage plants</h2>
        <p class="auth-subtitle">Read access stays open; sign in to create or edit data.</p>
        <form novalidate>
          <label>
            Username
            <input type="text" name="username" autocomplete="username" required />
          </label>
          <label>
            Password
            <input type="password" name="password" autocomplete="current-password" required />
          </label>
          <p class="auth-error" data-role="auth-error" hidden></p>
          <div class="form-actions">
            <button type="submit">Sign in</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);

    form = overlay.querySelector('form');
    usernameInput = overlay.querySelector('input[name="username"]');
    passwordInput = overlay.querySelector('input[name="password"]');
    errorMessage = overlay.querySelector('[data-role="auth-error"]');
    submitButton = form?.querySelector('button[type="submit"]') ?? null;

    if (form) {
      form.addEventListener('submit', handleSubmit);
    }

    window.addEventListener('plantit:auth-required', handleAuthRequired);
  }

  function attachNavigation(nav) {
    initialize();
    if (navButton) {
      navButton.remove();
    }

    navButton = document.createElement('button');
    navButton.type = 'button';
    navButton.id = 'account-button';
    navButton.textContent = 'Sign in';
    navButton.addEventListener('click', () => {
      if (!state.enabled) {
        showToast({ message: 'Sign-in is disabled in this mode.', tone: 'info' });
        return;
      }
      if (state.authenticated) {
        void handleLogout();
      } else {
        showOverlay();
      }
    });
    nav.append(navButton);
    updateUi();
  }

  function showOverlay() {
    if (!overlay) {
      return;
    }
    overlay.hidden = false;
    clearError();
    requestAnimationFrame(() => {
      usernameInput?.focus();
    });
  }

  async function refreshStatus() {
    initialize();
    try {
      const status = await fetchAuthStatus();
      applyStatus(status);
    } catch (error) {
      console.warn('Auth: status check failed', error);
      if (state.enabled) {
        showToast({
          message: 'Unable to verify sign-in status. Actions may be restricted.',
          tone: 'warning',
        });
      }
    }
  }

  function applyStatus(status) {
    const enabled = Boolean(status?.authEnabled);
    state.enabled = enabled;
    const authenticated = !enabled || Boolean(status?.authenticated);
    state.authenticated = authenticated;
    const username =
      authenticated && typeof status?.username === 'string' && status.username.trim()
        ? status.username.trim()
        : null;
    state.username = username;
    updateUi();
  }

  function updateUi() {
    const requireLogin = state.enabled && !state.authenticated;
    if (overlay) {
      overlay.hidden = !requireLogin;
      if (!requireLogin && form) {
        form.reset();
        clearError();
      } else if (requireLogin) {
        requestAnimationFrame(() => {
          usernameInput?.focus();
        });
      }
    }
    if (navButton) {
      navButton.hidden = !state.enabled;
      navButton.dataset.state = state.authenticated ? 'authenticated' : 'unauthenticated';
      navButton.disabled = navBusy;
      navButton.textContent = state.authenticated
        ? state.username
          ? `Sign out (${state.username})`
          : 'Sign out'
        : 'Sign in';
    }
    if (!requireLogin) {
      submitting = false;
      setFormDisabled(false);
    }
  }

  function setFormDisabled(disabled) {
    usernameInput?.setAttribute('aria-busy', String(disabled));
    passwordInput?.setAttribute('aria-busy', String(disabled));
    if (usernameInput) {
      usernameInput.disabled = disabled;
    }
    if (passwordInput) {
      passwordInput.disabled = disabled;
    }
    if (submitButton) {
      submitButton.disabled = disabled;
    }
  }

  function clearError() {
    if (errorMessage) {
      errorMessage.textContent = '';
      errorMessage.hidden = true;
    }
  }

  function showError(message) {
    if (!errorMessage) {
      return;
    }
    errorMessage.textContent = message;
    errorMessage.hidden = false;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) {
      return;
    }
    if (!state.enabled) {
      overlay?.setAttribute('hidden', 'hidden');
      return;
    }
    const username = usernameInput?.value.trim() ?? '';
    const password = passwordInput?.value ?? '';
    if (!username || !password) {
      showError('Username and password are required.');
      return;
    }
    submitting = true;
    clearError();
    setFormDisabled(true);
    try {
      const status = await loginRequest({ username, password });
      applyStatus(status);
      if (state.authenticated) {
        showToast({
          message: state.username ? `Signed in as ${state.username}.` : 'Signed in.',
          tone: 'success',
        });
      } else {
        showError('Sign-in failed. Please try again.');
      }
    } catch (error) {
      console.warn('Auth: login failed', error);
      if (error instanceof HttpError && error.status === 401) {
        showError('Invalid username or password.');
      } else if (error instanceof NetworkError) {
        showError('Unable to reach Plantit. Check your connection and try again.');
      } else {
        showError('Sign-in failed. Please try again.');
      }
    } finally {
      submitting = false;
      setFormDisabled(false);
      if (!state.authenticated && passwordInput) {
        passwordInput.value = '';
        passwordInput.focus();
      } else if (state.authenticated && form) {
        form.reset();
      }
    }
  }

  async function handleLogout() {
    if (navBusy) {
      return;
    }
    navBusy = true;
    updateUi();
    try {
      const status = await logoutRequest();
      applyStatus(status);
      showToast({ message: 'Signed out.', tone: 'info' });
    } catch (error) {
      console.warn('Auth: logout failed', error);
      showToast({ message: 'Sign-out failed. Please try again.', tone: 'warning' });
    } finally {
      navBusy = false;
      updateUi();
    }
  }

  function handleAuthRequired() {
    if (!state.enabled) {
      void refreshStatus();
      return;
    }
    if (state.authenticated) {
      showToast({ message: 'Please sign in to continue.', tone: 'info' });
    }
    state.authenticated = false;
    updateUi();
    void refreshStatus();
  }

  return {
    initialize,
    attachNavigation,
    refreshStatus,
  };
}

console.info("Boot: pre-init");

unregisterServiceWorkers();

const onReady = () => {
  console.info("Boot: DOM ready");
  authController.initialize();
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
  authController.refreshStatus();
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

  const existingHost = document.querySelector('.toast-host');
  if (existingHost) {
    existingHost.remove();
  }
  const toastHost = createToastHost();
  document.body.appendChild(toastHost);
  registerToastHost(toastHost);

  if (!safeMode) {
    const navigation = buildMainNavigation();
    root.append(navigation);
    authController.attachNavigation(navigation);

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
    const villageDetailViewModel = new VillageDetailViewModel();
    let villagePlantListViewModel;
    const villageListViewModel = new VillageListViewModel({
      onVillageUpdate: (village) => {
        villageDetailViewModel.applyExternalVillage(village);
        if (villagePlantListViewModel) {
          villagePlantListViewModel.applyExternalVillage(village);
        }
      },
      onVillageDelete: (villageId) => {
        villageDetailViewModel.handleVillageDeleted(villageId);
        if (villagePlantListViewModel) {
          villagePlantListViewModel.handleVillageDeleted(villageId);
        }
      },
    });
    villagePlantListViewModel = new VillagePlantListViewModel({
      onVillageUpdate: (village) => {
        villageListViewModel.applyExternalVillage(village);
        villageDetailViewModel.applyExternalVillage(village);
      },
    });

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

    setupVillageCreateForm(villagesSection, {
      listViewModel: villageListViewModel,
      detailViewModel: villageDetailViewModel,
      plantListViewModel: villagePlantListViewModel,
    });
    setupVillageDetailEditor(detailRoot, {
      listViewModel: villageListViewModel,
      detailViewModel: villageDetailViewModel,
      plantListViewModel: villagePlantListViewModel,
    });
    setupPlantForm(plantListRoot, {
      plantListViewModel: villagePlantListViewModel,
    });

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
        <button type="button" class="villages-create-toggle" data-action="village-create-toggle">New Village</button>
      </div>
    </div>
    <div class="villages-body">
      <div class="villages-list-root" data-role="village-list-root">
        <p class="villages-loading" data-role="village-loading" role="status" aria-live="polite">Loading villages…</p>
        <p class="villages-empty" data-role="village-empty">No villages match the current filters.</p>
        <form class="village-create-form" data-role="village-create-form" hidden>
          <fieldset>
            <legend>Create Village</legend>
            <label> Name
              <input type="text" name="village-name" data-role="village-name" required />
            </label>
            <label> Climate
              <input type="text" name="village-climate" data-role="village-climate" required />
            </label>
            <label> Health Score
              <input type="number" name="village-health" data-role="village-health" min="0" max="1" step="0.01" value="0.5" required />
            </label>
            <label> Established
              <input type="date" name="village-established" data-role="village-established" />
            </label>
            <label> Irrigation
              <input type="text" name="village-irrigation" data-role="village-irrigation" />
            </label>
            <label> Description
              <textarea name="village-description" data-role="village-description"></textarea>
            </label>
          </fieldset>
          <p class="form-error" data-role="village-create-error" hidden></p>
          <div class="form-actions">
            <button type="submit">Save Village</button>
            <button type="button" data-action="village-create-cancel">Cancel</button>
          </div>
        </form>
        <ul class="villages-list" data-role="village-list" role="listbox" aria-label="Villages"></ul>
        <div class="villages-error" data-role="village-error" role="alert" hidden>
          <p class="villages-error-message" data-role="village-error-message">Unable to load villages.</p>
          <button type="button" class="villages-retry" data-action="retry">Retry</button>
          <button type="button" class="villages-copy" data-action="villages-copy-error">Copy details</button>
        </div>
      </div>
      <div class="villages-detail-root" data-role="village-detail-root">
        <div class="village-detail">
          <p class="village-detail-placeholder" data-role="detail-placeholder">Select a village from the list to see its details.</p>
          <p class="village-detail-loading" data-role="detail-loading" role="status" aria-live="polite">Loading village details…</p>
          <div class="village-detail-error" data-role="detail-error" role="alert" hidden>
            <p data-role="detail-error-message">Unable to load village details.</p>
            <div class="village-detail-error-actions">
              <button type="button" class="village-detail-retry" data-action="detail-retry">Retry</button>
              <button type="button" class="village-detail-copy" data-action="detail-copy-error">Copy details</button>
            </div>
          </div>
          <article class="village-detail-card" data-role="detail-content" hidden>
            <header class="village-detail-header">
              <span class="village-detail-climate" data-role="detail-climate"></span>
              <h3 data-role="detail-name"></h3>
              <p class="village-detail-description" data-role="detail-description"></p>
            </header>
            <div class="village-detail-actions">
              <button type="button" class="village-detail-edit" data-action="detail-edit">Edit</button>
              <button type="button" class="village-detail-delete" data-action="detail-delete">Delete</button>
            </div>
            <dl class="village-detail-stats">
              <div><dt>Established</dt><dd data-role="detail-established"></dd></div>
              <div><dt>Plants</dt><dd data-role="detail-plants"></dd></div>
              <div><dt>Health</dt><dd data-role="detail-health"></dd></div>
              <div><dt>Irrigation</dt><dd data-role="detail-irrigation"></dd></div>
            </dl>
            <form class="village-detail-form" data-role="detail-form" hidden>
              <input type="hidden" data-role="detail-updated-at" />
              <label> Name
                <input type="text" data-role="detail-name-input" required />
              </label>
              <label> Climate
                <input type="text" data-role="detail-climate-input" required />
              </label>
              <label> Health Score
                <input type="number" min="0" max="1" step="0.01" data-role="detail-health-input" required />
              </label>
              <label> Established
                <input type="date" data-role="detail-established-input" />
              </label>
              <label> Irrigation
                <input type="text" data-role="detail-irrigation-input" />
              </label>
              <label> Description
                <textarea data-role="detail-description-input"></textarea>
              </label>
              <p class="form-error" data-role="detail-form-error" hidden></p>
              <div class="form-actions">
                <button type="submit">Save Changes</button>
                <button type="button" data-action="detail-cancel">Cancel</button>
              </div>
            </form>
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
            <div class="village-plants-actions">
              <button type="button" class="village-plants-add" data-action="plant-create-toggle">Add Plant</button>
              <button type="button" class="village-plants-refresh" data-action="plant-refresh">Refresh</button>
            </div>
          </div>
          <p class="village-plants-placeholder" data-role="plant-placeholder">Select a village to see its plants.</p>
          <p class="village-plants-loading" data-role="plant-loading" role="status" aria-live="polite" hidden>Loading plants…</p>
          <div class="village-plants-error" data-role="plant-error" role="alert" hidden>
            <p data-role="plant-error-message">Unable to load plants.</p>
            <div class="village-plants-error-actions">
              <button type="button" class="village-plants-retry" data-action="plant-retry">Retry</button>
              <button type="button" class="village-plants-copy" data-action="plant-copy-error">Copy details</button>
            </div>
          </div>
          <div class="village-plants-content" data-role="plant-content" hidden>
            <form class="plant-edit-form" data-role="plant-form" hidden>
              <h4 data-role="plant-form-title">Add Plant</h4>
              <input type="hidden" data-role="plant-id" />
              <input type="hidden" data-role="plant-updated-at" />
              <label> Name
                <input type="text" data-role="plant-name" required />
              </label>
              <label> Species
                <input type="text" data-role="plant-species" required />
              </label>
              <label> Stage
                <select data-role="plant-stage">
                  <option value="seedling">Seedling</option>
                  <option value="vegetative">Vegetative</option>
                  <option value="flowering">Flowering</option>
                  <option value="mature">Mature</option>
                </select>
              </label>
              <label> Last Watered
                <input type="datetime-local" data-role="plant-last-watered" />
              </label>
              <label> Health Score
                <input type="number" min="0" max="1" step="0.01" data-role="plant-health" required />
              </label>
              <label> Notes
                <textarea data-role="plant-notes"></textarea>
              </label>
              <p class="form-error" data-role="plant-form-error" hidden></p>
              <div class="form-actions">
                <button type="submit">Save Plant</button>
                <button type="button" data-action="plant-delete" hidden>Delete</button>
                <button type="button" data-action="plant-cancel">Cancel</button>
              </div>
            </form>
            <ul class="village-plants-list" data-role="plant-list"></ul>
            <p class="village-plants-empty" data-role="plant-empty">No plants recorded for this village yet.</p>
          </div>
        </div>
      </div>
    </div>
  `;
  return section;
}

function setupVillageCreateForm(section, { listViewModel, detailViewModel, plantListViewModel }) {
  if (!section || !listViewModel) {
    return;
  }
  const form = section.querySelector('[data-role="village-create-form"]');
  const toggleButton = section.querySelector('[data-action="village-create-toggle"]');
  if (!form || !toggleButton) {
    return;
  }

  const nameInput = form.querySelector('[data-role="village-name"]');
  const climateInput = form.querySelector('[data-role="village-climate"]');
  const healthInput = form.querySelector('[data-role="village-health"]');
  const establishedInput = form.querySelector('[data-role="village-established"]');
  const irrigationInput = form.querySelector('[data-role="village-irrigation"]');
  const descriptionInput = form.querySelector('[data-role="village-description"]');
  const errorMessage = form.querySelector('[data-role="village-create-error"]');
  const cancelButton = form.querySelector('[data-action="village-create-cancel"]');

  const hideForm = () => {
    form.hidden = true;
    form.reset();
    if (errorMessage) {
      errorMessage.hidden = true;
    }
  };

  const showForm = () => {
    form.hidden = false;
    form.reset();
    if (errorMessage) {
      errorMessage.hidden = true;
    }
    if (healthInput) {
      healthInput.value = '0.5';
    }
    if (nameInput instanceof HTMLElement) {
      nameInput.focus();
    }
  };

  toggleButton.addEventListener('click', () => {
    if (form.hidden) {
      showForm();
    } else {
      hideForm();
    }
  });

  if (cancelButton) {
    cancelButton.addEventListener('click', hideForm);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
      return;
    }
    if (errorMessage) {
      errorMessage.hidden = true;
    }
    setFormDisabled(form, true);

    try {
      const detail = await listViewModel.createVillage({
        name: nameInput ? nameInput.value : '',
        climate: climateInput ? climateInput.value : '',
        healthScore: healthInput ? healthInput.value : '',
        establishedAt: establishedInput ? establishedInput.value : null,
        irrigationType: irrigationInput ? irrigationInput.value : null,
        description: descriptionInput ? descriptionInput.value : null,
      });
      detailViewModel.applyExternalVillage(detail);
      plantListViewModel.applyExternalVillage(detail);
      showToast({ message: `Created village “${detail.name}”`, tone: 'success' });
      window.location.hash = `#villages/${encodeURIComponent(detail.id)}`;
      hideForm();
    } catch (error) {
      const message = mutationErrorMessage(error, 'Failed to create village.');
      if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.hidden = false;
      }
      showMutationFailure(error, 'Failed to create village.');
    } finally {
      setFormDisabled(form, false);
    }
  });
}

function setupVillageDetailEditor(detailRoot, { listViewModel, detailViewModel, plantListViewModel }) {
  if (!detailRoot || !listViewModel || !detailViewModel) {
    return;
  }
  const form = detailRoot.querySelector('[data-role="detail-form"]');
  const editButton = detailRoot.querySelector('[data-action="detail-edit"]');
  const deleteButton = detailRoot.querySelector('[data-action="detail-delete"]');
  if (!form || !editButton) {
    return;
  }

  const nameInput = form.querySelector('[data-role="detail-name-input"]');
  const climateInput = form.querySelector('[data-role="detail-climate-input"]');
  const healthInput = form.querySelector('[data-role="detail-health-input"]');
  const establishedInput = form.querySelector('[data-role="detail-established-input"]');
  const irrigationInput = form.querySelector('[data-role="detail-irrigation-input"]');
  const descriptionInput = form.querySelector('[data-role="detail-description-input"]');
  const updatedAtInput = form.querySelector('[data-role="detail-updated-at"]');
  const cancelButton = form.querySelector('[data-action="detail-cancel"]');
  const errorMessage = form.querySelector('[data-role="detail-form-error"]');

  let currentVillage = null;

  const populateForm = (village) => {
    if (!village) {
      return;
    }
    if (nameInput) {
      nameInput.value = village.name ?? '';
    }
    if (climateInput) {
      climateInput.value = village.climate ?? '';
    }
    if (healthInput) {
      healthInput.value = `${village.healthScore ?? ''}`;
    }
    if (establishedInput) {
      establishedInput.value = village.establishedAt ?? '';
    }
    if (irrigationInput) {
      irrigationInput.value = village.irrigationType ?? '';
    }
    if (descriptionInput) {
      descriptionInput.value = village.description ?? '';
    }
    if (updatedAtInput) {
      updatedAtInput.value = village.updatedAt ?? '';
    }
  };

  const hideForm = () => {
    form.hidden = true;
    if (errorMessage) {
      errorMessage.hidden = true;
    }
  };

  editButton.addEventListener('click', () => {
    if (!currentVillage) {
      return;
    }
    populateForm(currentVillage);
    form.hidden = false;
    if (errorMessage) {
      errorMessage.hidden = true;
    }
    if (nameInput instanceof HTMLElement) {
      nameInput.focus();
    }
  });

  if (cancelButton) {
    cancelButton.addEventListener('click', hideForm);
  }

  if (deleteButton) {
    deleteButton.addEventListener('click', async () => {
      if (!currentVillage) {
        return;
      }
      if (!window.confirm(`Delete ${currentVillage.name}? This cannot be undone.`)) {
        return;
      }
      try {
        await listViewModel.deleteVillage(currentVillage.id, currentVillage.updatedAt);
        showToast({ message: `Deleted village “${currentVillage.name}”`, tone: 'success' });
        window.location.hash = '#villages';
      } catch (error) {
        showMutationFailure(error, 'Failed to delete village.');
      }
    });
  }

  detailViewModel.subscribe((state) => {
    currentVillage = state.village;
    if (!state.village) {
      hideForm();
      return;
    }
    if (!form.hidden) {
      populateForm(state.village);
    } else if (updatedAtInput) {
      updatedAtInput.value = state.village.updatedAt ?? '';
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentVillage) {
      return;
    }
    if (!form.reportValidity()) {
      return;
    }
    if (errorMessage) {
      errorMessage.hidden = true;
    }
    setFormDisabled(form, true);

    try {
      const detail = await listViewModel.updateVillage(currentVillage.id, {
        name: nameInput ? nameInput.value : '',
        climate: climateInput ? climateInput.value : '',
        healthScore: healthInput ? healthInput.value : currentVillage.healthScore,
        establishedAt: establishedInput ? establishedInput.value : currentVillage.establishedAt,
        irrigationType: irrigationInput ? irrigationInput.value : currentVillage.irrigationType,
        description: descriptionInput ? descriptionInput.value : currentVillage.description,
        updatedAt: updatedAtInput ? updatedAtInput.value : currentVillage.updatedAt,
      });
      detailViewModel.applyExternalVillage(detail);
      plantListViewModel.applyExternalVillage(detail);
      showToast({ message: `Updated village “${detail.name}”`, tone: 'success' });
      hideForm();
    } catch (error) {
      const message = mutationErrorMessage(error, 'Failed to update village.');
      if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.hidden = false;
      }
      showMutationFailure(error, 'Failed to update village.');
    } finally {
      setFormDisabled(form, false);
    }
  });
}

function setupPlantForm(root, { plantListViewModel }) {
  if (!root || !plantListViewModel) {
    return;
  }
  const form = root.querySelector('[data-role="plant-form"]');
  const toggleButton = root.querySelector('[data-action="plant-create-toggle"]');
  if (!form || !toggleButton) {
    return;
  }

  const title = form.querySelector('[data-role="plant-form-title"]');
  const idInput = form.querySelector('[data-role="plant-id"]');
  const updatedAtInput = form.querySelector('[data-role="plant-updated-at"]');
  const nameInput = form.querySelector('[data-role="plant-name"]');
  const speciesInput = form.querySelector('[data-role="plant-species"]');
  const stageInput = form.querySelector('[data-role="plant-stage"]');
  const lastWateredInput = form.querySelector('[data-role="plant-last-watered"]');
  const healthInput = form.querySelector('[data-role="plant-health"]');
  const notesInput = form.querySelector('[data-role="plant-notes"]');
  const errorMessage = form.querySelector('[data-role="plant-form-error"]');
  const cancelButton = form.querySelector('[data-action="plant-cancel"]');
  const deleteButton = form.querySelector('[data-action="plant-delete"]');

  let currentVillage = null;

  const hideForm = () => {
    form.hidden = true;
    if (errorMessage) {
      errorMessage.hidden = true;
    }
    if (deleteButton) {
      deleteButton.hidden = true;
    }
    form.reset();
  };

  const showCreateForm = () => {
    if (!currentVillage) {
      return;
    }
    form.hidden = false;
    form.reset();
    if (errorMessage) {
      errorMessage.hidden = true;
    }
    if (title) {
      title.textContent = 'Add Plant';
    }
    if (deleteButton) {
      deleteButton.hidden = true;
    }
    if (healthInput) {
      healthInput.value = '0.5';
    }
    if (stageInput) {
      stageInput.value = 'seedling';
    }
    if (idInput) {
      idInput.value = '';
    }
    if (updatedAtInput) {
      updatedAtInput.value = '';
    }
    if (nameInput instanceof HTMLElement) {
      nameInput.focus();
    }
  };

  const showEditForm = (item) => {
    if (!item || !idInput || !updatedAtInput) {
      return;
    }
    form.hidden = false;
    if (errorMessage) {
      errorMessage.hidden = true;
    }
    if (title) {
      title.textContent = 'Edit Plant';
    }
    if (deleteButton) {
      deleteButton.hidden = false;
    }
    idInput.value = item.dataset.plantId ?? '';
    updatedAtInput.value = item.dataset.updatedAt ?? '';
    if (nameInput) {
      nameInput.value = item.dataset.displayName ?? '';
    }
    if (speciesInput) {
      speciesInput.value = item.dataset.species ?? '';
    }
    if (stageInput) {
      stageInput.value = item.dataset.stage ?? 'seedling';
    }
    if (lastWateredInput) {
      lastWateredInput.value = toDateTimeLocal(item.dataset.lastWateredAt);
    }
    if (healthInput) {
      healthInput.value = item.dataset.healthScore ?? '0.5';
    }
    if (notesInput) {
      notesInput.value = item.dataset.notes ?? '';
    }
  };

  toggleButton.addEventListener('click', () => {
    if (form.hidden) {
      showCreateForm();
    } else {
      hideForm();
    }
  });

  if (cancelButton) {
    cancelButton.addEventListener('click', hideForm);
  }

  if (deleteButton) {
    deleteButton.addEventListener('click', async () => {
      if (!idInput || !updatedAtInput || !idInput.value) {
        return;
      }
      try {
        await plantListViewModel.deletePlant(idInput.value, updatedAtInput.value);
        showToast({ message: 'Deleted plant', tone: 'success' });
        hideForm();
      } catch (error) {
        showMutationFailure(error, 'Failed to delete plant.');
      }
    });
  }

  plantListViewModel.subscribe((state) => {
    currentVillage = state.village;
    if (!state.village) {
      hideForm();
    }
  });

  root.addEventListener('click', (event) => {
    const button = event.target instanceof HTMLElement ? event.target.closest('[data-action="plant-edit"]') : null;
    if (!button) {
      return;
    }
    const item = button.closest('.village-plants-item');
    if (!item) {
      return;
    }
    showEditForm(item);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
      return;
    }
    if (errorMessage) {
      errorMessage.hidden = true;
    }
    setFormDisabled(form, true);

    const payload = {
      displayName: nameInput ? nameInput.value : '',
      species: speciesInput ? speciesInput.value : '',
      stage: stageInput ? stageInput.value : 'seedling',
      lastWateredAt: lastWateredInput ? fromDateTimeLocal(lastWateredInput.value) : null,
      healthScore: healthInput ? healthInput.value : '0.5',
      notes: notesInput ? notesInput.value : null,
    };

    const plantId = idInput ? idInput.value : '';

    try {
      if (plantId) {
        await plantListViewModel.updatePlant(plantId, {
          ...payload,
          updatedAt: updatedAtInput ? updatedAtInput.value : '',
        });
        showToast({ message: 'Updated plant', tone: 'success' });
      } else {
        await plantListViewModel.createPlant(payload);
        showToast({ message: 'Added plant', tone: 'success' });
      }
      hideForm();
    } catch (error) {
      const message = mutationErrorMessage(error, plantId ? 'Failed to update plant.' : 'Failed to create plant.');
      if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.hidden = false;
      }
      showMutationFailure(error, plantId ? 'Failed to update plant.' : 'Failed to create plant.');
    } finally {
      setFormDisabled(form, false);
    }
  });
}

function mutationErrorMessage(error, fallback) {
  if (error instanceof HttpError) {
    if (error.status === 409) {
      return 'The data was updated elsewhere. Refresh and try again.';
    }
    if (error.status >= 500) {
      return 'Plantit is experiencing issues. Please try again shortly.';
    }
    return `Request failed with status ${error.status}.`;
  }
  if (error instanceof NetworkError) {
    return 'Unable to reach Plantit. Check your connection and retry.';
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function showMutationFailure(error, fallback) {
  const message = mutationErrorMessage(error, fallback);
  showToast({ message, tone: 'error', correlationId: error?.correlationId });
}

function setFormDisabled(form, disabled) {
  const elements = Array.from(form.elements || []);
  for (const element of elements) {
    if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
      element.disabled = disabled;
    }
  }
}

function toDateTimeLocal(value) {
  if (!value) {
    return '';
  }
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const pad = (input) => String(input).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } catch (error) {
    console.warn('Unable to convert timestamp to datetime-local', value, error);
    return '';
  }
}

function fromDateTimeLocal(value) {
  if (!value) {
    return null;
  }
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  } catch (error) {
    console.warn('Unable to parse datetime-local value', value, error);
    return null;
  }
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
      <div class="today-panel-error-actions">
        <button type="button" data-action="today-retry">Retry</button>
        <button type="button" data-action="today-copy-error">Copy details</button>
      </div>
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

  const errorActions = document.createElement("div");
  errorActions.className = "dashboard-error-actions";

  const retryButton = document.createElement("button");
  retryButton.className = "dashboard-retry-button";
  retryButton.type = "button";
  retryButton.dataset.action = "dashboard-retry";
  retryButton.textContent = "Retry";

  const copyButton = document.createElement("button");
  copyButton.className = "dashboard-copy-button";
  copyButton.type = "button";
  copyButton.dataset.action = "dashboard-copy-error";
  copyButton.textContent = "Copy details";

  errorActions.append(retryButton, copyButton);
  errorPanel.append(errorMessage, errorActions);

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
    this.retryButton = section.querySelector('[data-action="dashboard-retry"]');
    this.copyButton = section.querySelector('[data-action="dashboard-copy-error"]');
    this._currentErrorDetail = '';

    if (this.retryButton) {
      this.retryButton.addEventListener("click", () => {
        this.viewModel.retry();
      });
    }

    if (this.copyButton) {
      this.copyButton.addEventListener("click", async () => {
        const success = await copyDiagnosticsToClipboard(this._currentErrorDetail);
        if (success) {
          showToast({ message: "Error details copied to clipboard.", tone: "success" });
        } else {
          showToast({ message: "Unable to copy error details. Copy manually if needed.", tone: "warning" });
        }
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
    this._updateErrorContext(null, null);
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
    this._updateErrorContext(null, null);

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
    this._updateErrorContext(state.error?.detail ?? null, state.error?.category ?? null);
  }

  _updateErrorContext(detail, category) {
    this._currentErrorDetail = typeof detail === 'string' ? detail : '';
    if (this.copyButton) {
      this.copyButton.disabled = !this._currentErrorDetail;
    }
    if (this.errorPanel) {
      if (category) {
        this.errorPanel.dataset.category = category;
      } else {
        delete this.errorPanel.dataset.category;
      }
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
