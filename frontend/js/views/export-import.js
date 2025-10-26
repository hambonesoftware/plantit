import { emit } from "../state.js";

const SCOPE_LABELS = {
  all: "All data",
  village: "Single village",
  plant: "Single plant",
};

function createLogList() {
  const list = document.createElement("ul");
  list.className = "export-import__log";
  list.setAttribute("aria-live", "polite");
  list.setAttribute("aria-label", "Export and import activity");
  return list;
}

function addLog(list, message, type = "info") {
  const entry = document.createElement("li");
  entry.className = `export-import__log-entry export-import__log-entry--${type}`;
  entry.textContent = message;
  list.prepend(entry);
  while (list.childElementCount > 6) {
    list.removeChild(list.lastElementChild);
  }
}

function createSidebar() {
  const section = document.createElement("section");
  section.className = "export-import__sidebar";
  section.innerHTML = `
    <h2>Backup tips</h2>
    <p>Exports include villages, plants, tasks, logs, and photo metadata. Media files stay on disk—keep the generated manifest to zip them later.</p>
    <h3>Scopes</h3>
    <dl>
      <dt>All data</dt>
      <dd>Everything in the database plus a media manifest.</dd>
      <dt>Single village</dt>
      <dd>One village and every plant associated with it.</dd>
      <dt>Single plant</dt>
      <dd>Focused backup for quick sharing.</dd>
    </dl>
  `;
  return section;
}

function toggleIdentifierField(scopeSelect, input) {
  if (!scopeSelect || !input) {
    return;
  }
  const requiresId = scopeSelect.value !== "all";
  input.disabled = !requiresId;
  input.required = requiresId;
  if (!requiresId) {
    input.value = "";
  }
}

export function createExportImportView({ apiClient, shell, resetSidebar }) {
  if (!apiClient) {
    throw new Error("Export/Import view requires an API client");
  }

  let cleanup = [];

  return {
    mount(target) {
      cleanup = [];
      const section = document.createElement("section");
      section.className = "export-import";
      section.innerHTML = `
        <header class="export-import__header">
          <div>
            <h1>Export &amp; Import</h1>
            <p>Download backups or restore a bundle exported from another device.</p>
          </div>
        </header>
        <div class="export-import__grid">
          <form class="export-import__form" data-export>
            <fieldset>
              <legend>Export data</legend>
              <label for="export-scope">Scope</label>
              <select id="export-scope" name="scope">
                <option value="all">All data</option>
                <option value="village">Single village</option>
                <option value="plant">Single plant</option>
              </select>
              <label for="export-target" id="export-target-label">Identifier</label>
              <input
                id="export-target"
                name="target_id"
                type="number"
                inputmode="numeric"
                min="1"
                autocomplete="off"
                placeholder="Enter ID"
                aria-describedby="export-help"
              />
              <p id="export-help" class="export-import__help">
                Provide the numeric ID when exporting a single village or plant.
              </p>
            </fieldset>
            <button type="submit" class="export-import__submit">Download export</button>
          </form>
          <form class="export-import__form" data-import>
            <fieldset>
              <legend>Import bundle</legend>
              <label for="import-file">Export file (.json)</label>
              <input id="import-file" name="bundle" type="file" accept="application/json" />
              <p class="export-import__help">Bundles produced by Plantit exports are supported.</p>
            </fieldset>
            <button type="submit" class="export-import__submit">Restore bundle</button>
          </form>
        </div>
      `;

      const logList = createLogList();
      section.appendChild(logList);

      target.appendChild(section);

      const scopeSelect = section.querySelector("#export-scope");
      const identifierInput = section.querySelector("#export-target");
      toggleIdentifierField(scopeSelect, identifierInput);

      const exportForm = section.querySelector('form[data-export]');
      const importForm = section.querySelector('form[data-import]');
      const fileInput = section.querySelector("#import-file");

      const handleScopeChange = () => toggleIdentifierField(scopeSelect, identifierInput);
      scopeSelect.addEventListener("change", handleScopeChange);
      cleanup.push(() => scopeSelect.removeEventListener("change", handleScopeChange));

      const handleExportSubmit = async (event) => {
        event.preventDefault();
        const scope = scopeSelect.value;
        const rawId = identifierInput.value.trim();
        if (scope !== "all" && rawId.length === 0) {
          addLog(logList, "Please provide an ID for the selected scope.", "error");
          identifierInput.focus();
          return;
        }
        const params = new URLSearchParams({ scope });
        if (scope !== "all") {
          params.set("target_id", rawId);
        }
        try {
          const { data } = await apiClient.get(`/export?${params.toString()}`, { queue: false });
          const filename = buildFilename(scope);
          downloadBundle(data, filename);
          addLog(logList, `Exported ${SCOPE_LABELS[scope] ?? scope}.`, "success");
          emit("toast", { type: "success", message: `Export ready: ${filename}` });
        } catch (error) {
          console.error("Export failed", error);
          addLog(logList, "Export failed. Please try again.", "error");
        }
      };
      exportForm.addEventListener("submit", handleExportSubmit);
      cleanup.push(() => exportForm.removeEventListener("submit", handleExportSubmit));

      const handleImportSubmit = async (event) => {
        event.preventDefault();
        if (!fileInput.files || fileInput.files.length === 0) {
          addLog(logList, "Select an export bundle before importing.", "error");
          fileInput.focus();
          return;
        }
        const file = fileInput.files[0];
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          const { data } = await apiClient.post("/import", parsed, { queue: false });
          const message = data?.status === "partial"
            ? "Import completed with notes—check conflicts for missing media."
            : "Import completed successfully.";
          addLog(logList, message, data?.status === "partial" ? "warning" : "success");
          emit("toast", { type: data?.status === "partial" ? "warning" : "success", message });
          if (Array.isArray(data?.conflicts) && data.conflicts.length > 0) {
            data.conflicts.slice(0, 3).forEach((conflict) => addLog(logList, conflict, "warning"));
          }
        } catch (error) {
          console.error("Import failed", error);
          addLog(logList, "Import failed. Ensure the file is a valid Plantit export.", "error");
        }
      };
      importForm.addEventListener("submit", handleImportSubmit);
      cleanup.push(() => importForm.removeEventListener("submit", handleImportSubmit));

      shell.setSidebar(createSidebar());
    },
    unmount() {
      cleanup.forEach((fn) => {
        try {
          fn();
        } catch (error) {
          console.warn("Cleanup error", error);
        }
      });
      cleanup = [];
      if (typeof resetSidebar === "function") {
        resetSidebar();
      } else {
        shell.setSidebar(null);
      }
    },
  };
}

function buildFilename(scope) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `plantit-${scope}-export-${timestamp}.json`;
}

function downloadBundle(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
