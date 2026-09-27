"""
Safe local execution of validated Manim code.

Hard rules:
- We NEVER build a shell string. We always call subprocess with a list
  of arguments and shell=False.
- The user's prompt and generated code are never interpolated into the
  command line; the code is written to a fixed file path first, and
  only that file path + a fixed set of numeric/enum flags go on argv.
- Every render is timeout-bounded and tracked so it can be cancelled.
"""
from __future__ import annotations

import asyncio
import re
import shutil
import time
from dataclasses import dataclass
from pathlib import Path

from app.config import get_settings

QUALITY_FLAGS = {
    "draft": "-ql",       # 480p15 -> we override fps separately
    "standard": "-qm",
    "high": "-qh",
    "cinematic": "-qk",   # 4k flag used as a base; fps/resolution overridden below
}


@dataclass
class RenderHandle:
    process: asyncio.subprocess.Process
    log_path: Path
    started_at: float


# Tracks the single in-flight render process per project id so Cancel Render
# can terminate only the process it started — never an arbitrary PID.
_active_renders: dict[str, RenderHandle] = {}


def project_dir(project_id: str) -> Path:
    settings = get_settings()
    # Always resolve to an absolute path, regardless of whether OUTPUT_DIR
    # in .env is relative or absolute. This path gets used BOTH as the
    # subprocess's cwd AND to build the scene file argument passed to
    # `manim`; if it were left relative, Manim would resolve that file
    # argument a second time against the subprocess's own cwd (which is
    # already inside this directory), silently doubling the path
    # (…\projects\<id>\projects\<id>\scene.py) and failing with
    # FileNotFoundError.
    d = (Path(settings.output_dir) / project_id).resolve()
    d.mkdir(parents=True, exist_ok=True)
    (d / "media").mkdir(exist_ok=True)
    return d


def scene_file_path(project_id: str) -> Path:
    return project_dir(project_id) / "scene.py"


def render_log_path(project_id: str) -> Path:
    """
    Deterministic log path, created (touched) immediately so the frontend
    can attach it to a Render row and start polling it the instant a render
    is queued — not only once the whole render has finished. Previously the
    Render row's logs_path was only ever set after run_manim_render
    returned, so the Render Logs tab showed "No render logs yet" for the
    entire duration of a render, which is especially misleading for slow
    3D/OpenGL scenes that can legitimately take several minutes.
    """
    path = project_dir(project_id) / "render.log"
    if not path.exists():
        path.touch()
    return path


def write_validated_code(project_id: str, code: str) -> Path:
    path = scene_file_path(project_id)
    path.write_text(code, encoding="utf-8")
    return path


def tool_available(name: str) -> bool:
    return shutil.which(name) is not None


async def _read_stream_to_file(stream: asyncio.StreamReader, log_file) -> None:
    while True:
        line = await stream.readline()
        if not line:
            break
        log_file.write(line.decode(errors="replace"))
        log_file.flush()


_PERCENT_RE = re.compile(r"(\d{1,3})%\|")


def parse_progress_percent(log_text: str) -> float | None:
    """
    Manim's console output uses tqdm-style progress bars per animation,
    e.g. "Animation 3: FadeIn(Text): 45%|####      | 45/100 [00:01<00:01]".
    We don't need exact overall completion - just the last percentage seen
    is a good-enough live indicator for the UI.
    """
    matches = _PERCENT_RE.findall(log_text[-4000:])  # only look at the tail
    if not matches:
        return None
    try:
        return float(matches[-1])
    except ValueError:
        return None


async def generate_thumbnail(video_path: Path, project_id: str) -> Path | None:
    """Grabs a single frame ~1s in as a JPEG thumbnail for History Library cards."""
    if not tool_available("ffmpeg"):
        return None
    thumb_path = project_dir(project_id) / "thumbnail.jpg"
    args = [
        "ffmpeg", "-y",
        "-ss", "1",
        "-i", str(video_path),
        "-frames:v", "1",
        "-vf", "scale=480:-1",
        str(thumb_path),
    ]
    try:
        process = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await asyncio.wait_for(process.wait(), timeout=30)
    except (asyncio.TimeoutError, OSError):
        return None
    return thumb_path if thumb_path.exists() else None


