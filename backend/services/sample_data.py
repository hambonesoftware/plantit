"""Utilities for seeding the development database with sample data."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from sqlmodel import Session, delete, select

from backend.config import get_settings
from backend.models import Log, Photo, Plant, PlantKind, Task, TaskCategory, TaskState, Village

__all__ = ["ensure_sample_data"]


def ensure_sample_data(session: Session, *, force: bool = False) -> bool:
    """Populate the database with a representative demo garden.

    The function is idempotent: if data already exists and ``force`` is not
    requested the database is left untouched. When ``force`` is ``True`` the
    existing domain tables are cleared before recreating the sample records.
    """

    if not force and session.exec(select(Village).limit(1)).first() is not None:
        return False

    if force:
        for model in (Photo, Log, Task, Plant, Village):
            session.exec(delete(model))
        session.commit()

    today = date.today()
    herb_patch = Village(
        name="Herb Patch",
        description="Kitchen herbs thriving in morning sun.",
        timezone="UTC",
    )
    citrus_row = Village(
        name="Citrus Row",
        description="Container citrus experimenting with dwarf varieties.",
        timezone="UTC",
    )
    greenhouse = Village(
        name="Propagation Greenhouse",
        description="Cuttings and seedlings under grow lights.",
        timezone="UTC",
    )

    session.add_all([herb_patch, citrus_row, greenhouse])
    session.commit()
    for village in (herb_patch, citrus_row, greenhouse):
        session.refresh(village)

    plants = _create_plants(session, today, herb_patch, citrus_row, greenhouse)
    photos = _ensure_sample_photos(plants, today)
    _attach_photos(session, photos)
    _create_logs(session, today, plants)
    _create_tasks(session, today, plants)
    session.commit()
    return True


def _create_plants(
    session: Session,
    today: date,
    herb_patch: Village,
    citrus_row: Village,
    greenhouse: Village,
) -> dict[str, Plant]:
    plants: dict[str, Plant] = {}
    mint = Plant(
        village_id=herb_patch.id,
        name="Peppermint",
        species="Mentha × piperita",
        variety="Chocolate Mint",
        kind=PlantKind.herb,
        acquired_on=today - timedelta(days=280),
        tags=["perennial", "partial shade"],
        care_profile={"watering": "Keep soil evenly moist", "feeding": "Fish emulsion monthly"},
        notes="Thrives when harvested frequently to avoid legginess.",
    )
    thyme = Plant(
        village_id=herb_patch.id,
        name="Lemon Thyme",
        species="Thymus citriodorus",
        kind=PlantKind.herb,
        acquired_on=today - timedelta(days=420),
        tags=["drought tolerant"],
        care_profile={"pruning": "Shear lightly after flowering"},
    )
    basil = Plant(
        village_id=herb_patch.id,
        name="Genovese Basil",
        species="Ocimum basilicum",
        kind=PlantKind.herb,
        acquired_on=today - timedelta(days=60),
        tags=["annual"],
        notes="Pinch weekly to encourage bushy growth.",
    )
    meyer = Plant(
        village_id=citrus_row.id,
        name="Meyer Lemon",
        species="Citrus × meyeri",
        kind=PlantKind.tree,
        acquired_on=today - timedelta(days=560),
        tags=["container"],
        care_profile={"feeding": "Citrus fertilizer every 6 weeks"},
    )
    calamondin = Plant(
        village_id=citrus_row.id,
        name="Calamondin Orange",
        species="Citrus × microcarpa",
        kind=PlantKind.tree,
        acquired_on=today - timedelta(days=365),
        tags=["ornamental"],
        notes="Protect from frost; bring indoors below 45°F.",
    )
    monstera = Plant(
        village_id=greenhouse.id,
        name="Monstera Deliciosa",
        species="Monstera deliciosa",
        kind=PlantKind.succulent,
        acquired_on=today - timedelta(days=180),
        tags=["humidity loving"],
        care_profile={"watering": "Allow top inch to dry", "light": "Bright indirect"},
    )
    peperomia = Plant(
        village_id=greenhouse.id,
        name="Watermelon Peperomia",
        species="Peperomia argyreia",
        kind=PlantKind.succulent,
        acquired_on=today - timedelta(days=120),
        tags=["compact"],
        care_profile={"watering": "Light watering", "humidity": "40-50%"},
    )

    session.add_all([mint, thyme, basil, meyer, calamondin, monstera, peperomia])
    session.commit()
    for key, plant in {
        "mint": mint,
        "thyme": thyme,
        "basil": basil,
        "meyer": meyer,
        "calamondin": calamondin,
        "monstera": monstera,
        "peperomia": peperomia,
    }.items():
        session.refresh(plant)
        plants[key] = plant
    return plants


def _create_tasks(session: Session, today: date, plants: dict[str, Plant]) -> None:
    tomorrow = today + timedelta(days=1)
    upcoming = today + timedelta(days=3)
    tasks = [
        Task(
            plant_id=plants["mint"].id,
            title="Deep water peppermint bed",
            due_date=today,
            category=TaskCategory.watering,
        ),
        Task(
            plant_id=plants["mint"].id,
            title="Harvest sprigs for iced tea",
            due_date=upcoming,
            category=TaskCategory.pruning,
        ),
        Task(
            plant_id=plants["thyme"].id,
            title="Feed with liquid kelp",
            due_date=today - timedelta(days=1),
            category=TaskCategory.feeding,
        ),
        Task(
            plant_id=plants["basil"].id,
            title="Pinch top growth",
            due_date=tomorrow,
            category=TaskCategory.pruning,
        ),
        Task(
            plant_id=plants["meyer"].id,
            title="Check moisture meter",
            due_date=today,
            category=TaskCategory.watering,
        ),
        Task(
            plant_id=plants["calamondin"].id,
            title="Inspect for scale",
            due_date=today + timedelta(days=5),
            category=TaskCategory.inspection,
        ),
        Task(
            plant_id=plants["monstera"].id,
            title="Dust leaves",
            due_date=today + timedelta(days=2),
            category=TaskCategory.pruning,
        ),
        Task(
            plant_id=plants["peperomia"].id,
            title="Rotate for even light",
            due_date=today,
            category=TaskCategory.custom,
        ),
    ]
    session.add_all(tasks)


def _create_logs(session: Session, today: date, plants: dict[str, Plant]) -> None:
    entries = [
        Log(
            plant_id=plants["mint"].id,
            action="Watered",
            notes="Soaked until runoff.",
            performed_at=datetime.combine(
                today - timedelta(days=2),
                datetime.min.time(),
                tzinfo=timezone.utc,
            ),
        ),
        Log(
            plant_id=plants["thyme"].id,
            action="Watered",
            notes="Light sprinkle.",
            performed_at=datetime.combine(
                today - timedelta(days=5),
                datetime.min.time(),
                tzinfo=timezone.utc,
            ),
        ),
        Log(
            plant_id=plants["meyer"].id,
            action="Watered",
            notes="Measured moisture before watering.",
            performed_at=datetime.combine(
                today - timedelta(days=1),
                datetime.min.time(),
                tzinfo=timezone.utc,
            ),
        ),
    ]
    session.add_all(entries)


def _ensure_sample_photos(
    plants: dict[str, Plant], today: date
) -> dict[int, tuple[str, str, int, int]]:
    settings = get_settings()
    media_root = settings.media_root
    media_root.mkdir(parents=True, exist_ok=True)
    assets: dict[int, tuple[str, str, int, int]] = {}

    photo_specs = [
        (plants["mint"], "peppermint", "Peppermint", (44, 111, 84)),
        (plants["meyer"], "meyer-lemon", "Meyer Lemon", (214, 158, 46)),
        (plants["monstera"], "monstera", "Monstera", (34, 102, 72)),
    ]

    for plant, slug, label, color in photo_specs:
        folder = Path(f"{today.year}/{today.month:02d}")
        original_name = f"{slug}.jpg"
        thumb_name = f"thumb_{slug}.jpg"
        original_path = media_root / folder / original_name
        thumb_path = media_root / folder / thumb_name
        original_path.parent.mkdir(parents=True, exist_ok=True)
        _write_placeholder_image(original_path, label, color, size=(1200, 800))
        _write_placeholder_image(thumb_path, label, color, size=(600, 400))
        assets[plant.id] = (
            f"{folder.as_posix()}/{original_name}",
            f"{folder.as_posix()}/{thumb_name}",
            original_path.stat().st_size,
            1200,
            800,
        )
    return assets


def _attach_photos(session: Session, photos: dict[int, tuple[str, str, int, int]]) -> None:
    records = [
        Photo(
            plant_id=plant_id,
            filename=Path(file_path).name,
            file_path=file_path,
            thumbnail_path=thumb_path,
            content_type="image/jpeg",
            size_bytes=size_bytes,
            width=width,
            height=height,
        )
        for plant_id, (file_path, thumb_path, size_bytes, width, height) in photos.items()
    ]
    if records:
        session.add_all(records)


def _write_placeholder_image(
    path: Path, label: str, color: tuple[int, int, int], *, size: tuple[int, int]
) -> None:
    if path.exists():
        return
    image = Image.new("RGB", size, color)
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()
    text = label
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    position = ((size[0] - text_width) / 2, (size[1] - text_height) / 2)
    draw.text(position, text, fill=(255, 255, 255), font=font)
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="JPEG", quality=85)
