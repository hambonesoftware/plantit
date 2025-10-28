from fastapi import APIRouter, HTTPException
from ..db import SessionLocal
from ..services.vm_builders import build_dashboard, build_village, build_plant, build_today

router = APIRouter()

@router.get("/dashboard")
def get_dashboard():
    with SessionLocal() as s:
        vm = build_dashboard(s)
        return vm.model_dump()

@router.get("/village/{village_id}")
def get_village(village_id: int):
    with SessionLocal() as s:
        try:
            vm = build_village(s, village_id)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        return vm.model_dump()

@router.get("/plant/{plant_id}")
def get_plant(plant_id: int):
    with SessionLocal() as s:
        try:
            vm = build_plant(s, plant_id)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        return vm.model_dump()

@router.get("/today")
def get_today():
    with SessionLocal() as s:
        vm = build_today(s)
        return vm.model_dump()
