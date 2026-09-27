from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.models import AspectRatio, Mode, ProjectStatus, QualityPreset, RenderStatus, Role


# ---------- Projects ----------

class ProjectCreate(BaseModel):
    prompt: str = Field(min_length=3, max_length=4000)
    mode: Mode
    audience: Role
    quality_preset: QualityPreset = QualityPreset.standard
    aspect_ratio: AspectRatio = AspectRatio.widescreen
    duration_target: int = Field(default=45, ge=5, le=180)
    background_color: str = "#0B0F1A"
    renderer: str = "cairo"
    camera_style: str | None = None
    # advanced overrides (optional)
    resolution: str | None = None
    fps: int | None = None


class ProjectRead(BaseModel):
    id: str
    title: str
    prompt: str
    mode: Mode
    audience: Role
    status: ProjectStatus
    quality_preset: QualityPreset
    resolution: str
    fps: int
    aspect_ratio: AspectRatio
    duration_target: int
    favorite: bool
    created_at: datetime
    updated_at: datetime


class ProjectUpdate(BaseModel):
    title: str | None = None
    favorite: bool | None = None


# ---------- Generation (Gemini output contract) ----------

class SceneStep(BaseModel):
    beat: str
    description: str
    duration_estimate: float | None = None


class GeminiGenerationResult(BaseModel):
    title: str
    scene_plan: list[SceneStep]
    manim_code: str
    notes_markdown: str
    tags: list[str] = []
    estimated_duration: float


class GenerationRead(BaseModel):
    id: str
    project_id: str
    scene_plan_json: str
    generated_manim_code: str
    notes_markdown: str
    gemini_model: str
    version: int
    created_at: datetime


class RepairRequest(BaseModel):
    error_output: str


# ---------- Render ----------

class RenderRead(BaseModel):
    id: str
    project_id: str
    status: RenderStatus
    output_video_path: str | None
    thumbnail_path: str | None
    logs_path: str | None
    error_message: str | None
    render_time_seconds: float | None
    created_at: datetime


class RenderProgressEvent(BaseModel):
    stage: str  # planning | generating_code | validating | rendering | completed | failed
    message: str
    percent: float | None = None


# ---------- System ----------

class SystemStatus(BaseModel):
    gemini_key_configured: bool
    manim_installed: bool
    manim_version: str | None
    ffmpeg_installed: bool
    ffmpeg_version: str | None
    latex_installed: bool
    latex_version: str | None


# ---------- Settings ----------

class SettingsRead(BaseModel):
    gemini_model: str
    output_dir: str
    gemini_key_configured: bool


class SettingsUpdate(BaseModel):
    gemini_api_key: str | None = None
    gemini_model: str | None = None
