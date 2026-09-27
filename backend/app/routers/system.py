from __future__ import annotations

from fastapi import APIRouter

from app.schemas import SystemStatus
from app.services.system_check import get_system_status

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/status", response_model=SystemStatus)
def system_status() -> SystemStatus:
    return get_system_status()
