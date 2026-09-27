from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models import Generation, Project, ProjectStatus
from app.schemas import GenerationRead, RepairRequest
from app.services.ai_provider import ProviderError, get_ai_provider
from app.services.validator import validate_manim_code

router = APIRouter(prefix="/api/projects/{project_id}/generation", tags=["generation"])


@router.post("", response_model=GenerationRead)
async def generate_for_project(project_id: str, session: Session = Depends(get_session)) -> Generation:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    project.status = ProjectStatus.planning
    session.add(project)
    session.commit()

    provider = get_ai_provider()
    try:
        project.status = ProjectStatus.generating_code
        session.add(project)
        session.commit()

        result = await provider.generate(
            prompt=project.prompt,
            mode=project.mode,
            audience=project.audience,
            duration_target=project.duration_target,
            camera_style=project.camera_style,
        )
    except ProviderError as e:
        project.status = ProjectStatus.failed
        session.add(project)
        session.commit()
        raise HTTPException(502, str(e)) from e

    project.status = ProjectStatus.validating
    session.add(project)
    session.commit()

    validation = validate_manim_code(result.manim_code)
    if not validation.ok:
        project.status = ProjectStatus.failed
        session.add(project)
        session.commit()
        raise HTTPException(
            422,
            f"Generated code failed safety validation: {'; '.join(validation.errors)}",
        )

    existing_count = len(
        session.exec(select(Generation).where(Generation.project_id == project_id)).all()
    )

    generation = Generation(
        project_id=project_id,
        scene_plan_json=json.dumps([s.model_dump() for s in result.scene_plan]),
        generated_manim_code=result.manim_code,
        notes_markdown=result.notes_markdown,
        gemini_model=provider.__class__.__name__,
        version=existing_count + 1,
    )
    session.add(generation)

    project.title = result.title or project.title
    project.status = ProjectStatus.draft  # ready to render
    session.add(project)
    session.commit()
    session.refresh(generation)
    return generation


@router.get("", response_model=list[GenerationRead])
def list_generations(project_id: str, session: Session = Depends(get_session)) -> list[Generation]:
    return session.exec(
        select(Generation).where(Generation.project_id == project_id).order_by(Generation.version.desc())
    ).all()


@router.post("/repair", response_model=GenerationRead)
async def repair_generation(
    project_id: str, payload: RepairRequest, session: Session = Depends(get_session)
) -> Generation:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    latest = session.exec(
        select(Generation).where(Generation.project_id == project_id).order_by(Generation.version.desc())
    ).first()
    if not latest:
        raise HTTPException(400, "No prior generation to repair.")

    provider = get_ai_provider()
    try:
        result = await provider.repair(
            prompt=project.prompt,
            mode=project.mode,
            audience=project.audience,
            current_code=latest.generated_manim_code,
            error_output=payload.error_output,
        )
    except ProviderError as e:
        raise HTTPException(502, str(e)) from e

    validation = validate_manim_code(result.manim_code)
    if not validation.ok:
        raise HTTPException(
            422,
            f"Repaired code failed safety validation: {'; '.join(validation.errors)}",
        )

    generation = Generation(
        project_id=project_id,
        scene_plan_json=json.dumps([s.model_dump() for s in result.scene_plan]),
        generated_manim_code=result.manim_code,
        notes_markdown=result.notes_markdown,
        gemini_model=provider.__class__.__name__,
        version=latest.version + 1,
    )
    session.add(generation)
    project.status = ProjectStatus.draft
    session.add(project)
    session.commit()
    session.refresh(generation)
    return generation
