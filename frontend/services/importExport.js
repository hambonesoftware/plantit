import { request } from './api.js';
import { parsePlantMarkdown } from '../parsers/plantMarkdown.js';
import { Store, computeDaysSinceWatered, ensurePlantTrackingDefaults } from '../store.js';

const SUPPORTED_SCHEMA_VERSION = 1;
const PROGRESS_STAGES = ['validating', 'parsing', 'complete'];

/**
 * @typedef {Object} ImportProgressEvent
 * @property {'validating'|'parsing'|'complete'} stage
 * @property {string} message
 */

/**
 * Emit a progress event to the provided callback.
 *
 * @param {(event: ImportProgressEvent) => void | undefined} onProgress
 * @param {'validating'|'parsing'|'complete'} stage
 * @param {string} message
 */
function emitProgress(onProgress, stage, message) {
  if (typeof onProgress === 'function') {
    try {
      onProgress({ stage, message });
    } catch (error) {
      console.warn('Import progress callback threw', error);
    }
  }
}

/**
 * Derive a minimal summary describing the contents of the bundle.
 *
 * @param {Record<string, any>} bundle
 */
function buildBundleSummary(bundle) {
  const plants = Array.isArray(bundle?.plants) ? bundle.plants : [];
  const villages = Array.isArray(bundle?.villages) ? bundle.villages : [];
  return {
    plants: plants.length,
    villages: villages.length,
    metadataKeys: bundle && typeof bundle.metadata === 'object'
      ? Object.keys(bundle.metadata)
      : [],
  };
}

/**
 * @typedef {Object} ImportResult
 * @property {number} schemaVersion
 * @property {Record<string, any>} bundle
 * @property {{ plants: number, villages: number, metadataKeys: string[] }} summary
 */

/**
 * Import a Plantit bundle, validating the schema version and notifying progress.
 *
 * @param {File} file
 * @param {(event: ImportProgressEvent) => void} [onProgress]
 * @returns {Promise<ImportResult>}
 */
export async function importBundleFromFile(file, onProgress) {
  if (!file || typeof file.text !== 'function') {
    throw new TypeError('A File with text() support is required');
  }

  emitProgress(onProgress, 'validating', `Validating ${file.name || 'selected file'}…`);

  if (file.size === 0) {
    throw new Error('Selected bundle is empty');
  }

  const text = await file.text();

  emitProgress(onProgress, 'parsing', 'Parsing bundle JSON…');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const parseError = new Error('Bundle is not valid JSON');
    parseError.cause = error;
    throw parseError;
  }

  const schemaVersion = parsed?.schemaVersion;
  if (typeof schemaVersion !== 'number') {
    throw new Error('Bundle is missing a numeric schemaVersion');
  }

  if (schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schema version ${schemaVersion}; expected ${SUPPORTED_SCHEMA_VERSION}`,
    );
  }

  const summary = buildBundleSummary(parsed);

  await request('/import', {
    method: 'POST',
    body: {
      schemaVersion,
      summary,
    },
  });

  emitProgress(onProgress, 'complete', 'Bundle validated. Ready for server import.');

  return {
    schemaVersion,
    bundle: parsed,
    summary,
  };
}

/**
 * Format a date into YYYYMMDD for filenames.
 *
 * @param {Date} date
 * @returns {string}
 */
function formatDateForFilename(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Update the provided status element with text if available.
 *
 * @param {HTMLElement | null | undefined} statusEl
 * @param {string} text
 */
function updateStatus(statusEl, text) {
  if (!statusEl) {
    return;
  }
  statusEl.textContent = text;
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `plant-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeSourceTitle(name) {
  if (!name || typeof name !== 'string') {
    return null;
  }
  return name.replace(/\.[^./]+$/, '');
}

/**
 * Request an export bundle from the backend and trigger a download.
 *
 * @param {HTMLElement} [statusEl]
 * @returns {Promise<{ fileName: string, bytes: number }>}
 */
export async function downloadExportBundle(statusEl) {
  updateStatus(statusEl, 'Requesting export bundle…');

  const response = await request('/export');

  const generatedAt = response?.generatedAt
    ? new Date(response.generatedAt)
    : new Date();

  const bundle = {
    schemaVersion: response?.schemaVersion ?? SUPPORTED_SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    metadata: response?.metadata ?? {},
    payload: response?.payload ?? {},
  };

  updateStatus(statusEl, 'Preparing download…');

  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: 'application/json',
  });

  const fileName = `plantit-export-${formatDateForFilename(generatedAt)}.json`;
  const blobUrl = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }

  updateStatus(statusEl, `Download started: ${fileName}`);

  return { fileName, bytes: blob.size };
}

export async function importPlantMarkdownFiles(files, statusEl) {
  Store.init();
  const list = Array.from(files || []);
  const mdFiles = list.filter((file) => file && typeof file.name === 'string' && file.name.toLowerCase().endsWith('.md'));
  if (mdFiles.length === 0) {
    updateStatus(statusEl, 'No Markdown files selected.');
    return { created: 0, updated: 0 };
  }

  updateStatus(statusEl, `Importing ${mdFiles.length} Markdown file${mdFiles.length === 1 ? '' : 's'}…`);

  const plants = Array.isArray(Store.state.plants) ? [...Store.state.plants] : [];
  let created = 0;
  let updated = 0;

  for (const file of mdFiles) {
    const text = await file.text();
    const parsed = parsePlantMarkdown(text, file.name);
    const sourceTitle = normalizeSourceTitle(parsed._sourceTitle);
    const displayName = sourceTitle || normalizeSourceTitle(file.name) || 'Plant';

    let index = plants.findIndex((plant) => {
      if (!plant) {
        return false;
      }
      if (sourceTitle) {
        if (plant.sourceTitle && plant.sourceTitle === sourceTitle) {
          return true;
        }
        if (plant.displayName && plant.displayName === sourceTitle) {
          return true;
        }
      }
      return false;
    });

    const nowIso = new Date().toISOString();
    const payload = ensurePlantTrackingDefaults({
      id: generateId(),
      displayName,
      createdAt: nowIso,
      updatedAt: nowIso,
      ...parsed,
    });
    delete payload._sourceTitle;
    payload.activityLog = Array.isArray(parsed.activityLog) ? parsed.activityLog : [];
    payload.daysSinceWatered = computeDaysSinceWatered(payload.lastWatered);
    payload.sourceTitle = sourceTitle;

    if (index >= 0) {
      const existing = { ...plants[index] };
      const existingLog = Array.isArray(existing.activityLog) ? existing.activityLog : [];
      const mergedLog = [...existingLog, ...payload.activityLog];
      plants[index] = {
        ...existing,
        ...payload,
        activityLog: mergedLog,
        updatedAt: nowIso,
      };
      updated += 1;
    } else {
      plants.push(payload);
      created += 1;
    }
  }

  Store.state.plants = plants.map((plant) => {
    const normalized = ensurePlantTrackingDefaults({ ...plant });
    normalized.daysSinceWatered = computeDaysSinceWatered(normalized.lastWatered);
    return normalized;
  });
  Store.save();

  updateStatus(statusEl, `Import complete: ${created} created, ${updated} updated.`);
  return { created, updated };
}

export { SUPPORTED_SCHEMA_VERSION, PROGRESS_STAGES };
