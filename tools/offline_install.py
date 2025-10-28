#!/usr/bin/env python3
"""Install from local wheels only.
Usage:
  python tools/offline_install.py
"""
import os, subprocess, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
vendor = ROOT/'vendor'/'wheels'
if not vendor.exists():
    raise SystemExit('No wheels found. Run tools/fetch_wheels.py on an online machine first.')
subprocess.check_call([sys.executable, '-m', 'pip', 'install', '--no-index', '--find-links', str(vendor), '-r', str(ROOT/'requirements.txt')])
print('Installed from', vendor)
