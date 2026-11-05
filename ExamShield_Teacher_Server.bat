@echo off
chcp 65001 >nul
title ExamShield LAN - Host Control Center
echo ===================================================
echo   ExamShield LAN 🛡️ - Host Server Starting...
echo ===================================================
echo.
cd /d "%~dp0\teacher-server-app"

:: Open standalone Application Window after 2 seconds
start "" cmd /c "timeout /t 2 /nobreak >nul && (if exist \"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe\" (start \"\" \"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe\" --app=http://localhost:3000/admin --start-maximized) else if exist \"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe\" (start \"\" \"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe\" --app=http://localhost:3000/admin --start-maximized) else if exist \"%ProgramFiles%\Google\Chrome\Application\chrome.exe\" (start \"\" \"%ProgramFiles%\Google\Chrome\Application\chrome.exe\" --app=http://localhost:3000/admin --start-maximized) else if exist \"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe\" (start \"\" \"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe\" --app=http://localhost:3000/admin --start-maximized) else (start http://localhost:3000/admin))"

:: Start Node Host Server (use portable node if present)
if exist "%~dp0runtime\node.exe" (
    "%~dp0runtime\node.exe" src/server.js
) else (
    node src/server.js
)
pause
