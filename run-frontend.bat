@echo off
title Smart Storage React Frontend
cd /d "D:\Smart Storage Health Monitor\frontend\sshm-dashboard"
echo Starting React dashboard on http://localhost:5173
if exist node_modules\.bin\vite.cmd (
    call node_modules\.bin\vite.cmd --host 127.0.0.1 --port 5173
) else (
    npm run dev
)
pause
