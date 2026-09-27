# Transpiler — Phased Build Roadmap

## Phase 0 — Foundation (done)

Backend, data model, safety validator, safe subprocess runner, Gemini
integration, all five pages wired to real endpoints. See git history /
original handoff notes for the full list.

## Bugfix — blocking render + no live logs (done)

The original render endpoint ran the entire render *inside* the HTTP
request handler and only attached `logs_path` to the `Render` row after
everything finished — so the Render Logs tab showed "No render logs yet"
for the whole duration, and 3D/OpenGL renders (which take much longer)
looked indistinguishable from being stuck. Fixed by:
- `POST /render` now returns immediately; the actual render runs as a
  detached `asyncio` background task with its own DB session.
- The log file path is created and attached to the `Render` row
  *before* rendering starts, so the frontend can tail it live.
- Added `GET /render/{id}/progress`, which parses Manim's own tqdm-style
  progress-bar output for a rough live percent, shown in the stage
  tracker and Preview tab while a render is running.
- `manim.exe`'s current version rejects the `--background_color` CLI
  flag; background color is now set via a per-project `manim.cfg`
  instead (the version-stable way).
- A path-doubling bug (`…/projects/<id>/projects/<id>/scene.py`) from a
  relative `OUTPUT_DIR` in `.env` is fixed by always resolving to an
  absolute path once.

## Phase 1 — 3D template library (done, scoped)

Added `backend/app/services/manim_templates.py`: hand-verified reference
snippets (paraboloid, saddle, sphere, cone, cylinder, vector field,
gradient, contour) plus camera-style-to-API-call mappings. These are
injected into the Gemini system prompt as *style reference* (not
executed directly) whenever `mode == model_3d`, matched by keyword
against the prompt. This is the lighter-weight version of the original
Phase 1 plan — it biases generation toward known-good API usage rather
than shipping a full regression-tested template gallery. A good next
step if 3D generations are still inconsistent: add more keyword entries,
or a proper automated render-test suite over this library.

## Phase 2 — Live progress (done, scoped: polling, not SSE)

Implemented via the bugfix above: 1.5–2s polling of render status, a
live log tail, and a parsed percent-complete indicator. The original
Phase 2 plan called for a proper SSE/WebSocket stream — that's a cleaner
long-term architecture (push instead of poll) but polling at this
interval is already smooth in practice and required no new endpoint
types. Worth revisiting if you add many concurrent users on one machine
(unlikely for a local-first single-user app) or want frame-accurate
progress bars.

## Phase 3 — Teacher lesson generator (done, scoped down)

The safety validator intentionally only ever allows **one** `Scene`
subclass per render — that constraint isn't something to relax casually,
since it's core to the sandboxing story. So `teacher_lesson` mode is
implemented as a prompt refinement: the system prompt now instructs
Gemini to structure the single scene as clearly labeled beats (title/
objective card → one idea per beat with on-screen labels → recap) and to
write `notes_markdown` as Objectives + numbered walkthrough + discussion
questions.

**Not done**: true multi-scene rendering with FFmpeg concatenation into
one "lesson pack" video, and a dedicated lesson workspace view with
per-scene thumbnails. That's a genuinely bigger change — a `scenes: [...]`
column on `Generation`, a runner change to render N scenes and `ffmpeg -f
concat` them, and new UI. Say the word if you want this built next; it's
well-scoped, just bigger than the other items here.

## Phase 4 — History Library polish (done)

- Real thumbnails: after a successful render, a frame is grabbed via
  `ffmpeg -ss 1 -frames:v 1` and stored as `Render.thumbnail_path`,
  served at `GET /render/{id}/thumbnail` and shown on History Library
  cards (falls back to a "Preview available" placeholder for older
  renders that predate this, or if ffmpeg is unavailable at render time).
- Sort controls: newest, oldest, by mode, by status (client-side, since
  the dataset size for a local single-user app doesn't need a backend
  sort endpoint).

## Phase 5 — Packaging with Tauri (scaffolded, needs local build/verify)

`frontend/src-tauri/` now has a working Tauri v2 project: `main.rs` spawns
the backend (from the venv `start_windows.bat` creates) and the window
loads `http://127.0.0.1:8000`, same as local production mode. An "Open
output folder" button was added to Settings (via `tauri-plugin-shell`),
visible only when running inside the desktop shell. See the README's
"Desktop app shell (Tauri)" section for setup and `npm run tauri:dev` /
`npm run tauri:build`.

**What's genuinely not done, and why:** this was built without a Rust
toolchain or network access to fetch crates in the environment that
produced it, so it has not been through an actual `cargo build` — treat
it as a correct-on-paper scaffold that needs one verification pass on a
real Windows machine (missing crate versions, capability-permission
syntax drift between Tauri point releases, etc. are the likely first
snags). It also does not bundle Python/Manim/FFmpeg/LaTeX into a
self-contained installer — every machine running the packaged app still
needs the same local setup as the browser version, plus one manual
`backend-config.json` edit pointing at wherever the `backend` folder
lives. A true zero-dependency installer (bundling a Python runtime and
all render tooling) is a substantially larger effort and its own phase
if you want it later.

## Phase 6 — Optional future extensions (out of scope for v1)

- Cloud upload/sharing (opt-in only).
- Local Ollama provider implementing the same `AIProvider` interface.
- Paid-tier provider swap.
- Collaborative/team project libraries.
- True multi-scene lesson packs (see Phase 3 notes above).

---

Tell me which of the "not done" items to build next, or if any of the
scoped-down Phase 1–3 work needs to go further (e.g. the full SSE stream,
or true multi-scene lessons) — happy to build those out properly too.
