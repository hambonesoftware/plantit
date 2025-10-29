#!/usr/bin/env python3
"""Offline smoke test for Plantit.

This script checks the /health endpoint and validates static file hashes.
Run it while the app server is running (python run.py)."""
from __future__ import annotations

import argparse
import asyncio
import hashlib
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]


def compute_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


async def fetch_health(base_url: str) -> dict:
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.get(f"{base_url.rstrip('/')}/health")
        response.raise_for_status()
        return response.json()


def validate_static(manifest: dict[str, str]) -> list[str]:
    mismatches: list[str] = []
    for rel_path, expected_hash in manifest.items():
        full_path = ROOT / rel_path
        if not full_path.exists():
            mismatches.append(f"Missing file: {rel_path}")
            continue
        actual_hash = compute_sha256(full_path)
        if actual_hash != expected_hash:
            mismatches.append(f"Hash mismatch for {rel_path}: expected {expected_hash}, got {actual_hash}")
    return mismatches


async def main() -> None:
    parser = argparse.ArgumentParser(description="Plantit offline smoke test")
    parser.add_argument("--url", default="http://127.0.0.1:7600", help="Base URL for the running Plantit instance")
    args = parser.parse_args()

    health = await fetch_health(args.url)
    status = health.get("status")
    if status != "ok":
        raise SystemExit(f"Unexpected health status: {status!r}")

    manifest = health.get("static")
    if not isinstance(manifest, dict) or not manifest:
        raise SystemExit("Health response missing static manifest")

    mismatches = validate_static(manifest)
    if mismatches:
        raise SystemExit("\n".join(mismatches))

    print("Smoke check passed. Static assets verified.")


if __name__ == "__main__":
    asyncio.run(main())
