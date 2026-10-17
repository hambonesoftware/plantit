import { request } from './api.js';
import { parsePlantMarkdown } from '../parsers/plantMarkdown.js';
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

export async function importPlantMarkdownFiles(files, statusElement) {
  const markdown = Array.from(files || []).filter(file => /\.(md|markdown)$/i.test(file.name));
  if (!markdown.length) throw new Error('Choose Markdown plant files.');
  // Parse and validate every file before writing anything.
  const parsed = [];
  for (const file of markdown) {
    if (file.size > 2 * 1024 * 1024) throw new Error('Each Markdown file must be smaller than 2 MB.');
    const contents = await file.text();
    if (!contents.trim()) throw new Error(`${file.name} is empty.`);
    const fields = parsePlantMarkdown(contents, file.name);
    const heading = contents.match(/^#{1,6}\s+(.+)$/m)?.[1]?.trim();
    const displayName = heading || file.name.replace(/\.[^.]+$/, '');
    parsed.push({ ...fields, displayName, species: displayName, stage: 'mature', healthScore: 0.5, sourceTitle: file.name });
  }
  const bundle = await request('/export');
  let village = bundle.payload.villages.find(value => value.name === 'Imported plants');
  if (!village) {
    village = { id: crypto.randomUUID(), name: 'Imported plants', climate: 'Indoor', healthScore: 0.5, updatedAt: new Date().toISOString() };
    bundle.payload.villages.push(village);
  }
  let created = 0, updated = 0;
  for (const fields of parsed) {
    const index = bundle.payload.plants.findIndex(plant => plant.sourceTitle === fields.sourceTitle && plant.villageId === village.id);
    const existing = index >= 0 ? bundle.payload.plants[index] : null;
    const entry = { ...existing, ...fields, id: existing?.id || crypto.randomUUID(), villageId: village.id, updatedAt: new Date().toISOString(), wateringHistory: existing?.wateringHistory || [] };
    if (existing) { bundle.payload.plants[index] = entry; updated++; } else { bundle.payload.plants.push(entry); created++; }
  }
  validateBackup(bundle);
  // Commit the batch only if no other tab changed the source snapshot.
  await request('/import-markdown', { method: 'POST', body: bundle });
  status(statusElement, `Import complete: ${created} created, ${updated} updated.`);
  return { created, updated };
}
