import {api} from '../apiClient.js';
import {refreshDashboard, refreshToday} from '../vm/dashboard.vm.js';
import {refreshVillage} from '../vm/village.vm.js';
import {refreshPlant} from '../vm/plant.vm.js';
import {Store} from '../store.js';

function setStatus(target, message, variant = 'info') {
  if (!target) {
    return;
  }
  target.dataset.variant = variant;
  target.textContent = message;
  if (typeof target.focus === 'function') {
    target.focus();
  }
}

export async function downloadExportBundle(statusEl) {
  try {
    setStatus(statusEl, 'Preparing export…', 'info');
    const bundle = await api.get('/api/export');
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    anchor.href = url;
    anchor.download = `plantit-export-${timestamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setStatus(statusEl, 'Export ready – check your downloads.', 'success');
  } catch (error) {
    console.error(error);
    setStatus(statusEl, `Export failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }
}

function summariseReport(report) {
  const created = report.created || {};
  const updated = report.updated || {};
  return `Villages +${created.villages ?? 0}/${updated.villages ?? 0}, ` +
    `Plants +${created.plants ?? 0}/${updated.plants ?? 0}, ` +
    `Tasks +${created.tasks ?? 0}/${updated.tasks ?? 0}, ` +
    `Logs +${created.logs ?? 0}/${updated.logs ?? 0}`;
}

async function refreshActiveViews() {
  await Promise.all([
    refreshDashboard(true),
    refreshToday(true),
  ]);
  const { selectedVillageId, selectedPlantId, view } = Store.state;
  if (view === 'village' && selectedVillageId) {
    await refreshVillage(selectedVillageId, true);
  }
  if (selectedPlantId) {
    await refreshPlant(selectedPlantId, true);
  }
}

export async function importBundleFromFile(file, statusEl) {
  if (!file) {
    return;
  }
  try {
    setStatus(statusEl, `Reading ${file.name}…`, 'info');
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object') {
      throw new Error('Import file must contain an object payload.');
    }

    const dryRunPayload = { ...data, dry_run: true };
    const preview = await api.post('/api/import', dryRunPayload);

    if (Array.isArray(preview.errors) && preview.errors.length > 0) {
      setStatus(statusEl, `Import blocked: ${preview.errors.join('; ')}`, 'error');
      return;
    }

    const summary = summariseReport(preview);
    const confirmMessage = `Dry-run complete (${summary}). Apply changes?`;
    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) {
      setStatus(statusEl, 'Import cancelled after dry-run preview.', 'info');
      return;
    }

    const applyPayload = { ...data, dry_run: false };
    const result = await api.post('/api/import', applyPayload);
    if (Array.isArray(result.errors) && result.errors.length > 0) {
      setStatus(statusEl, `Import failed: ${result.errors.join('; ')}`, 'error');
      return;
    }

    await refreshActiveViews();
    setStatus(statusEl, `Import applied (${summariseReport(result)}).`, 'success');
  } catch (error) {
    console.error(error);
    setStatus(statusEl, `Import failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }
}
