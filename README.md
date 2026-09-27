# Transpiler — AI Mathematical Animation Studio

Transpiler turns a natural-language math prompt into a locally rendered,
3Blue1Brown-inspired Manim animation. Gemini is used **only** to draft the
scene plan, Manim code, and notes; everything else — validation, rendering,
storage — happens entirely on your own Windows PC.

- No cloud render server. No video uploads. No telemetry by default.
- Generated code is statically validated (AST whitelist) before it is ever
  executed, and is only ever run via a fixed, non-shell subprocess call.
- All projects, code, notes, and videos live in a local SQLite database and
  local project folders.

## Architecture

```
transpiler/
  backend/     FastAPI + SQLModel + Gemini service + Manim runner
  frontend/    React + TypeScript + Vite + Tailwind + shadcn-style UI + R3F
```

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Framer Motion,
  React Three Fiber, TanStack Query, React Hook Form + Zod.
- **Backend**: FastAPI, SQLModel (SQLite), google-genai SDK, AST-based code
  validator, safe Manim subprocess runner.
- **Rendering**: your local Manim Community Edition + FFmpeg + LaTeX install.

## Prerequisites (Windows)

1. **Python 3.11 or 3.12** — https://www.python.org/downloads/ (check "Add to PATH" and
   "Install py launcher"). Newer versions like 3.13 often work, but Manim's C-extension
   dependencies (pycairo, scipy) tend to get prebuilt Windows wheels later than the rest
   of the ecosystem — 3.11/3.12 currently have the smoothest install.
2. **Node.js 18+** — https://nodejs.org/
3. **FFmpeg** — https://ffmpeg.org/download.html (add `ffmpeg.exe` folder to PATH)
4. **A LaTeX distribution** — MiKTeX (https://miktex.org/) is the easiest on Windows
5. **Manim Community Edition** — installed automatically via
   `backend/requirements-render.txt` (kept separate from the core backend
   requirements, see "Two-stage dependency install" below).
6. A free **Gemini API key** from https://aistudio.google.com/apikey

## Two-stage dependency install

`backend/requirements.txt` is deliberately minimal — just FastAPI/SQLModel/
Gemini SDK, none of which have compiled dependencies. The backend can boot
and you can browse the UI, manage the Gemini key, and create projects with
just this installed.

`backend/requirements-render.txt` holds Manim + numpy, which pull in
compiled dependencies (notably `pycairo`). If this install fails — most
commonly because **Microsoft C++ Build Tools** isn't installed — the app
still starts, but any render will fail until you fix it:

1. Install Build Tools: https://visualstudio.microsoft.com/visual-cpp-build-tools/
   (select "Desktop development with C++").
2. Then run:
   ```bat
   cd backend
   .venv\Scripts\activate.bat
   pip install -r requirements-render.txt
   ```

`start_windows.bat` and `build_and_run_windows.bat` both install these in
that order automatically and only hard-fail on the core set.


## Quick start (development mode)

```bat
cd transpiler
start_windows.bat
```

This will:
1. Create a Python virtual environment in `backend/.venv` and install
   backend dependencies.
2. Copy `backend/.env.example` to `backend/.env` if missing.
3. Install frontend dependencies (`npm install`).
4. Launch the FastAPI backend on `http://127.0.0.1:8000` and the Vite dev
   server on `http://127.0.0.1:5173` in separate windows.

Open **http://localhost:5173**, go to **Settings**, and paste in your Gemini
API key. The Dashboard's "Local system readiness" panel will show you
whether Manim / FFmpeg / LaTeX are detected on your PATH.

## Local production mode (single server, no Vite)

```bat
build_and_run_windows.bat
```

This builds the React app to `frontend/dist` and starts FastAPI, which
serves the built frontend directly from `http://127.0.0.1:8000` and opens
your browser automatically. This is also the mode that a future Tauri
package will wrap.

## Desktop app shell (Tauri) — scoped, needs a local build/verify pass

`frontend/src-tauri/` has a working Tauri v2 scaffold that gives you a real
native window instead of a browser tab, for a machine that has **already**
run `start_windows.bat` successfully at least once. It deliberately does
**not** bundle Python/Manim/FFmpeg/LaTeX into a self-contained installer —
this app needs those installed locally either way, so that's a separate,
larger effort than "put a native window on it," not something skipped by
accident. I also can't compile Rust in the environment I built this in
(no Rust toolchain, no network to fetch crates), so this needs a real
build/verify pass on your machine before you rely on it.

**One-time prerequisites**, in addition to everything above:
1. Rust via rustup: https://www.rust-lang.org/tools/install (choose the
   MSVC toolchain when prompted on Windows).
