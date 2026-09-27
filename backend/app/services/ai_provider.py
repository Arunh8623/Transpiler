"""
Provider-agnostic interface for prompt -> {code, notes, plan} generation.

Today only GeminiProvider is implemented, but AIProvider is the seam
that lets us later add e.g. an OllamaProvider (fully local model) or a
paid-tier provider without touching any router or business logic.
"""
from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from typing import Any

from app.config import get_settings
from app.models import Mode, Role
from app.schemas import GeminiGenerationResult, SceneStep

SYSTEM_PROMPT_TEMPLATE = """You are an expert mathematics educator and Manim Community Edition
(v0.18+) developer. You generate ONLY valid, self-contained Manim Python code that:

- Defines exactly ONE Scene subclass named `GeneratedScene` (use ThreeDScene as the base
  class for any 3D content, Scene otherwise).
- Imports ONLY from: manim, numpy, math, cmath, random, itertools, functools, colour,
  dataclasses, typing, fractions, decimal. NEVER import os, sys, subprocess, shutil,
  socket, requests, urllib, pathlib, io, or any filesystem/network module.
- NEVER calls eval, exec, compile, open, __import__, or touches dunder attributes.
- NEVER reads or writes files and NEVER makes network calls.
- Keeps every object comfortably inside the visible frame at all times.
- Uses clear, readable MathTex/Tex labels and sensible colors from Manim's palette.
- Targets a total scene runtime close to {duration} seconds (do not wildly exceed it).
- Is written to be pedagogically clear and visually elegant, in the spirit of
  3Blue1Brown-style explainer animations: deliberate pacing, one idea at a time,
  smooth transforms, and camera moves that support (not distract from) the math.
- Is written to run reliably on Windows with a local Manim + FFmpeg + LaTeX install.

Audience: {audience_description}
Creation mode: {mode_description}

Respond ONLY with a single JSON object (no markdown fences, no prose outside the JSON)
matching exactly this schema:
{{
  "title": string,
  "scene_plan": [{{"beat": string, "description": string, "duration_estimate": number}}, ...],
  "manim_code": string,   // full, runnable Python source, escaped for JSON
  "notes_markdown": string,   // lesson notes in Markdown, matched to the audience
  "tags": [string, ...],
  "estimated_duration": number
}}
"""

AUDIENCE_DESCRIPTIONS: dict[Role, str] = {
    Role.high_school_student: (
        "High school student. Use simple intuition, minimal formal notation, everyday "
        "analogies, and gentle pacing. Avoid heavy proofs."
    ),
    Role.college_student: (
        "College student. Use standard undergraduate notation, brief derivations, and a "
        "moderate pace suitable for a first exposure to the topic."
    ),
    Role.high_school_teacher: (
        "High school teacher preparing classroom material. Favor clarity, one concept per "
        "beat, and notes that double as lecture talking points."
    ),
    Role.college_professor: (
        "College professor. Use formal notation, precise derivations, and more advanced "
        "visualizations. Notes may include deeper theoretical remarks."
    ),
    Role.general_learner: (
        "Curious general learner with no formal math background beyond basic algebra. "
        "Prioritize visual intuition over symbolism."
    ),
}

MODE_DESCRIPTIONS: dict[Mode, str] = {
    Mode.explain_concept: "Explain a mathematical concept visually, beat by beat.",
    Mode.graph_2d: "Draw and animate a 2D graph, curve, transform, or vector scene.",
    Mode.model_3d: "Create a 3D mathematical model with clear camera work (orbit/rotate/etc).",
    Mode.solve_doubt: "Answer a specific student question with a short, focused visual explanation.",
    Mode.teacher_lesson: "Generate a multi-scene lesson: title, objectives, then the animation.",
}


class AIProvider(ABC):
    @abstractmethod
    async def generate(
        self,
        *,
        prompt: str,
        mode: Mode,
        audience: Role,
        duration_target: int,
        camera_style: str | None = None,
    ) -> GeminiGenerationResult: ...

    @abstractmethod
    async def repair(
        self,
        *,
        prompt: str,
        mode: Mode,
        audience: Role,
        current_code: str,
        error_output: str,
    ) -> GeminiGenerationResult: ...


class ProviderError(RuntimeError):
    """Raised for quota exhaustion, invalid key, or malformed provider responses."""


