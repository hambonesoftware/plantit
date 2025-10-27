"""Utilities for working with HTTP ETags."""
from __future__ import annotations

import hashlib
import json
from typing import Any


def compute_etag(payload: Any) -> str:
    """Compute a stable SHA-256 ETag for the given payload."""
    serialized = json.dumps(payload, sort_keys=True, default=str, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
