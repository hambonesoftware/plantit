"""Bootstrap the SQLite database without Alembic."""
from __future__ import annotations

from .db import init_db


def main() -> None:
    init_db()


if __name__ == "__main__":
    main()
    print("Database ready.")
