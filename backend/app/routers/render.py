from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from app.database import engine, get_session
from app.models import Generation, Project, ProjectStatus, Render, RenderStatus
from app.schemas import RenderRead
from app.services.manim_runner import (
    cancel_render,
    generate_thumbnail,
    is_rendering,
    parse_progress_percent,
    render_log_path,
    run_manim_render,
    write_validated_code,
)
from app.services.validator import validate_manim_code

router = APIRouter(prefix="/api/projects/{project_id}/render", tags=["render"])


async def _execute_render(
    *,
    project_id: str,
    render_id: str,
    scene_class_name: str,
    resolution: str,
    fps: int,
    quality_preset: str,
    renderer: str,
    background_color: str,
) -> None:
    """
    Runs entirely detached from the HTTP request that triggered it, using
    its own DB session. This is what actually fixes the "stuck with no
    logs" bug: previously the whole render ran INSIDE the POST /render
    request handler, blocking it for the full render duration (which can
    be many minutes for 3D/OpenGL scenes) and only writing logs_path to the
    Render row once everything finished. Now the row is created - with
    logs_path already pointing at a real, growing file - before this task
    even starts, so the frontend can poll status and tail logs the whole
    time a render is running.
    """
    try:
        success, message, output_path, log_path = await run_manim_render(
            project_id=project_id,
            scene_class_name=scene_class_name,
            resolution=resolution,
            fps=fps,
            quality_preset=quality_preset,
            renderer=renderer,
            background_color=background_color,
        )
    except TimeoutError as e:
        with Session(engine) as session:
            render = session.get(Render, render_id)
            project = session.get(Project, project_id)
            if render and project:
                render.status = RenderStatus.timed_out
                render.error_message = str(e)
                project.status = ProjectStatus.failed
                session.add_all([render, project])
                session.commit()
        return
    except RuntimeError as e:
        with Session(engine) as session:
            render = session.get(Render, render_id)
            project = session.get(Project, project_id)
            if render and project:
                render.status = RenderStatus.failed
                render.error_message = str(e)
                project.status = ProjectStatus.failed
                session.add_all([render, project])
                session.commit()
        return

    with Session(engine) as session:
        render = session.get(Render, render_id)
        project = session.get(Project, project_id)
        if not render or not project:
            return
        if success and output_path:
            render.status = RenderStatus.succeeded
            render.output_video_path = str(output_path)
            project.status = ProjectStatus.completed
            thumb = await generate_thumbnail(output_path, project_id)
            if thumb:
                render.thumbnail_path = str(thumb)
        else:
            render.status = RenderStatus.failed
            render.error_message = message
            project.status = ProjectStatus.failed
        session.add_all([render, project])
        session.commit()


@router.post("", response_model=RenderRead)
async def start_render(project_id: str, session: Session = Depends(get_session)) -> Render:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    if is_rendering(project_id):
        raise HTTPException(409, "A render is already in progress for this project.")

    latest_gen = session.exec(
        select(Generation).where(Generation.project_id == project_id).order_by(Generation.version.desc())
    ).first()
    if not latest_gen:
        raise HTTPException(400, "Generate Manim code before rendering.")

    # Re-validate at render time too — never trust previously-stored code blindly.
    validation = validate_manim_code(latest_gen.generated_manim_code)
    if not validation.ok:
        raise HTTPException(422, f"Stored code failed re-validation: {'; '.join(validation.errors)}")

    scene_class = validation.scene_class_names[0]
    write_validated_code(project_id, latest_gen.generated_manim_code)
    log_path = render_log_path(project_id)  # touched now so it exists immediately

    render = Render(
        project_id=project_id,
        generation_id=latest_gen.id,
        status=RenderStatus.running,
        renderer=project.renderer,
        logs_path=str(log_path),
    )
    session.add(render)
    project.status = ProjectStatus.rendering
    session.add(project)
    session.commit()
    session.refresh(render)

    asyncio.create_task(
        _execute_render(
            project_id=project_id,
            render_id=render.id,
            scene_class_name=scene_class,
            resolution=project.resolution,
            fps=project.fps,
            quality_preset=project.quality_preset.value,
            renderer=project.renderer,
            background_color=project.background_color,
        )
    )

    return render


@router.post("/cancel")
def cancel_current_render(project_id: str) -> dict:
    cancelled = cancel_render(project_id)
    if not cancelled:
        raise HTTPException(400, "No active render for this project.")
    return {"ok": True}


@router.get("", response_model=list[RenderRead])
def list_renders(project_id: str, session: Session = Depends(get_session)) -> list[Render]:
    return session.exec(
        select(Render).where(Render.project_id == project_id).order_by(Render.created_at.desc())
    ).all()


@router.get("/latest", response_model=RenderRead | None)
def latest_render(project_id: str, session: Session = Depends(get_session)) -> Render | None:
    return session.exec(
        select(Render).where(Render.project_id == project_id).order_by(Render.created_at.desc())
    ).first()


@router.get("/{render_id}/video")
def download_video(project_id: str, render_id: str, session: Session = Depends(get_session)):
    render = session.get(Render, render_id)
    if not render or not render.output_video_path or not Path(render.output_video_path).exists():
        raise HTTPException(404, "Video not found")
    return FileResponse(render.output_video_path, media_type="video/mp4", filename="transpiler_output.mp4")


@router.get("/{render_id}/thumbnail")
def download_thumbnail(project_id: str, render_id: str, session: Session = Depends(get_session)):
    render = session.get(Render, render_id)
    if not render or not render.thumbnail_path or not Path(render.thumbnail_path).exists():
        raise HTTPException(404, "Thumbnail not found")
    return FileResponse(render.thumbnail_path, media_type="image/jpeg")


@router.get("/{render_id}/logs")
def download_logs(project_id: str, render_id: str, session: Session = Depends(get_session)):
    render = session.get(Render, render_id)
    if not render or not render.logs_path or not Path(render.logs_path).exists():
        raise HTTPException(404, "Logs not found")
    return FileResponse(render.logs_path, media_type="text/plain", filename="render.log")


@router.get("/{render_id}/progress")
def render_progress(project_id: str, render_id: str, session: Session = Depends(get_session)) -> dict:
    render = session.get(Render, render_id)
    if not render or not render.logs_path or not Path(render.logs_path).exists():
        return {"percent": None, "tail": ""}
    text = Path(render.logs_path).read_text(encoding="utf-8", errors="replace")
    return {"percent": parse_progress_percent(text), "tail": text[-2000:]}
