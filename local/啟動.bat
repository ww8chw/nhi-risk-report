@echo off
chcp 65001 >nul
cd /d "%~dp0"
title NHI Risk Report - 安安診所健檢報告

set "BUN=%USERPROFILE%\.bun\bin\bun.exe"

REM ============================================================
REM 第一次使用：自動安裝 Bun
REM ============================================================
if not exist "%BUN%" (
  echo ===============================================
  echo   First-time setup: Installing Bun (10MB^)
  echo ===============================================
  echo.
  powershell -ExecutionPolicy Bypass -NoProfile -Command "irm bun.sh/install.ps1 | iex"
  if not exist "%BUN%" (
    echo.
    echo [X] Bun install failed.
    echo     Please open PowerShell and run manually:
    echo         irm bun.sh/install.ps1 ^| iex
    echo     Then double-click this file again.
    echo.
    pause
    exit /b 1
  )
  echo.
  echo [OK] Bun installed
  echo.
)

REM ============================================================
REM 開啟瀏覽器（延遲 2 秒讓代理先啟動）
REM ============================================================
set "CHROME1=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "CHROME2=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
set "CHROME3=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if exist "%CHROME1%" (
  start "" cmd /c "timeout /t 2 /nobreak >nul & start """" ""%CHROME1%"" http://localhost:7777"
) else if exist "%CHROME2%" (
  start "" cmd /c "timeout /t 2 /nobreak >nul & start """" ""%CHROME2%"" http://localhost:7777"
) else if exist "%CHROME3%" (
  start "" cmd /c "timeout /t 2 /nobreak >nul & start """" ""%CHROME3%"" http://localhost:7777"
) else (
  start "" cmd /c "timeout /t 2 /nobreak >nul & start """" http://localhost:7777"
)

REM ============================================================
REM 前景跑 Bun proxy（關視窗即停止）
REM ============================================================
echo ===============================================
echo   安安診所 健檢風險評估報告
echo   Proxy: http://localhost:7777
echo   關閉本視窗即停止 / Close this window to stop
echo ===============================================
echo.

"%BUN%" proxy.ts

REM 若 bun 意外退出，留視窗讓使用者看訊息
echo.
echo Server stopped.
pause
