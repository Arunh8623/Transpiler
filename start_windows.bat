@echo off
setlocal enabledelayedexpansion

echo ================================================
echo   Transpiler - Local Setup ^& Start (Windows)
echo ================================================

set "ROOT=%~dp0"

REM --- Virtual environment lives OUTSIDE this project folder on purpose. ---
REM     If this project sits inside a OneDrive/Dropbox/Google Drive synced
REM     folder (as this one does, under OneDrive\Documents\...), the cloud
REM     sync client can turn some of the hundreds of small files pip writes
REM     into .venv\Lib\site-packages into unsynced placeholders, or race
REM     with pip while it's still writing them. The classic symptom is
REM     exactly what shows up here: pip reports "Successfully installed
REM     fastapi..." and then a fresh terminal still gets
REM     "ModuleNotFoundError: No module named 'fastapi'". Keeping the venv
REM     in a fixed local, non-synced folder avoids this entirely.
REM     Override VENV_DIR below if you want a different location.
set "VENV_DIR=%LOCALAPPDATA%\TranspilerApp\venv-backend"

echo Backend virtual environment location (outside any cloud-synced folder):
echo   %VENV_DIR%
echo.

REM --- Locate a real Python interpreter via the "py" launcher first.
REM     "py" talks directly to the official launcher registry and skips the
REM     Microsoft Store "python.exe" alias stub that silently no-ops.
REM     Prefer 3.12/3.11/3.10 - the Manim dependency chain (pycairo, scipy,
REM     mapbox_earcut) has the most reliable prebuilt Windows wheels on
REM     these versions. Newer versions (e.g. 3.13) can force pip to compile
REM     from source, which fails without Microsoft C++ Build Tools installed.
REM     Set PY_VERSION_OVERRIDE below if you want to force a specific one.
set "PY_VERSION_OVERRIDE="
set "PYCMD="

if defined PY_VERSION_OVERRIDE (
    py -%PY_VERSION_OVERRIDE% --version >nul 2>&1
    if not errorlevel 1 set "PYCMD=py -%PY_VERSION_OVERRIDE%"
)

if not defined PYCMD (
    for %%V in (3.12 3.11 3.10 3.13) do (
        if not defined PYCMD (
            py -%%V --version >nul 2>&1
            if not errorlevel 1 set "PYCMD=py -%%V"
        )
    )
)

if not defined PYCMD (
    py -3 --version >nul 2>&1
    if not errorlevel 1 set "PYCMD=py -3"
)

if not defined PYCMD (
    python --version >nul 2>&1
    if not errorlevel 1 (
        python -c "import sys" >nul 2>&1
        if not errorlevel 1 set "PYCMD=python"
    )
)

if not defined PYCMD (
    echo [ERROR] No working Python interpreter found.
    echo         Install Python 3.11 or 3.12 from https://www.python.org/downloads/
    echo         and check "Add python.exe to PATH" during install, then reopen this terminal.
    echo         If you already have Python installed, the "py" launcher wasn't found either -
    echo         re-run the installer and enable "Install py launcher" under Optional Features.
    echo         Also check Windows Settings ^> Apps ^> Advanced app settings ^> App execution
    echo         aliases and disable "python.exe"/"python3.exe" if checked - that shadows the
    echo         real interpreter with a Microsoft Store stub that does nothing when called.
    pause
    exit /b 1
)
echo Using Python: %PYCMD%
for /f "tokens=*" %%I in ('%PYCMD% --version') do echo   ^(%%I^)
if "%PYCMD%"=="py -3.13" (
    echo [WARN] Using Python 3.13. If "pip install -r requirements.txt" fails while
    echo        building pycairo/scipy from source, install Python 3.11 or 3.12 instead
    echo        and delete "%VENV_DIR%", or set PY_VERSION_OVERRIDE=3.11 near the top
    echo        of this script and re-run it.
)

REM --- Quick local tool check (informational only, does not block startup) ---
where manim  >nul 2>&1 || echo [WARN] "manim" not found on PATH yet - fine if you install it via pip below.
where ffmpeg >nul 2>&1 || echo [WARN] "ffmpeg" not found on PATH - install it and add its folder to PATH.
where pdflatex >nul 2>&1 || echo [WARN] "pdflatex" not found on PATH - install MiKTeX or TeX Live.

