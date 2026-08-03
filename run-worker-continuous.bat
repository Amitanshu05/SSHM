@echo off
title Smart Storage Python Worker - Continuous
cd /d "D:\Smart Storage Health Monitor\engine"
echo Activating Python virtual environment...
call venv\Scripts\activate.bat
echo Starting Python worker every 5 minutes with AI prediction after each poll...
python storage_health_worker.py --interval 300
pause
