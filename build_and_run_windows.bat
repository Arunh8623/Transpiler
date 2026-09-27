@echo off
setlocal enabledelayedexpansion

echo ================================================
echo   Transpiler - Local Production Build (Windows)
echo ================================================

set "ROOT=%~dp0"
REM Same reasoning as start_windows.bat: keep the venv out of any
REM cloud-synced (OneDrive/Dropbox) folder to avoid partially-synced
REM site-packages causing ModuleNotFoundError after a successful install.
set "VENV_DIR=%LOCALAPPDATA%\TranspilerApp\venv-backend"

set "PYCMD="
for %%V in (3.12 3.11 3.10 3.13) do (
    if not defined PYCMD (
        py -%%V --version >nul 2>&1
        if not errorlevel 1 set "PYCMD=py -%%V"
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
    echo [ERROR] No working Python interpreter found. See start_windows.bat for details.
    pause
    exit /b 1
)
echo Using Python: %PYCMD%

cd /d "%ROOT%frontend"
if not exist "node_modules" (
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)
echo Building frontend...
call npm run build
if errorlevel 1 (
    echo [ERROR] Frontend build failed - scroll up for the error.
    pause
    exit /b 1
)

if not exist "%VENV_DIR%\Scripts\activate.bat" (
    if not exist "%LOCALAPPDATA%\TranspilerApp" mkdir "%LOCALAPPDATA%\TranspilerApp"
    %PYCMD% -m venv "%VENV_DIR%"
)
if not exist "%VENV_DIR%\Scripts\activate.bat" (
    echo [ERROR] Virtual environment creation failed at %VENV_DIR%
    pause
    exit /b 1
)

cd /d "%ROOT%backend"
call "%VENV_DIR%\Scripts\activate.bat"

echo Installing backend core dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Core dependency install failed - scroll up for the error.
    pause
    exit /b 1
)

python -c "import fastapi" 2>nul
if errorlevel 1 (
    echo [ERROR] fastapi installed but won't import - delete "%VENV_DIR%" and re-run.
    pause
    exit /b 1
)

echo Installing rendering engine (Manim + numpy)...
pip install -r requirements-render.txt
if errorlevel 1 (
    echo [WARN] Manim/render install failed - app will start but rendering won't work.
    echo        See README.md for the Microsoft C++ Build Tools fix.
)

if not exist ".env" copy /y ".env.example" ".env" >nul

echo.
echo Starting Transpiler at http://127.0.0.1:8000 ...
python -m app.main

endlocal
