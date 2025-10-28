#!/usr/bin/env python3
"""Fetch wheels for offline install.
Run once on an online machine:
  python tools/fetch_wheels.py
This will populate /vendor/wheels
"""
import os, subprocess, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
vendor = ROOT/'vendor'/'wheels'
vendor.mkdir(parents=True, exist_ok=True)
subprocess.check_call([sys.executable, '-m', 'pip', 'wheel', '-r', str(ROOT/'requirements.txt'), '-w', str(vendor)])
print('Wheels downloaded to', vendor)
