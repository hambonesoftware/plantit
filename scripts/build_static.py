"""Build a backend-free PlantIt deployment: python scripts/build_static.py."""
from pathlib import Path
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'frontend'
OUTPUT = ROOT / 'dist' / 'plantit'


def write_service_worker():
    assets = sorted(path.relative_to(SOURCE).as_posix() for path in SOURCE.rglob('*') if path.is_file() and path.name != 'sw.js')
    digest = hashlib.sha256()
    for asset in assets:
        digest.update(asset.encode())
        digest.update((SOURCE / asset).read_bytes())
    version = digest.hexdigest()[:16]
    template = (ROOT / 'scripts' / 'service_worker.js').read_text()
    (SOURCE / 'sw.js').write_text(template.replace('__VERSION__', version).replace('__ASSETS__', json.dumps(assets, indent=2)))


def main():
    write_service_worker()
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    shutil.copytree(SOURCE, OUTPUT)
    for name in ('.htaccess', '_headers'):
        shutil.copyfile(ROOT / 'deploy' / name, OUTPUT / name)
    print(f'Static app ready: {OUTPUT}')
    print('Deploy only this directory. No Python service or database is needed.')


if __name__ == '__main__':
    main()
