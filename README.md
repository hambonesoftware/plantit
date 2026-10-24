# PlantIt

PlantIt is a personal plant tracker that runs as an installable, offline PWA. The current frontend saves villages, plants, photos, activity notes, and watering history in **IndexedDB on the user's device**. No account, backend, database server, or Google sign-in is needed.

## Run or build the local PWA

Python 3.10+ is needed only to build or preview the static files, not on the production host.

```bash
python scripts/build_static.py
python -m http.server 8080 --directory dist/plantit
```

Open `http://localhost:8080`. Use HTTPS on a public host. Wait for **Ready offline** before disconnecting. Install using your browser's Install command, or Safari → Share → Add to Home Screen on iPhone/iPad.

Upload **only the contents of `dist/plantit`** to a static HTTPS host. See [the hosting and recovery guide](docs/local-pwa.md) for the `plantit.guitartabsync.com` setup. Do not upload the repository, run the legacy backend, or expose the SQLite database.

## Where data lives

Each browser profile and origin has its own collection. The app does not synchronize between devices and does not encrypt records with an app password. A person who can access the browser profile can open the collection. Website hosting still receives ordinary requests for app files, but plant records are not uploaded.

Use **Download Backup** regularly. It includes local photos, full plant metadata, activity, watering history, and daily watering dismissals. Backups are unencrypted JSON files; save them privately. **Restore Backup replaces the current collection**, after validation and confirmation. Cancelling or importing an invalid file leaves the saved collection untouched.

**Import Plants (ZIP, Markdown, Text)** accepts an ordinary Notion export ZIP or one or more `.md`, `.markdown`, or `.txt` plant pages. ZIP extraction and parsing happen entirely in the browser. The file picker intentionally has no type restriction for compatibility with iOS Files; unsupported selections are rejected with an explanation. A preview confirms plant counts and care events before the atomic local save. Reimporting the same Notion pages updates their original records without duplicating plants or care entries. If the ZIP contains photos, they remain in the original ZIP for manual attachment; PlantIt currently supports one primary photo per plant. Download a PlantIt backup after verifying the import.

Use **Request persistent storage** to ask the browser to reduce automatic eviction; the browser may decline. The button disappears once the browser confirms permission is already granted. This cannot prevent the user from clearing website data. Keep the production hostname stable: changing domain, scheme, or port creates a different storage origin. To move devices or addresses, download a backup on the old one and restore it on the new one.

Remote photo URLs are deliberately rejected so opening a collection cannot contact an image tracker. Choose PNG, JPEG, WebP, or GIF files up to 10 MB per photo. Backup imports are limited to 100 MB and 10,000 villages/plants each. The app requests no camera, microphone, or location permission.

## Validation

Node.js 20+ is needed for development tests, not to run the app.

```bash
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

The data tests exercise atomic writes, concurrent edits, validation, backup fidelity, and deletion. Browser tests serve only static files and check UI creation, persistence, offline operations, complete backup restore into another profile, cancelled/corrupt restores, Markdown imports, and storage failure. An actual Safari/iOS installation check is still required before a broad launch.

## Existing data and legacy backend

Old browser-only Markdown records under `plantit:localStore` are copied once into an **Imported plants** village; the old data is retained. Existing backend SQLite records require an explicit export with `scripts/export_sqlite_backup.py`; they are never silently fetched or copied over the network. Restore that file using the PWA.

The `backend`, `run.py`, and `serve.py` files remain for legacy development and data recovery. They are **not part of the static deployment**, and their placeholder authentication is not suitable for public hosting. The historical Python E2E tests describe the old server-seeded UI; use the new PWA test suite for this release.
