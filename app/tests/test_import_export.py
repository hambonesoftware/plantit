from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.backend.db import Base
from app.backend.models import Village, Plant, Task, Log
from app.backend.services.import_export import ImportRequest, export_bundle, import_bundle
from app.backend.seed import seed_data


@pytest.fixture()
def session_factory(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}", future=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        seed_data.seed(session)
        session.commit()

    try:
        yield SessionLocal
    finally:
        engine.dispose()


def test_export_contains_seed_data(session_factory):
    session = session_factory()
    try:
        bundle = export_bundle(session)
        assert bundle.villages, 'Expected seeded villages'
        assert bundle.plants, 'Expected seeded plants'
        assert bundle.tasks, 'Expected seeded tasks'
        assert bundle.logs, 'Expected seeded logs'
    finally:
        session.close()


def test_import_dry_run_does_not_apply_changes(session_factory):
    session = session_factory()
    try:
        export_payload = export_bundle(session).model_dump()
    finally:
        session.close()

    village = deepcopy(export_payload['villages'][0])
    village_id = village['id']
    village['note'] = 'Dry run change'

    dry_run_payload = {**export_payload, 'villages': [village], 'dry_run': True}

    session = session_factory()
    try:
        report = import_bundle(session, ImportRequest(**dry_run_payload))

        assert report.dry_run is True
        assert report.applied is False
        assert report.updated['villages'] >= 1
    finally:
        session.close()

    session = session_factory()
    try:
        persisted = session.get(Village, village_id)
        assert persisted is not None
        assert persisted.note != 'Dry run change'
    finally:
        session.close()


def test_import_apply_merges_and_creates_records(session_factory):
    session = session_factory()
    try:
        export_payload = export_bundle(session).model_dump()
    finally:
        session.close()

    target_village = export_payload['villages'][0]
    target_village['name'] = 'Atrium Imported'

    next_plant_id = max(plant['id'] for plant in export_payload['plants']) + 100
    next_task_id = max(task['id'] for task in export_payload['tasks']) + 100
    next_log_id = max(log['id'] for log in export_payload['logs']) + 100

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    new_plant = {
        'id': next_plant_id,
        'village_id': target_village['id'],
        'name': 'Imported Test Plant',
        'species': 'Monstera deliciosa',
        'frequency_days': 4,
        'photo_path': None,
        'last_watered_at': (now - timedelta(days=1)).isoformat(),
    }
    new_task = {
        'id': next_task_id,
        'plant_id': next_plant_id,
        'kind': 'water',
        'due_date': (now + timedelta(days=3)).isoformat(),
        'done_at': None,
    }
    new_log = {
        'id': next_log_id,
        'plant_id': next_plant_id,
        'ts': now.isoformat(),
        'kind': 'water',
        'note': 'Imported via test',
    }

    payload = deepcopy(export_payload)
    payload['villages'][0] = target_village
    payload['plants'].append(new_plant)
    payload['tasks'].append(new_task)
    payload['logs'].append(new_log)
    payload['dry_run'] = False

    session = session_factory()
    try:
        report = import_bundle(session, ImportRequest(**payload))

        assert report.dry_run is False
        assert report.applied is True
        assert report.created['plants'] >= 1
        assert report.created['tasks'] >= 1
        assert report.created['logs'] >= 1
        assert report.updated['villages'] >= 1
    finally:
        session.close()

    session = session_factory()
    try:
        updated_village = session.get(Village, target_village['id'])
        assert updated_village is not None
        assert updated_village.name == 'Atrium Imported'

        new_plant = session.get(Plant, next_plant_id)
        assert new_plant is not None
        assert new_plant.name == 'Imported Test Plant'

        tasks = session.query(Task).filter(Task.plant_id == next_plant_id).all()
        assert any(task.id == next_task_id for task in tasks)

        logs = session.query(Log).filter(Log.plant_id == next_plant_id).all()
        assert any(log.id == next_log_id for log in logs)
    finally:
        session.close()
