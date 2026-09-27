from __future__ import annotations

import shutil
import subprocess

from app.config import gemini_key_configured
from app.schemas import SystemStatus


def _version(cmd: list[str]) -> str | None:
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        text = (out.stdout or out.stderr or "").strip().splitlines()
        return text[0] if text else None
    except Exception:
        return None


def get_system_status() -> SystemStatus:
    manim_path = shutil.which("manim")
    ffmpeg_path = shutil.which("ffmpeg")
    latex_path = shutil.which("latex") or shutil.which("pdflatex")

    return SystemStatus(
        gemini_key_configured=gemini_key_configured(),
        manim_installed=bool(manim_path),
        manim_version=_version(["manim", "--version"]) if manim_path else None,
        ffmpeg_installed=bool(ffmpeg_path),
        ffmpeg_version=_version(["ffmpeg", "-version"]) if ffmpeg_path else None,
        latex_installed=bool(latex_path),
        latex_version=_version([latex_path, "--version"]) if latex_path else None,
    )
