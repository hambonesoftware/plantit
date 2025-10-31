"""Create a distributable archive for Plantit."""
from __future__ import annotations

import argparse
import tarfile
import time
from pathlib import Path
from typing import Iterable


DEFAULT_INCLUDE: Iterable[str] = (
    "backend",
    "frontend",
    "docs",
    "plan",
    "requirements.txt",
    "run.py",
    "serve.py",
)


def build_archive(label: str | None = None, include: Iterable[str] = DEFAULT_INCLUDE) -> Path:
    repo_root = Path(__file__).resolve().parents[1]
    timestamp = time.strftime("%Y%m%d-%H%M%S")
    suffix = f"-{label}" if label else ""
    artifacts_dir = repo_root / "artifacts" / "dist"
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    archive_name = f"plantit{suffix}-{timestamp}.tar.gz"
    archive_path = artifacts_dir / archive_name

    with tarfile.open(archive_path, mode="w:gz") as archive:
        for entry in include:
            source = repo_root / entry
            if not source.exists():
                continue
            archive.add(source, arcname=f"plantit/{entry}")

    return archive_path


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Package Plantit into a tar.gz archive")
    parser.add_argument("--label", help="Optional label to append to the archive name", default=None)
    args = parser.parse_args(argv)

    archive_path = build_archive(args.label)
    print(f"Created Plantit package: {archive_path}")


if __name__ == "__main__":
    main()
