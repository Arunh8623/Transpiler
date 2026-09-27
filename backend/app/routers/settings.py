from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter

from app.config import BACKEND_ROOT, get_settings
from app.schemas import SettingsRead, SettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])

ENV_PATH = BACKEND_ROOT / ".env"


@router.get("", response_model=SettingsRead)
def read_settings() -> SettingsRead:
    s = get_settings()
    return SettingsRead(
        gemini_model=s.gemini_model,
        output_dir=s.output_dir,
        gemini_key_configured=bool(s.gemini_api_key),
    )


@router.put("", response_model=SettingsRead)
def update_settings(payload: SettingsUpdate) -> SettingsRead:
    """
    Persists to the local .env file only. The key is never echoed back
    in full to the frontend, and never stored anywhere else.
    """
    lines: dict[str, str] = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, _, v = line.partition("=")
                lines[k.strip()] = v.strip()

    if payload.gemini_api_key:
        lines["GEMINI_API_KEY"] = payload.gemini_api_key.strip()
    if payload.gemini_model:
        lines["GEMINI_MODEL"] = payload.gemini_model.strip()

    ENV_PATH.write_text("\n".join(f"{k}={v}" for k, v in lines.items()) + "\n")

    get_settings.cache_clear()  # force reload on next request
    s = get_settings()
    return SettingsRead(
        gemini_model=s.gemini_model,
        output_dir=s.output_dir,
        gemini_key_configured=bool(s.gemini_api_key),
    )
