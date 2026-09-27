from __future__ import annotations

import webbrowser
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import BACKEND_ROOT, get_settings
from app.database import init_db
from app.routers import generation, projects, render, settings as settings_router, system

FRONTEND_DIST = BACKEND_ROOT.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Transpiler API", version="0.1.0", lifespan=lifespan)

# In dev, Vite runs on its own port (5173) and calls this API directly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(generation.router)
app.include_router(render.router)
app.include_router(settings_router.router)
app.include_router(system.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


# --- Local production mode: serve the built React app from the same origin ---
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")


def run() -> None:
    import uvicorn

    settings = get_settings()
    if FRONTEND_DIST.exists():
        webbrowser.open(f"http://{settings.host}:{settings.port}")
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=False)


if __name__ == "__main__":
    run()
