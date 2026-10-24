import { request } from './api.js';
import { parsePlantMarkdown } from '../parsers/plantMarkdown.js';
import { collectPlantFiles } from './plantImportFiles.js';
import { BACKUP_VERSION, MAX_BACKUP_BYTES, validateBackup, markBackupDownloaded } from './localData.js';

export const SUPPORTED_SCHEMA_VERSION = BACKUP_VERSION;
export const PROGRESS_STAGES = ['validating', 'parsing', 'complete'];
const status = (element, message) => { if (element) element.textContent = message; };
const progress = (callback, stage, message) => { if (callback) callback({ stage, message }); };

/** Restore is atomic. Invalid files and cancelled confirmations leave existing data untouched. */
export async function importBundleFromFile(file, onProgress) {
  if (!file || typeof file.text !== 'function') throw new TypeError('Choose a PlantIt JSON backup.');
  if (!file.size || file.size > MAX_BACKUP_BYTES) throw new Error('Choose a nonempty backup smaller than 100 MB.');
  progress(onProgress, 'validating', 'Checking backup…');
  let bundle;
  try { bundle = JSON.parse(await file.text()); } catch { throw new Error('The selected file is not valid JSON.'); }
  progress(onProgress, 'parsing', 'Validating plants, villages, photos, and watering history…');
  const state = validateBackup(bundle);
  const current = await request('/export');
  const hasData = current.payload.villages.length || current.payload.plants.length;
  if (!window.confirm(`Restore ${state.plants.length} plants and ${state.villages.length} villages?${hasData ? ' This replaces your current collection. Download a backup first if you want to keep it.' : ''}`)) return { cancelled: true };
  await request('/import', { method: 'POST', body: { ...bundle, expectedWorkspaceUpdatedAt: current.workspaceUpdatedAt } });
  const summary = { plants: state.plants.length, villages: state.villages.length };
  progress(onProgress, 'complete', `Restored ${summary.plants} plants and ${summary.villages} villages on this device.`);
  return { schemaVersion: bundle.schemaVersion, bundle, summary, cancelled: false };
}

export async function downloadExportBundle(statusElement) {
  status(statusElement, 'Preparing your complete local backup…');
  const bundle = await request('/export');
  const blob = new Blob([JSON.stringify(bundle)], { type: 'application/json' });
  if (blob.size > MAX_BACKUP_BYTES) throw new Error('This backup exceeds 100 MB. Reduce photo sizes before exporting.');
  const fileName = `plantit-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl; link.download = fileName; link.hidden = true;
  document.body.appendChild(link);
  link.click(); link.remove();
  // Keep the URL alive long enough for browsers to begin reading the download.
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  await markBackupDownloaded();
  status(statusElement, `Backup download started: ${fileName}. Keep the file somewhere safe; it includes your photos and notes.`);
  return { fileName, bytes: blob.size };
}

function stableSourceKey(fields, fileName) {
  const pageId = fields.notionPageId || fileName.match(/([0-9a-f]{32})(?=\.(?:md|markdown|txt)$)/i)?.[1];
  if (pageId) return `notion:${pageId.toLowerCase()}`;
  const basename = fileName.split('/').at(-1).replace(/\.(md|markdown|txt)$/i, '').toLowerCase();
  return `file:${basename}`;
}

function mergeCare(existing = [], incoming = []) {
  const combined = new Map();
  for (const entry of [...existing, ...incoming]) {
    const key = `${entry.date}\u0000${entry.type}\u0000${entry.note || ''}`;
    combined.set(key, entry);
  }
  return [...combined.values()].sort((left, right) => String(left.date).localeCompare(String(right.date)));
}

/** Preview and atomically import plant text/ZIP files into the chosen local village. */
export async function importPlantMarkdownFiles(files, statusElement, { villageId = null } = {}) {
  status(statusElement, 'Reading plant files on this device…');
  const { plants, skippedImages } = await collectPlantFiles(files);
  // Validate every record before changing the collection.
  const parsed = new Map();
  for (const { name, contents } of plants) {
    const fields = parsePlantMarkdown(contents, name);
    const heading = contents.match(/^#{1,6}\s+(.+)$/m)?.[1]?.trim();
    const displayName = heading || fields.name || name.split('/').at(-1).replace(/\.[^.]+$/, '');
    if (!displayName || displayName.length > 200) throw new Error(`Invalid plant name in ${name}.`);
    const sourceTitle = stableSourceKey(fields, name);
    if (parsed.has(sourceTitle)) throw new Error(`The selected files contain duplicate plant records: ${displayName}.`);
    const wateringHistory = [...new Set([
      ...(fields.lastWatered ? [fields.lastWatered] : []),
      ...fields.activityLog.filter(entry => entry.type === 'water').map(entry => entry.date),
    ])].sort();
    parsed.set(sourceTitle, {
      ...fields, displayName, species: displayName, stage: 'mature', healthScore: 0.5,
      sourceTitle, sourceFileName: name, wateringHistory,
    });
  }
  const bundle = await request('/export');
  let village = villageId ? bundle.payload.villages.find(value => value.id === villageId) :
    bundle.payload.villages.find(value => value.name === 'Imported plants');
  if (villageId && !village) throw new Error('The destination village no longer exists.');
  if (!village) {
    village = { id: crypto.randomUUID(), name: 'Imported plants', climate: 'Indoor', healthScore: 0.5, updatedAt: new Date().toISOString() };
    bundle.payload.villages.push(village);
  }
  let created = 0, updated = 0;
  let careEvents = 0;
  for (const fields of parsed.values()) {
    careEvents += fields.activityLog.length;
    const index = bundle.payload.plants.findIndex(plant => plant.villageId === village.id && (
      plant.sourceTitle === fields.sourceTitle || plant.sourceTitle === fields.sourceFileName ||
      (plant.displayName === fields.displayName && !plant.sourceTitle?.startsWith('notion:'))
    ));
    const existing = index >= 0 ? bundle.payload.plants[index] : null;
    const history = [...new Set([...(existing?.wateringHistory || []), ...fields.wateringHistory])].sort();
    const { notionPageId: _notionPageId, name: _name, sourceFileName: _sourceFileName, daysSinceWatered: _daysSinceWatered, _sourceTitle, ...supported } = fields;
    const entry = {
      ...existing, ...supported, id: existing?.id || crypto.randomUUID(), villageId: village.id,
      updatedAt: new Date().toISOString(), wateringHistory: history,
      lastWatered: history.at(-1) || supported.lastWatered,
      activityLog: mergeCare(existing?.activityLog, supported.activityLog),
      notes: existing?.notes || supported.notes,
    };
    if (existing) { bundle.payload.plants[index] = entry; updated++; } else { bundle.payload.plants.push(entry); created++; }
  }
  validateBackup(bundle);
  const description = `${created} new plant${created === 1 ? '' : 's'}, ${updated} update${updated === 1 ? '' : 's'}, ${careEvents} care events`;
  const photoReminder = skippedImages ? ` ${skippedImages} photo file${skippedImages === 1 ? '' : 's'} will need manual attachment.` : '';
  if (!window.confirm(`Import ${description} into “${village.name}” on this device?${photoReminder}`)) {
    status(statusElement, 'Import cancelled. Your collection is unchanged.');
    return { cancelled: true, created: 0, updated: 0 };
  }
  // Commit the batch only if no other tab changed the source snapshot.
  await request('/import-markdown', { method: 'POST', body: bundle });
  status(statusElement, `Import complete: ${created} created, ${updated} updated, ${careEvents} care events.${photoReminder}`);
  return { cancelled: false, created, updated, careEvents, skippedImages };
}