async def run_manim_render(
    *,
    project_id: str,
    scene_class_name: str,
    resolution: str,
    fps: int,
    quality_preset: str,
    renderer: str,
    background_color: str,
) -> tuple[bool, str, Path | None, Path]:
    """
    Returns (success, message, output_video_path_or_None, log_path).
    Raises TimeoutError if the render exceeds the configured limit.
    """
    settings = get_settings()
    pdir = project_dir(project_id)
    scene_path = scene_file_path(project_id)
    log_path = render_log_path(project_id)
    media_dir = pdir / "media"

    if not tool_available("manim"):
        raise RuntimeError("Manim is not installed or not on PATH.")
    if not tool_available("ffmpeg"):
        raise RuntimeError("FFmpeg is not installed or not on PATH.")

    width, height = (resolution.split("x") + ["1280", "720"])[:2]

    # Manim's CLI does not accept a `--background_color` render flag on
    # current versions (it errors with "No such option"). The supported,
    # version-stable way to set it is a local manim.cfg picked up
    # automatically from the working directory we already run in.
    (pdir / "manim.cfg").write_text(
        f"[CLI]\nbackground_color = {background_color}\n", encoding="utf-8"
    )

    # Fixed, whitelisted argv — nothing user-controlled is inserted as raw text
    # other than validated enum-like values already constrained by our schemas.
    args = [
        "manim",
        "render",
        str(scene_path),
        scene_class_name,
        "--media_dir", str(media_dir),
        "--resolution", f"{width},{height}",
        "--fps", str(int(fps)),
        "--format", "mp4",
        "--renderer", "opengl" if renderer == "opengl" else "cairo",
        "-o", "output.mp4",
        # Always disabled: each render is a one-shot run of freshly generated
        # code (never re-run on unchanged source), so Manim's partial-movie-file
        # cache has nothing to reuse and only adds overhead - worse, on scenes
        # with many sub-mobjects (common for 3D) it prints a "lot of
        # sub-mobjects" warning and measurably slows things down while it
        # scans for cache hits it will never find.
        "--disable_caching",
    ]

    with open(log_path, "w", encoding="utf-8") as log_file:
        process = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=str(pdir),
        )
        _active_renders[project_id] = RenderHandle(process=process, log_path=log_path, started_at=time.time())

        try:
            await asyncio.wait_for(
                _read_stream_to_file(process.stdout, log_file),
                timeout=settings.max_render_seconds,
            )
            returncode = await asyncio.wait_for(process.wait(), timeout=10)
        except asyncio.TimeoutError:
            process.kill()
            _active_renders.pop(project_id, None)
            raise TimeoutError(
                f"Render exceeded the {settings.max_render_seconds}s safety limit and was stopped."
            )

    _active_renders.pop(project_id, None)

    if returncode != 0:
        return False, "Manim render failed. See logs.", None, log_path

    # Find the produced mp4 under media_dir
    candidates = list(media_dir.rglob("output.mp4"))
    if not candidates:
        candidates = list(media_dir.rglob("*.mp4"))
    output_path = candidates[0] if candidates else None
    if output_path is None:
        return False, "Render finished but no output file was found.", None, log_path

    return True, "Render completed successfully.", output_path, log_path


def cancel_render(project_id: str) -> bool:
    handle = _active_renders.get(project_id)
    if not handle:
        return False
    try:
        handle.process.terminate()
    except ProcessLookupError:
        pass
    _active_renders.pop(project_id, None)
    return True


def is_rendering(project_id: str) -> bool:
    return project_id in _active_renders
