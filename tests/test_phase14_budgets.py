import gzip
import pathlib
import re

ENTRY_MODULE = pathlib.Path("frontend/app.js")
REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
IMPORT_RE = re.compile(r"^import\s+[^;]*?from\s+['\"]([^'\"]+)['\"];?", re.MULTILINE)


def _resolve_import(path: pathlib.Path, spec: str) -> pathlib.Path | None:
    if not spec.startswith('.'):
        return None
    target = (path.parent / spec).resolve()
    if target.suffix:
        return target
    return target.with_suffix('.js')


def _collect_static_modules(entry: pathlib.Path) -> set[pathlib.Path]:
    stack = [entry.resolve()]
    discovered: set[pathlib.Path] = set()
    while stack:
        current = stack.pop()
        if current in discovered:
            continue
        discovered.add(current)
        source = current.read_text(encoding='utf-8')
        for match in IMPORT_RE.finditer(source):
            resolved = _resolve_import(current, match.group(1))
            if resolved and resolved.exists():
                stack.append(resolved)
    return discovered


def test_initial_bundle_within_budget():
    modules = _collect_static_modules(REPO_ROOT / ENTRY_MODULE)
    payload = b''.join(module.read_bytes() for module in sorted(modules))
    gzipped = gzip.compress(payload, compresslevel=9)
    assert len(gzipped) < 50_000, f"Initial bundle exceeds budget: {len(gzipped)} bytes gzipped"


def test_non_critical_modules_are_lazy_loaded():
    source = (REPO_ROOT / ENTRY_MODULE).read_text(encoding='utf-8')
    statically_imported = IMPORT_RE.findall(source)
    forbidden = [
        spec
        for spec in statically_imported
        if any(token in spec for token in ('./villages/', './services/importExport.js', './services/diagnostics.js'))
    ]
    assert not forbidden, f"Non-critical modules should be dynamically imported: {forbidden}"
