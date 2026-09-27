"""
Central configuration for Transpiler backend.
All values are read from environment variables / local .env file.
NOTHING in this module is ever sent to the frontend as-is; the API key
in particular is only used server-side inside GeminiService.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Root of the whole app (backend/)
BACKEND_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_ROOT / "data"
PROJECTS_DIR = BACKEND_ROOT / "projects"          # isolated per-project code + media
DB_PATH = DATA_DIR / "transpiler.db"

for d in (DATA_DIR, PROJECTS_DIR):
    d.mkdir(parents=True, exist_ok=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Gemini ---
    gemini_api_key: str | None = Field(default=None, alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-3-flash-preview", alias="GEMINI_MODEL")

    # --- App ---
    app_env: str = Field(default="development", alias="APP_ENV")
    host: str = Field(default="127.0.0.1", alias="HOST")
    port: int = Field(default=8000, alias="PORT")

    # --- Rendering limits (safety) ---
    max_render_seconds: int = Field(default=600, alias="MAX_RENDER_SECONDS")
    max_scene_duration_seconds: int = Field(default=180, alias="MAX_SCENE_DURATION_SECONDS")
    max_concurrent_renders: int = Field(default=1, alias="MAX_CONCURRENT_RENDERS")
    max_output_mb: int = Field(default=500, alias="MAX_OUTPUT_MB")

    # --- Output ---
    output_dir: str = Field(default=str(PROJECTS_DIR), alias="OUTPUT_DIR")

    database_url: str = Field(default=f"sqlite:///{DB_PATH}", alias="DATABASE_URL")


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


def gemini_key_configured() -> bool:
    s = get_settings()
    return bool(s.gemini_api_key and s.gemini_api_key.strip())
