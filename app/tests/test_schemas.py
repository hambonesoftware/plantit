from datetime import datetime, timedelta, timezone

from app.backend.models import Log, Plant, Task, Village
from app.backend.schemas import LogRead, PlantRead, TaskRead, VillageRead


def test_village_schema_roundtrip():
    village = Village(name="Atrium", note="Succulents")
    village.id = 7
    village.created_at = datetime.now(timezone.utc).replace(tzinfo=None)

    vm = VillageRead.model_validate(village)
    dumped = vm.model_dump()

    assert dumped["id"] == 7
    assert dumped["name"] == "Atrium"
    assert dumped["note"] == "Succulents"


def test_plant_schema_roundtrip():
    plant = Plant(village_id=7, name="Fern", species="Nephrolepis", frequency_days=4)
    plant.id = 11
    plant.photo_path = None
    plant.last_watered_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=2)

    vm = PlantRead.model_validate(plant)
    dumped = vm.model_dump()

    assert dumped["id"] == 11
    assert dumped["village_id"] == 7
    assert dumped["frequency_days"] == 4


def test_task_schema_roundtrip():
    due = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=1)
    task = Task(plant_id=11, kind="water", due_date=due)
    task.id = 3

    vm = TaskRead.model_validate(task)
    dumped = vm.model_dump()

    assert dumped["id"] == 3
    assert dumped["kind"] == "water"
    assert dumped["plant_id"] == 11


def test_log_schema_roundtrip():
    stamp = datetime.now(timezone.utc).replace(tzinfo=None)
    log = Log(plant_id=11, kind="water", note="Misted")
    log.id = 9
    log.ts = stamp

    vm = LogRead.model_validate(log)
    dumped = vm.model_dump()

    assert dumped["id"] == 9
    assert dumped["note"] == "Misted"
    assert dumped["ts"] == stamp
