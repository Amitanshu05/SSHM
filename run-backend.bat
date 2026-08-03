@echo off
title Smart Storage Backend
cd /d "D:\Smart Storage Health Monitor\backend\storage-health-api"
echo Starting Spring Boot backend on http://localhost:8081
mvn spring-boot:run
pause
