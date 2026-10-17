import { migrateLegacyStore, storageStatus } from './localData.js';

export async function initializeLocalWorkspace(root) {
  try {
    await migrateLegacyStore();
    await storageStatus();
  } catch (error) {
    root.replaceChildren();
    const title = document.createElement('h1'); title.textContent = 'PlantIt needs local storage';
    const message = document.createElement('p'); message.textContent = error.message || 'Unable to open the local database. Allow website storage and reload. Your existing saved records have not been deleted.';
    root.append(title, message);
    return false;
  }
  return true;
}

export function mountLocalControls(root) {
  const panel = document.createElement('section');
  panel.className = 'local-status-panel';
  const title = document.createElement('h2'); title.textContent = 'Your plants, on this device';
  const privacy = document.createElement('p');
  privacy.textContent = 'Plants, photos, and notes stay in this browser. No account or cloud sync. Anyone with access to this browser profile can open them. Clearing website data can erase your collection.';
  const storage = document.createElement('p'); storage.id = 'local-storage-status'; storage.setAttribute('role', 'status');
  const backup = document.createElement('p'); backup.id = 'backup-reminder';
  const offline = document.createElement('p'); offline.id = 'offline-status'; offline.setAttribute('role', 'status');
  const protect = document.createElement('button'); protect.type = 'button'; protect.textContent = 'Request persistent storage';
  protect.addEventListener('click', async () => {
    try {
      const granted = await navigator.storage?.persist?.();
      await refresh();
      if (!granted) storage.textContent += ' Your browser did not grant persistence. Keep downloadable backups.';
    } catch { storage.textContent = 'Persistent storage is unavailable. Keep downloadable backups.'; }
  });
  const install = document.createElement('button'); install.type = 'button'; install.textContent = 'Install PlantIt'; install.hidden = true;
  let installPrompt;
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; install.hidden = false; });
  install.addEventListener('click', async () => { if (installPrompt) { await installPrompt.prompt(); installPrompt = null; install.hidden = true; } });
  const instructions = document.createElement('p');
  instructions.textContent = 'Install: on iPhone or iPad, open in Safari, tap Share, then Add to Home Screen. On desktop or Android, use your browser’s Install option. Open once online and wait for “Ready offline” before disconnecting.';
  const update = document.createElement('button'); update.type = 'button'; update.textContent = 'Apply app update'; update.hidden = true;
  let waitingWorker, applyingUpdate = false;
  update.addEventListener('click', () => {
    if (waitingWorker && window.confirm('Reload PlantIt to apply the update? Save any open form first.')) { applyingUpdate = true; waitingWorker.postMessage({ type: 'ACTIVATE_UPDATE' }); }
  });
  panel.append(title, privacy, storage, backup, offline, protect, install, update, instructions);
  root.prepend(panel);
  async function refresh() {
    try {
      const state = await storageStatus();
      storage.textContent = state.persistent ? 'Persistent storage granted. Backups are still recommended.' : 'Browser-managed storage. Keep backups in case website data is cleared or removed.';
      const stale = !state.lastBackupAt || Date.now() - Date.parse(state.lastBackupAt) > 7 * 86400000;
      backup.textContent = state.lastBackupAt ? `Last backup download: ${new Date(state.lastBackupAt).toLocaleString()}.${stale ? ' Download a fresh backup below.' : ''}` : 'No backup downloaded yet. Download your first backup below after adding plants.';
      backup.classList.toggle('backup-needed', Boolean(stale && (state.plants || state.villages)));
    } catch { storage.textContent = 'Local storage could not be read. Try reloading; do not clear website data.'; }
  }
  let offlineReady = false;
  function connectionStatus() { offline.textContent = offlineReady ? (navigator.onLine ? 'Ready offline. Your changes save on this device.' : 'Offline. Your changes save on this device.') : 'Preparing offline files. Stay online until this says “Ready offline”.'; }
  window.addEventListener('online', connectionStatus);
  window.addEventListener('offline', connectionStatus);
  window.addEventListener('plantit:data-changed', refresh);
  refresh(); connectionStatus();
  if ('serviceWorker' in navigator && !new URLSearchParams(location.search).has('no-sw')) {
    navigator.serviceWorker.addEventListener('controllerchange', () => { offlineReady = true; connectionStatus(); if (applyingUpdate) location.reload(); });
    navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), { scope: new URL('../', import.meta.url).pathname }).then(async registration => {
      await navigator.serviceWorker.ready;
      offlineReady = Boolean(navigator.serviceWorker.controller);
      connectionStatus();
      const watch = worker => worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) { waitingWorker = registration.waiting || worker; update.hidden = false; } });
      if (registration.waiting) { waitingWorker = registration.waiting; update.hidden = false; }
      registration.addEventListener('updatefound', () => watch(registration.installing));
    }).catch(() => { offline.textContent = 'Offline setup failed. Reopen online to retry. Local data is still saved on this device.'; });
  } else { offline.textContent = 'Offline installation needs HTTPS and service worker support. Local data still saves on this device.'; }
}
