# DevOps_Packager
**Goal:** Guarantee offline install and self-hosting.

## Steps
1. `python tools/fetch_wheels.py` to download wheels into `/vendor/wheels`.
2. Copy repo to air‑gapped host.
3. `python tools/offline_install.py` (installs from local wheels only).
4. `python run.py` (serves API and frontend).

## Extras
- Windows service: document NSSM setup.
- Linux: provide sample systemd unit in docs.
