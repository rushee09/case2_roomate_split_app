@echo off
cd /d "%~dp0"
echo Starting Pocket FastAPI backend on http://localhost:8000
uvicorn main:app --reload --port 8000
