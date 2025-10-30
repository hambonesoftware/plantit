# Plantit (Stability-First MVVM SPA + FastAPI) — Complete Development Plan
**Date:** 2025-10-30

This plan targets a reliability-first rollout for a local, self-hosted web app with:
- **Frontend:** HTML/CSS/ESM-JS (no bundler), strict MVVM (views + thin viewmodels), deterministic first paint.
- **Backend:** Python 3.12 + FastAPI + Uvicorn, on port 5581.
- **Dev Ports:** Frontend on 5580, Backend on 5581, orchestrated by `run.py` (single command).
- **Goal:** “It always paints,” then incrementally restore features with strong contracts, tests, and observability.

Two run modes:
- **Dev:** separate ports (CORS allowed, SPA fallback, zero SW by default).
- **Prod:** Optional unified port (FastAPI static mount) with strict CSP and no CORS required.
