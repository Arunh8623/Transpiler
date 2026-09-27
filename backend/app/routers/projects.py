from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models import Project, ProjectStatus
from app.schemas import ProjectCreate, ProjectRead, ProjectUpdate

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.post("", response_model=ProjectRead)
def create_project(payload: ProjectCreate, session: Session = Depends(get_session)) -> Project:
    resolution_map = {
        "draft": "854x480",
        "standard": "1280x720",
        "high": "1920x1080",
        "cinematic": "1920x1080",
    }
    fps_map = {"draft": 24, "standard": 30, "high": 30, "cinematic": 60}

    project = Project(
        title=payload.prompt[:80],
        prompt=payload.prompt,
        mode=payload.mode,
        audience=payload.audience,
        quality_preset=payload.quality_preset,
        resolution=payload.resolution or resolution_map[payload.quality_preset.value],
        fps=payload.fps or fps_map[payload.quality_preset.value],
        aspect_ratio=payload.aspect_ratio,
        duration_target=payload.duration_target,
        background_color=payload.background_color,
        renderer=payload.renderer,
        camera_style=payload.camera_style,
        status=ProjectStatus.draft,
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@router.get("", response_model=list[ProjectRead])
def list_projects(
    q: str | None = None,
    favorite: bool | None = None,
    session: Session = Depends(get_session),
) -> list[Project]:
    stmt = select(Project).order_by(Project.updated_at.desc())
    if favorite is not None:
        stmt = stmt.where(Project.favorite == favorite)
    results = session.exec(stmt).all()
    if q:
        q_lower = q.lower()
        results = [p for p in results if q_lower in p.title.lower() or q_lower in p.prompt.lower()]
    return results


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: str, session: Session = Depends(get_session)) -> Project:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(project_id: str, payload: ProjectUpdate, session: Session = Depends(get_session)) -> Project:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    if payload.title is not None:
        project.title = payload.title
    if payload.favorite is not None:
        project.favorite = payload.favorite
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@router.delete("/{project_id}")
def delete_project(project_id: str, session: Session = Depends(get_session)) -> dict:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    session.delete(project)
    session.commit()
    return {"ok": True}


@router.post("/{project_id}/duplicate", response_model=ProjectRead)
def duplicate_project(project_id: str, session: Session = Depends(get_session)) -> Project:
    original = session.get(Project, project_id)
    if not original:
        raise HTTPException(404, "Project not found")
    copy = Project(
        title=f"{original.title} (copy)",
        prompt=original.prompt,
        mode=original.mode,
        audience=original.audience,
        quality_preset=original.quality_preset,
        resolution=original.resolution,
        fps=original.fps,
        aspect_ratio=original.aspect_ratio,
        duration_target=original.duration_target,
        background_color=original.background_color,
        renderer=original.renderer,
        camera_style=original.camera_style,
        status=ProjectStatus.draft,
    )
    session.add(copy)
    session.commit()
    session.refresh(copy)
    return copy
