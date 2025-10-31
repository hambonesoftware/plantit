from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from uuid import uuid4

import pytest
from playwright.sync_api import Error as PlaywrightError, sync_playwright


pytestmark = pytest.mark.e2e


with sync_playwright() as _playwright:
    try:  # pragma: no cover - runtime availability check
        _browser = _playwright.chromium.launch()
    except PlaywrightError as exc:
        pytest.skip(f"Chromium not installed for Playwright: {exc}", allow_module_level=True)
    else:
        _browser.close()


def _collect_paint_metrics(page) -> dict[str, object]:
    return page.evaluate(
        """
        () => {
            const paints = performance.getEntriesByType('paint').map((entry) => ({
                name: entry.name,
                startTime: entry.startTime,
            }));
            const nav = performance.getEntriesByType('navigation')[0];
            const domContentLoaded = nav ? nav.domContentLoadedEventEnd - nav.startTime : null;
            return { paints, domContentLoaded };
        }
        """
    )


def test_first_paint_fast(page, plantit_base_url: str, e2e_artifacts_dir: Path):
    page.goto(f"{plantit_base_url}/", wait_until="networkidle")
    page.wait_for_selector("main >> text=Plantit")

    metrics = _collect_paint_metrics(page)
    fcp = next((entry["startTime"] for entry in metrics["paints"] if entry["name"] == "first-contentful-paint"), None)
    if fcp is None:
        fcp = metrics.get("domContentLoaded")

    assert fcp is not None, "Unable to determine initial paint timing"
    assert fcp < 2000, f"First paint exceeded budget: {fcp}ms"

    report = {
        "first_contentful_paint_ms": fcp,
        "paints": metrics["paints"],
    }

    artifact_path = e2e_artifacts_dir / "first_paint_metrics.json"
    artifact_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    page.screenshot(path=str(e2e_artifacts_dir / "first_paint.png"), full_page=True)


def test_deep_link_village_detail(page, plantit_base_url: str):
    page.goto(f"{plantit_base_url}/#villages/village-002", wait_until="networkidle")
    page.wait_for_selector('[data-role="detail-content"]:not([hidden])')

    name = page.locator('[data-role="detail-name"]').inner_text()
    assert name == "Solstice Ridge"

    selected = page.locator('[data-role="village-list"] li[aria-selected="true"]')
    assert selected.inner_text().strip().startswith("Solstice Ridge")


def test_village_crud_flow(page, plantit_base_url: str):
    unique = uuid4().hex[:8]
    village_name = f"E2E Village {unique}"
    updated_village = f"E2E Village {unique} Updated"
    plant_name = f"E2E Plant {unique}"
    timestamp = datetime.utcnow().strftime("%Y-%m-%d")
    watered_at = datetime.utcnow().strftime("%Y-%m-%dT%H:%M")

    page.goto(f"{plantit_base_url}/#villages", wait_until="networkidle")
    page.wait_for_selector('[data-role="village-list"]')

    page.click('[data-action="village-create-toggle"]')
    page.fill('[data-role="village-name"]', village_name)
    page.fill('[data-role="village-climate"]', "Temperate")
    page.fill('[data-role="village-health"]', "0.7")
    page.fill('[data-role="village-established"]', timestamp)
    page.fill('[data-role="village-irrigation"]', "drip")
    page.fill('[data-role="village-description"]', "Created via Playwright")
    page.click('[data-role="village-create-form"] button:has-text("Save Village")')

    page.wait_for_selector('[data-role="detail-content"]:not([hidden])')
    page.wait_for_selector(f'[data-role="detail-name"]:has-text("{village_name}")')

    page.click('[data-action="detail-edit"]')
    page.fill('[data-role="detail-name-input"]', updated_village)
    page.fill('[data-role="detail-description-input"]', "Updated via E2E test")
    page.fill('[data-role="detail-health-input"]', "0.8")
    page.click('[data-role="detail-form"] button:has-text("Save Changes")')
    page.wait_for_selector(f'[data-role="detail-name"]:has-text("{updated_village}")')

    page.wait_for_selector('[data-role="plant-content"]:not([hidden])')
    page.click('[data-action="plant-create-toggle"]')
    page.fill('[data-role="plant-name"]', plant_name)
    page.fill('[data-role="plant-species"]', "Testus playwrightii")
    page.select_option('[data-role="plant-stage"]', "vegetative")
    page.fill('[data-role="plant-last-watered"]', watered_at)
    page.fill('[data-role="plant-health"]', "0.9")
    page.fill('[data-role="plant-notes"]', "Initial seedling")
    page.click('[data-role="plant-form"] button:has-text("Save Plant")')
    page.wait_for_selector(f'[data-role="plant-list"] li:has-text("{plant_name}")')

    page.click(f'[data-role="plant-list"] li:has-text("{plant_name}") button:has-text("Edit")')
    page.select_option('[data-role="plant-stage"]', "flowering")
    page.fill('[data-role="plant-notes"]', "Blooming")
    page.click('[data-role="plant-form"] button:has-text("Save Plant")')
    page.wait_for_selector(f'[data-role="plant-list"] li:has-text("{plant_name}") >> text=Flowering')

    page.click(f'[data-role="plant-list"] li:has-text("{plant_name}") button:has-text("Edit")')
    page.click('[data-role="plant-form"] button:has-text("Delete")')
    page.wait_for_selector(f'[data-role="plant-list"] li:has-text("{plant_name}")', state="detached")
    page.wait_for_selector('[data-role="plant-empty"]:not([hidden])')

    dialog_resolved = False

    def _accept_dialog(dialog):
        nonlocal dialog_resolved
        dialog.accept()
        dialog_resolved = True

    page.once("dialog", _accept_dialog)
    page.click('[data-action="detail-delete"]')
    page.wait_for_selector('[data-role="detail-placeholder"]:not([hidden])')
    page.wait_for_selector(f'[data-role="village-list"] li:has-text("{updated_village}")', state="detached")
    assert dialog_resolved, "Confirmation dialog for village deletion was not handled"
