@echo off
title Smart Storage Health Monitor Launcher

echo Starting Smart Storage Health Monitor...

start "Smart Storage Backend" cmd /k "D:\Smart Storage Health Monitor\run-backend.bat"

timeout /t 8 /nobreak >nul

start "Smart Storage Python Worker" cmd /k "D:\Smart Storage Health Monitor\run-worker-continuous.bat"

timeout /t 3 /nobreak >nul

start "Smart Storage React Frontend" cmd /k "D:\Smart Storage Health Monitor\run-frontend.bat"

echo All services started.
echo Backend:  http://localhost:8081/api/metrics/dashboard-summary
echo AI API:   http://localhost:8081/api/analysis/latest
echo Frontend: http://localhost:5173
pause
