from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum

from sqlmodel import Field, SQLModel


def new_id() -> str:
    return uuid.uuid4().hex


class Role(str, Enum):
    high_school_student = "high_school_student"
    college_student = "college_student"
    high_school_teacher = "high_school_teacher"
    college_professor = "college_professor"
    general_learner = "general_learner"


class Mode(str, Enum):
    explain_concept = "explain_concept"
    graph_2d = "graph_2d"
    model_3d = "model_3d"
    solve_doubt = "solve_doubt"
    teacher_lesson = "teacher_lesson"


class QualityPreset(str, Enum):
    draft = "draft"
    standard = "standard"
    high = "high"
    cinematic = "cinematic"
    custom = "custom"


class AspectRatio(str, Enum):
    widescreen = "16:9"
    vertical = "9:16"
    square = "1:1"


class ProjectStatus(str, Enum):
    draft = "draft"
    planning = "planning"
    generating_code = "generating_code"
    validating = "validating"
    rendering = "rendering"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class RenderStatus(str, Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    cancelled = "cancelled"
    timed_out = "timed_out"


class UserProfile(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    display_name: str = "Learner"
    selected_role: Role = Role.general_learner
    theme: str = "dark"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Project(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    title: str
    prompt: str
    mode: Mode
    audience: Role
    status: ProjectStatus = ProjectStatus.draft
    quality_preset: QualityPreset = QualityPreset.standard
    resolution: str = "1280x720"
    fps: int = 30
    aspect_ratio: AspectRatio = AspectRatio.widescreen
    duration_target: int = 45  # seconds
    background_color: str = "#0B0F1A"
    renderer: str = "cairo"  # cairo | opengl
    camera_style: str | None = None  # for 3D: orbit | slow_rotate | fixed | top_down | custom
    favorite: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Generation(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    project_id: str = Field(foreign_key="project.id", index=True)
    scene_plan_json: str  # JSON string
    generated_manim_code: str
    notes_markdown: str
    gemini_model: str
    prompt_version: str = "v1"
    version: int = 1
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Render(SQLModel, table=True):
    id: str = Field(default_factory=new_id, primary_key=True)
    project_id: str = Field(foreign_key="project.id", index=True)
    generation_id: str | None = Field(default=None, foreign_key="generation.id")
    status: RenderStatus = RenderStatus.queued
    renderer: str = "cairo"
    output_video_path: str | None = None
    thumbnail_path: str | None = None
    logs_path: str | None = None
    duration_seconds: float | None = None
    render_time_seconds: float | None = None
    error_message: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
