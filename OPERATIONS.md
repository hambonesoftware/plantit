# Plantit Operations Guide

## Runtime layout
- **App entry:** `python run.py`
- **Database:** SQLite file at `$DB_PATH` (defaults to `app.db` in the repository root).
- **Static assets:** `/app/frontend` (hashed manifest exposed via `/health`).

## Backups
1. Stop the application service.
2. Create a SQLite backup:
   ```bash
   sqlite3 app.db ".backup 'backups/plantit-$(date +%Y%m%d).db'"
   ```
3. Copy the backup file to offline media or your retention location.
4. To restore, replace `app.db` with the backup and restart the service.

## Upgrades
1. On a connected workstation, run `python tools/fetch_wheels.py` to refresh `vendor/wheels/`.
2. Commit the new wheels into your artifact store or copy the repo bundle to the target host.
3. On the host, activate the venv and execute `python tools/offline_install.py` to apply dependency updates.
4. Restart the Plantit service. No schema migrations are required (tables auto-create on boot).
5. Run `python tools/smoke.py` while the server is up to confirm health and static integrity.

## Service management
### Systemd (Linux)
Create `/etc/systemd/system/plantit.service`:
```ini
[Unit]
Description=Plantit (FastAPI)
After=network.target

[Service]
WorkingDirectory=/opt/plantit
Environment="APP_HOST=0.0.0.0" "APP_PORT=7600"
ExecStart=/opt/plantit/.venv/bin/python run.py
Restart=on-failure
User=plantit

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now plantit
```

### Windows service (NSSM)
1. Install [NSSM](https://nssm.cc/).
2. From an elevated prompt:
   ```powershell
   nssm install Plantit "C:\plantit\.venv\Scripts\python.exe" "C:\plantit\run.py"
   nssm set Plantit AppDirectory "C:\plantit"
   nssm set Plantit AppEnvironmentExtra APP_HOST=0.0.0.0 APP_PORT=7600
   nssm start Plantit
   ```

## Logs & troubleshooting
- `python run.py` prints uvicorn access logs to stdout/stderr; capture via systemd journal or Windows Event Viewer.
- Use `/health` to confirm service status and static manifest hashes.
- Run `sqlite3 app.db '.tables'` to inspect database contents.

## Maintenance checklist
- [ ] Daily backup rotation validated.
- [ ] Smoke test executed after each deploy.
- [ ] Wheel cache refreshed before quarterly updates.
