# Local PWA hosting and recovery

## Recommended deployment for guitartabsync.com

1. Keep the existing Hostinger Website Builder site.
2. Build with `python scripts/build_static.py`.
3. Create a separate static HTTPS website for the contents of `dist/plantit`. This can be on a Hostinger plan that accepts static file uploads or on another static host. Website Builder itself is not the deployment target for these app files.
4. Add `plantit.guitartabsync.com` as a custom domain on that static host. Follow its supplied CNAME or A-record instructions in the authoritative DNS panel. Change only the `plantit` record; leave the main website and email records alone.
5. Enable HTTPS and verify the certificate covers the subdomain.
6. Add a PlantIt navigation link in Website Builder pointing to `https://plantit.guitartabsync.com/`.

Do not point the new hostname at an exposed FastAPI process. The built directory has no server credentials or plant database. No login provider or server account database is needed.

A subdirectory deployment is also supported by relative app/manifest/worker URLs, provided the host serves the entire built directory under a stable path ending in `/`. A dedicated subdomain provides separate browser storage from the main website. Never switch between preview and production addresses expecting their local collections to be shared.

## Hosting headers

The build includes `.htaccess` for Apache/LiteSpeed and `_headers` for hosts supporting that convention. Other hosts need the equivalent headers configured in their settings. Verify the deployed responses; a configuration file alone does not prove a host applies it.

- HTTPS redirects, plus HSTS once HTTPS is verified for the application hostname.
- Content-Security-Policy: scripts from self only, no objects, no form submissions, no framing, images from self/data/blob, connections to self only. Inline CSS is allowed because existing views set layout styles dynamically.
- X-Content-Type-Options: nosniff; Referrer-Policy: no-referrer; X-Frame-Options: DENY.
- Permissions-Policy disables camera, microphone, and geolocation.
- `sw.js`, `index.html`, and the manifest must be revalidated rather than cached indefinitely by the host/CDN. Serve JavaScript and the manifest with correct MIME types.

There are no third-party scripts, fonts, analytics, or remote photo fetches. App files use a versioned offline cache; user records use a separate IndexedDB database. The host and DNS accounts still need MFA and protected access because a malicious app update could access local records after a user opens the site.

## Updates

Build and upload all files together, preferably using a host with atomic deployments. The generated worker pre-caches the whole app before it can activate. Existing tabs keep the current version until the user chooses **Apply app update** or closes all old tabs. Save open forms first. Worker activation cleans only PlantIt's old app-shell caches and never clears IndexedDB.

Do not delete users' databases to resolve stale assets. The `?no-sw=1` troubleshooting option unregisters only workers for this app's scope; it does not erase the collection.

## Existing SQLite collections

From a copy of the old database, run:

```bash
python scripts/export_sqlite_backup.py --database /path/to/plantit.db --output /private/path/plantit-backup-migration.json
```

The exporter opens SQLite read-only and preserves complete metadata, photo data, activity JSON, and watering events. It refuses external photo links by default. If you deliberately want to leave those links out, add `--omit-remote-photos`; the tool reports how many were omitted. The database is never modified. Historical version 1 server exports did not include all details and cannot recover information that was omitted from the file.

Restore the resulting file in the local PWA, inspect several records and photos, then download a new backup. Keep the original SQLite copy until verification is complete. Old in-memory dashboard alerts and temporary legacy watering dismissals were not persisted in SQLite and cannot be recovered from it.

## Backups and recovery

- Download a backup after a large import and at least weekly when making changes. The UI records when a download was initiated, not whether the user saved the file successfully.
- Store backups outside the browser. A device failure can also destroy files kept only on that device.
- Restore validates the whole file before replacing records in a single transaction. Export your current collection first if it matters.
- Export size can grow quickly with embedded photos. Saves that would exceed the restorable backup limit are rejected; use smaller photos if you reach this limit.
- Request persistence when offered; browsers decide whether to grant it. Clearing browser/website data can still erase the collection.
- Browser storage and standalone installation can behave differently across platforms. Export before switching browsers or installation modes; restore if the new mode opens an empty collection.
- This release has no automatic synchronization, cloud backup, or app-level encryption. Share a browser profile only with people you trust with the collection.

## Launch checks

Use a staging hostname with test data first. Confirm HTTPS, deployed headers, installation icons, first offline setup, offline relaunch, plant edits/photos, a full export/restore, and preservation after an app update. Check on actual Safari/iPhone and on your Windows browser. Confirm the network panel has no `/api` requests and no third-party data requests. Transfer the final app to the stable production hostname before users start real collections.
