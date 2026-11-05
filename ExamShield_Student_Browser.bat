@echo off
chcp 65001 >nul
title ExamShield LAN - Student Examination Portal
echo ===================================================
echo   ExamShield LAN 🛡️ - Student Portal Launcher
echo ===================================================
echo.
set /p TEACHER_IP="Enter Teacher Host IP (press Enter for localhost:3000): "
if "%TEACHER_IP%"=="" set TEACHER_IP=localhost:3000

:: Remove any http:// prefix if entered
set "TEACHER_IP=%TEACHER_IP:http://=%"
set "TEACHER_IP=%TEACHER_IP:https://=%"

:: Auto append :3000 if not present
echo %TEACHER_IP% | findstr /C:":" >nul
if errorlevel 1 (
    set "TEACHER_IP=%TEACHER_IP%:3000"
)

echo.
echo 🚀 Opening Secure Application Window: http://%TEACHER_IP%
echo.

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="http://%TEACHER_IP%" --start-maximized
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="http://%TEACHER_IP%" --start-maximized
) else if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="http://%TEACHER_IP%" --start-maximized
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app="http://%TEACHER_IP%" --start-maximized
) else (
    start "" "http://%TEACHER_IP%"
)

timeout /t 2 /nobreak >nul
