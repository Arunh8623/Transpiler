@echo off
echo ================================================
echo   Transpiler - Local Tool Check
echo ================================================
echo.

echo [Python]
where python 2>nul || echo   NOT on PATH
python --version 2>nul

echo.
echo [Node / npm]
where node 2>nul || echo   NOT on PATH
node --version 2>nul
npm --version 2>nul

echo.
echo [Manim]
where manim 2>nul || echo   NOT on PATH
manim --version 2>nul

echo.
echo [FFmpeg]
where ffmpeg 2>nul || echo   NOT on PATH
ffmpeg -version 2>nul | findstr /b "ffmpeg"

echo.
echo [LaTeX]
where pdflatex 2>nul || echo   NOT on PATH
pdflatex --version 2>nul | findstr /b "MiKTeX pdfTeX"

echo.
echo [Backend .env]
if exist "%~dp0backend\.env" (
    echo   backend\.env exists
    findstr /b "GEMINI_API_KEY" "%~dp0backend\.env"
    findstr /b "GEMINI_MODEL" "%~dp0backend\.env"
) else (
    echo   backend\.env does NOT exist yet - run start_windows.bat first, or copy .env.example to .env
)

echo.
echo [Backend venv packages]
set "VENV_DIR=%LOCALAPPDATA%\TranspilerApp\venv-backend"
echo   Location: %VENV_DIR%
if exist "%VENV_DIR%\Scripts\activate.bat" (
    call "%VENV_DIR%\Scripts\activate.bat"
    python -c "import fastapi; print('  fastapi', fastapi.__version__, '- OK')" 2>nul || echo   fastapi NOT importable - core install failed or was corrupted, app cannot start
    python -c "import manim; print('  manim', manim.__version__, '- OK')" 2>nul || echo   manim NOT importable - rendering will not work until requirements-render.txt installs successfully
) else (
    echo   venv does not exist yet - run start_windows.bat first
)

echo.
echo Done. Anything marked "NOT on PATH" above needs to be installed and added to
echo your PATH before Transpiler will detect it - this is independent of the app.
pause