def _extract_json(text: str) -> dict[str, Any]:
    """Gemini is instructed to return raw JSON, but we defensively strip
    markdown fences if the model adds them anyway."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(json)?", "", cleaned.strip())
    cleaned = re.sub(r"```$", "", cleaned.strip())
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        # Try to salvage the largest {...} block
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
        raise ProviderError(f"Could not parse AI response as JSON: {e}") from e


def _build_system_prompt(
    mode: Mode,
    audience: Role,
    duration_target: int,
    *,
    prompt_text: str = "",
    camera_style: str | None = None,
) -> str:
    base = SYSTEM_PROMPT_TEMPLATE.format(
        duration=duration_target,
        audience_description=AUDIENCE_DESCRIPTIONS[audience],
        mode_description=MODE_DESCRIPTIONS[mode],
    )

    extras: list[str] = []

    if mode == Mode.model_3d:
        # Phase 1: bias generation toward hand-verified 3D patterns instead
        # of leaving Manim's 3D API surface entirely to the model's memory,
        # which is where most "renders forever" / API-mismatch failures for
        # 3D scenes come from.
        from app.services.manim_templates import camera_style_snippet, match_templates

        style_refs = match_templates(prompt_text)
        if style_refs:
            joined = "\n---\n".join(style_refs)
            extras.append(
                "Here are verified Manim patterns for similar 3D topics. Do not copy them "
                "verbatim - adapt the relevant API calls (Surface, ThreeDAxes, "
                "set_camera_orientation, Arrow3D, ParametricFunction) to this specific "
                f"request:\n{joined}"
            )
        cam_snippet = camera_style_snippet(camera_style)
        if cam_snippet:
            extras.append(f"For the requested camera style, use this pattern: {cam_snippet}")

    if mode == Mode.teacher_lesson:
        # Phase 3 (scoped): the safety validator only ever allows a single
        # Scene subclass per render, so a true multi-file lesson pack is a
        # larger architectural change (see ROADMAP.md Phase 3). For now,
        # structure the ONE scene as a clear multi-beat lesson instead.
        extras.append(
            "This is for a teacher lesson. Structure the single scene as clearly labeled "
            "beats: a title/objective card first, then one visual idea per beat with a short "
            "on-screen label for each, ending with a brief recap. Write notes_markdown as "
            "lesson notes: Objectives, then a numbered walkthrough matching the beats, then "
            "a couple of discussion/practice questions."
        )

    if extras:
        return base + "\n\n" + "\n\n".join(extras)
    return base


def _parse_result(raw_text: str) -> GeminiGenerationResult:
    data = _extract_json(raw_text)
    try:
        steps = [SceneStep(**s) for s in data.get("scene_plan", [])]
        return GeminiGenerationResult(
            title=data["title"],
            scene_plan=steps,
            manim_code=data["manim_code"],
            notes_markdown=data.get("notes_markdown", ""),
            tags=data.get("tags", []),
            estimated_duration=float(data.get("estimated_duration", 0)),
        )
    except KeyError as e:
        raise ProviderError(f"AI response missing required field: {e}") from e


class GeminiProvider(AIProvider):
    def __init__(self) -> None:
        settings = get_settings()
        if not settings.gemini_api_key:
            self._client = None
        else:
            # Imported lazily so the app can boot even before a key is configured.
            from google import genai  # official Google Gen AI SDK

            self._client = genai.Client(api_key=settings.gemini_api_key)
        self._model = settings.gemini_model

    def _require_client(self):
        if self._client is None:
            raise ProviderError(
                "GEMINI_API_KEY is not configured. Add it in Settings before generating."
            )
        return self._client

    async def generate(
        self,
        *,
        prompt: str,
        mode: Mode,
        audience: Role,
        duration_target: int,
        camera_style: str | None = None,
    ) -> GeminiGenerationResult:
        client = self._require_client()
        system_prompt = _build_system_prompt(
            mode, audience, duration_target, prompt_text=prompt, camera_style=camera_style
        )
        user_prompt = prompt
        if camera_style:
            user_prompt += f"\n\nPreferred 3D camera style: {camera_style}."

        try:
            response = client.models.generate_content(
                model=self._model,
                contents=[{"role": "user", "parts": [{"text": user_prompt}]}],
                config={
                    "system_instruction": system_prompt,
                    "response_mime_type": "application/json",
                },
            )
        except Exception as e:  # SDK raises provider-specific exceptions
            raise _translate_gemini_error(e) from e

        return _parse_result(response.text)

    async def repair(
        self,
        *,
        prompt: str,
        mode: Mode,
        audience: Role,
        current_code: str,
        error_output: str,
    ) -> GeminiGenerationResult:
        client = self._require_client()
        system_prompt = _build_system_prompt(mode, audience, duration_target=45, prompt_text=prompt)
        repair_prompt = (
            "The following Manim code failed to render. Fix it and return the SAME JSON "
            "schema as before, with corrected `manim_code` and updated `notes_markdown` "
            "that briefly explains what changed at the top as a Markdown note.\n\n"
            f"Original request: {prompt}\n\n"
            f"Current code:\n```python\n{current_code}\n```\n\n"
            f"Render error output:\n```\n{error_output}\n```"
        )
        try:
            response = client.models.generate_content(
                model=self._model,
                contents=[{"role": "user", "parts": [{"text": repair_prompt}]}],
                config={
                    "system_instruction": system_prompt,
                    "response_mime_type": "application/json",
                },
            )
        except Exception as e:
            raise _translate_gemini_error(e) from e

        return _parse_result(response.text)


def _translate_gemini_error(e: Exception) -> ProviderError:
    msg = str(e).lower()
    if "quota" in msg or "resource_exhausted" in msg or "429" in msg:
        return ProviderError("Gemini free-tier quota exhausted. Try again later or upgrade your plan.")
    if "api key" in msg or "permission" in msg or "401" in msg or "403" in msg:
        return ProviderError("Gemini API key is invalid or missing permissions. Check Settings.")
    return ProviderError(f"Gemini request failed: {e}")


def get_ai_provider() -> AIProvider:
    """Factory — swap this out for OllamaProvider / another paid provider later."""
    return GeminiProvider()
