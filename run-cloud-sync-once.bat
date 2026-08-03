@echo off
title Smart Storage Cloud Sync - Once
cd /d "D:\Smart Storage Health Monitor\engine"

if "%CLOUD_API_BASE_URL%"=="" if "%CLOUD_INGEST_URL%"=="" (
    echo Set CLOUD_API_BASE_URL or CLOUD_INGEST_URL before running this script.
    echo Example:
    echo   set CLOUD_API_BASE_URL=https://your-render-app.onrender.com/api
    echo   set CLOUD_INGEST_TOKEN=your-shared-secret
    pause
    exit /b 1
)

echo Activating Python virtual environment...
call venv\Scripts\activate.bat
echo Running AI analysis and pushing latest snapshot to cloud...
python storage_ai_analyzer.py --json --sync-cloud
pause
