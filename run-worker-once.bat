@echo off
title Smart Storage Python Worker - Once
cd /d "D:\Smart Storage Health Monitor\engine"
echo Activating Python virtual environment...
call venv\Scripts\activate.bat
echo Running Python worker once...
python storage_health_worker.py --once
pause