@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Python environment is missing. Follow README.md to install dependencies.
  exit /b 1
)
if not exist "dist\index.html" (
  echo Frontend build is missing. Run npm ci then npm run build.
  exit /b 1
)
echo Thinking Graph: http://127.0.0.1:8000
echo Local data: data\thinking-graph.sqlite
echo Press Ctrl+C to stop.
".venv\Scripts\python.exe" -m backend
