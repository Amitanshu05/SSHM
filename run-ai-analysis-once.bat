@echo off
title Smart Storage AI Analysis - Once
cd /d "D:\Smart Storage Health Monitor\engine"
echo Activating Python virtual environment...
call venv\Scripts\activate.bat
echo Running latest telemetry through Python AI/ML analyzer...
python storage_ai_analyzer.py --json
pause