if not exist "%VENV_DIR%\Scripts\activate.bat" (
    echo Creating Python virtual environment with: %PYCMD% ...
    if not exist "%LOCALAPPDATA%\TranspilerApp" mkdir "%LOCALAPPDATA%\TranspilerApp"
    %PYCMD% -m venv "%VENV_DIR%"
)

if not exist "%VENV_DIR%\Scripts\activate.bat" (
    echo [ERROR] Virtual environment creation failed: activate.bat was not created at
    echo         %VENV_DIR%
    echo         Try running this manually to see the real error:
    echo             %PYCMD% -m venv "%VENV_DIR%"
    pause
    exit /b 1
)

cd /d "%ROOT%backend"
call "%VENV_DIR%\Scripts\activate.bat"

echo Installing backend core dependencies (required for the app to run at all)...
python -m pip install --upgrade pip >nul
pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Core dependency install failed - scroll up for the underlying error.
    echo         This core set has no compiled/C dependencies ^(fastapi, uvicorn, sqlmodel, etc.^),
    echo         so a failure here is usually a network or pip issue, not a build-tools issue.
    echo         Fix it and re-run this script.
    pause
    exit /b 1
)

echo.
echo Verifying fastapi actually imports before continuing...
python -c "import fastapi" 2>nul
if errorlevel 1 (
    echo [ERROR] pip said fastapi installed, but "python -c \"import fastapi\"" still fails.
    echo         This is the exact symptom of a cloud-sync ^(OneDrive/Dropbox^) folder
    echo         interfering with the venv. Since this venv now lives at:
    echo             %VENV_DIR%
    echo         ^(deliberately outside any synced folder^), if you STILL see this, try:
    echo           1. Delete "%VENV_DIR%" entirely and re-run this script.
    echo           2. Temporarily pause OneDrive sync ^(right-click the OneDrive tray icon^)
    echo              while this script runs, in case OneDrive is also intercepting pip's
    echo              temp/download folders.
    pause
    exit /b 1
)
echo   OK - fastapi imports correctly.

echo.
echo Installing rendering engine (Manim + numpy) - this has compiled dependencies
echo and can take several minutes, or fail if you don't have a C/C++ compiler.
pip install -r requirements-render.txt
if errorlevel 1 (
    echo.
    echo [WARN] Manim/render dependency install failed. The app will still start,
    echo        but rendering will not work until this is fixed.
    echo        This is almost always missing "Microsoft C++ Build Tools":
    echo        https://visualstudio.microsoft.com/visual-cpp-build-tools/
    echo        Install that ^(select "Desktop development with C++"^), then run:
    echo            call "%VENV_DIR%\Scripts\activate.bat"
    echo            pip install -r "%ROOT%backend\requirements-render.txt"
    echo        Continuing to start the app now...
)

if not exist ".env" (
    echo Creating backend\.env from .env.example ...
    copy /y ".env.example" ".env" >nul
)

cd /d "%ROOT%frontend"

if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed - scroll up for the underlying error.
        pause
        exit /b 1
    )
)

echo.
echo Starting backend  (FastAPI  on http://127.0.0.1:8000) ...
start "Transpiler Backend" cmd /k "cd /d "%ROOT%backend" && call "%VENV_DIR%\Scripts\activate.bat" && python -m app.main"

echo Starting frontend (Vite dev on http://127.0.0.1:5173) ...
start "Transpiler Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

echo.
echo Both servers are launching in separate windows.
echo   - Wait until the "Transpiler Backend" window shows "Uvicorn running on http://127.0.0.1:8000"
echo   - Then open http://localhost:5173 (or whichever port Vite printed) in your browser.
echo.
echo If the Dashboard still shows tools as "Not detected", check the Transpiler Backend
echo window FIRST - if it shows an error and never says "Uvicorn running...", the
echo frontend has nothing to talk to and every check will read as not detected,
echo even if Manim/FFmpeg/LaTeX/your API key are genuinely fine.
endlocal
