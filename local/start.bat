@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title NHI Risk Report

set "BUN=%USERPROFILE%\.bun\bin\bun.exe"

REM ----- First-time install Bun -----
if not exist "%BUN%" (
  echo Installing Bun (one-time, ~10MB^)...
  echo.
  powershell -ExecutionPolicy Bypass -NoProfile -Command "irm bun.sh/install.ps1 | iex"
  if not exist "%BUN%" (
    echo.
    echo [ERROR] Bun install failed.
    echo Manual install: open PowerShell and run:
    echo     irm bun.sh/install.ps1 ^| iex
    echo Then double-click this file again.
    echo.
    pause
    exit /b 1
  )
  echo.
  echo [OK] Bun installed.
  echo.
)

REM ----- Open browser -----
set "URL=http://localhost:7777"
set "C1=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "C2=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
set "C3=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if exist "%C1%" (
  start "" "%C1%" %URL%
) else if exist "%C2%" (
  start "" "%C2%" %URL%
) else if exist "%C3%" (
  start "" "%C3%" %URL%
) else (
  start "" %URL%
)

echo ===============================================
echo   NHI Risk Report
echo   Open: http://localhost:7777
echo   Close this window to stop the server.
echo ===============================================
echo.

REM ----- Run Bun proxy in foreground -----
"%BUN%" proxy.ts

echo.
echo Server stopped.
pause
