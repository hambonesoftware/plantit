import { downloadExportBundle, importBundleFromFile } from './services/importExport.js';

const searchParams = new URLSearchParams(window.location.search);
const disableServiceWorkers = searchParams.get("no-sw") === "1";
const explicitSafeBoot = searchParams.get("safe") === "1";
const resumeSession = searchParams.get("resume") === "1";
const safeBoot = explicitSafeBoot || disableServiceWorkers;

const LAST_ROUTE_KEY = "plantit:lastRoute";
const MAX_ROUTE_LENGTH = 512;

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

if (!resumeSession && window.location.hash !== "") {
  console.info("Boot: forcing startup route to home");
  window.location.hash = "";
} else if (resumeSession && lastRoute && window.location.hash === "") {
  console.info("Boot: resuming last known route");
  window.location.hash = lastRoute;
}

const persistRoute = () => {
  safeWriteLocalStorage(LAST_ROUTE_KEY, window.location.hash);
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
    mountShell(root, "Plantit — Safe Shell");
  } else {
    mountShell(root, "Plantit — Shell Ready");
  }
  console.info("Boot: shell mounted");
};

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", onReady, { once: true });
} else {
  onReady();
}

function mountShell(root, statusText) {
  root.innerHTML = "";
  const status = document.createElement("p");
  status.id = "shell-status";
  status.textContent = statusText;

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

  root.append(status, transferPanel);
  initializeImportExportControls(root);
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

export { safeBoot };