2. Microsoft Edge WebView2 Runtime — usually already present on Windows
   10/11; installer here if not: https://developer.microsoft.com/microsoft-edge/webview2/

**Setup:**
```bat
cd frontend
npm install
copy src-tauri\backend-config.example.json src-tauri\backend-config.json
```
Edit `src-tauri\backend-config.json` and set `backend_dir` to the absolute
path of your project's `backend` folder (e.g.
`C:\\Dev\\transpiler\\backend`).

**Run it:**
```bat
npm run tauri:dev
```
This builds the frontend once and opens a native window. The window
always loads `http://127.0.0.1:8000` (the same address `build_and_run_windows.bat`
serves) — `main.rs` spawns that backend for you using the venv at
`%LOCALAPPDATA%\TranspilerApp\venv-backend`, the same one `start_windows.bat`
creates. There's no hot-reload here by design (the window loads the built
app, not Vite) — for iterating on the frontend, keep using the regular
browser-based dev workflow above; use the Tauri shell once you're testing
a build.

**Package an installer:**
```bat
npm run tauri:build
```
Produces an NSIS installer under `frontend/src-tauri/target/release/bundle/nsis/`.
Remember: whoever runs this installer still needs Python/Manim/FFmpeg/LaTeX
set up and `backend-config.json` placed next to the installed `.exe`
pointing at wherever they keep the `backend` folder — this is a shell
around the existing local setup, not yet a zero-dependency installer.

## Safety model

- AI-generated Python is **never** run with `eval`/`exec`. It is written to
  an isolated per-project directory and executed only via a fixed
  `manim render <file> <SceneClass> --flags...` subprocess call — the
  prompt and code text are never interpolated into a shell string.
- An AST validator whitelists imports (`manim`, `numpy`, `math`, etc.) and
  blocks `os`, `subprocess`, `shutil`, `socket`, `requests`, `urllib`,
  filesystem writes, `eval`, `exec`, `compile`, `open`, `__import__`,
  `multiprocessing`, and dunder-attribute access.
- Renders are timeout-bounded (`MAX_RENDER_SECONDS` in `.env`) and a
  **Cancel Render** endpoint terminates only the process Transpiler itself
  started for that project.
- If a render fails, you can trigger **Repair with AI**, which sends only
  the prompt, settings, current code, and the Manim error output back to
  Gemini for a fix — a new versioned Generation is stored so you can
  compare or roll back.

## A note on OneDrive / Dropbox / Google Drive

If this project folder lives inside a cloud-synced folder (e.g.
`OneDrive\Documents\...`), be aware that Python virtual environments and
`node_modules` are hundreds to thousands of small files, and cloud sync
clients can intermittently fail to fully sync them or replace them with
placeholder stubs. The classic symptom is pip reporting `Successfully
installed fastapi...` and then a fresh terminal getting
`ModuleNotFoundError: No module named 'fastapi'` moments later, with no
code change in between.

To avoid this, `start_windows.bat` and `build_and_run_windows.bat` create
the backend's Python virtual environment at a **fixed local path outside
any synced folder**:

```
%LOCALAPPDATA%\TranspilerApp\venv-backend
```

`frontend/node_modules` still lives inside the project folder (Node's
module resolution expects this), so if you hit unexplained frontend
issues too, the most reliable fix is moving the whole project outside
OneDrive/Dropbox entirely — e.g. to `C:\Dev\transpiler` — or excluding
`frontend/node_modules` from sync via OneDrive's folder settings.

## Environment variables (`backend/.env`)

See `backend/.env.example`. Key ones:

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Your Gemini key (set via Settings UI or this file) |
| `GEMINI_MODEL` | Defaults to `gemini-2.0-flash` |
| `MAX_RENDER_SECONDS` | Hard timeout per render |
| `OUTPUT_DIR` | Where per-project code/media is written |

## Swapping AI providers later

`backend/app/services/ai_provider.py` defines an `AIProvider` interface
with `generate()` and `repair()`. `GeminiProvider` is the only
implementation today; to add a local Ollama-backed provider, implement
the same interface and change `get_ai_provider()`.

## Project status & phased roadmap

This repository is a solid, functional foundation: full data model, safe
render pipeline, Gemini integration, and all five core pages wired to real
endpoints (nothing here is mocked once you add your API key and local
tools). See **ROADMAP.md** for the suggested next phases (richer 3D
templates, WebSocket live progress, Tauri packaging, polish pass).
