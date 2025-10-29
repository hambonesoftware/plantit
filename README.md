# Plantit (Self‑Hosted)
Offline-first, single-binary style app: **HTML/CSS/ESM-JS frontend** + **FastAPI backend**.

- No npm, no CDNs, no external fonts or scripts.
- All UI matches the provided mock (soft off‑white, rounded cards, right Today panel).

## Quickstart

```bash
python -m venv .venv && . .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
python run.py
```

The app serves [http://127.0.0.1:7600](http://127.0.0.1:7600) and hosts the static frontend from `/app/frontend`.

Runtime configuration can be provided via environment variables or an `.env` file in the project root (`APP_HOST`, `APP_PORT`, `DB_PATH`).

- Set `FRONTEND_MINIMAL=1` to serve a JavaScript-free diagnostic shell when you suspect the main bundle is wedged. The flag is
  evaluated on every request, so you can flip it off without restarting once you are ready to restore the full SPA.

## Air-gapped install

1. On a connected machine, run `python tools/fetch_wheels.py` once to populate `vendor/wheels/`.
2. Copy the repository (including `vendor/`) to the offline host.
3. On the offline host, create/activate a virtual environment and run `python tools/offline_install.py`.
4. Launch the app with `python run.py`.
5. With the server running, execute `python tools/smoke.py` from another terminal to verify `/health` and static checksums.

The bundled CSP (`default-src 'self'`) and vendored assets guarantee zero external requests.

## Import / Export workflow

- Use the **Export** button in the footer to download a JSON snapshot (`/api/export`).
- Use the **Import** button to select a JSON bundle. The client performs a dry-run via `/api/import` and displays a summary before applying changes.
- Imported data merges by id; new ids are created if they do not exist.

## Smoke test

With the server running, execute:

```bash
python tools/smoke.py
```

The script fetches `/health`, confirms the static manifest, and validates hashes on disk.
