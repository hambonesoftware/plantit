"""Plantit package metadata."""
from __future__ import annotations

from importlib import resources


def _load_version() -> str:
    """Return the current Plantit version string."""
    try:
        return (resources.files(__name__) / "VERSION").read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return "0.0.0-dev"


__version__ = _load_version()

__all__ = ["__version__"]
