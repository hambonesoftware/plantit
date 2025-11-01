"""Test configuration for Plantit test suite."""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure the repository root is on the import path so ``backend`` and ``plantit``
# packages can be imported when tests are executed from arbitrary working
# directories.
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
