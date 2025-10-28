# Plantit (Self‑Hosted)
Offline-first, single-binary style app: **HTML/CSS/ESM-JS frontend** + **FastAPI backend**.

- No npm, no CDNs, no external fonts or scripts.
- All UI matches the provided mock (soft off‑white, rounded cards, right Today panel).

## Run
```bash
python -m venv .venv && . .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
python run.py
```
The app serves http://127.0.0.1:7600 and hosts static frontend from `/app/frontend`.
