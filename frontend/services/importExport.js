import { request } from './api.js';

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

export { SUPPORTED_SCHEMA_VERSION, PROGRESS_STAGES };
