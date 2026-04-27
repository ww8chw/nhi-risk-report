@echo off
REM 安安診所 · 健檢風險評估報告 — Windows 啟動腳本
REM 雙擊即執行：啟動本地代理 → 自動開瀏覽器

cd /d "%~dp0"
chcp 65001 >nul

where bun >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo ===============================================
  echo   首次使用 — 正在安裝 Bun
  echo ===============================================
  echo.
  powershell -c "irm bun.sh/install.ps1 | iex"
  setx PATH "%USERPROFILE%\.bun\bin;%PATH%" >nul
  set "PATH=%USERPROFILE%\.bun\bin;%PATH%"
  where bun >nul 2>&1
  if %ERRORLEVEL% NEQ 0 (
    echo.
    echo X Bun 安裝失敗。請手動執行 PowerShell：
    echo     irm bun.sh/install.ps1 ^| iex
    echo   完成後再雙擊本檔。
    pause
    exit /b 1
  )
  echo.
  echo OK Bun 安裝完成
  echo.
)

echo ===============================================
echo   安安診所 · 健檢風險評估報告
echo ===============================================
echo.
echo 正在啟動本地代理...

start /b cmd /c "bun proxy.ts"
timeout /t 2 /nobreak >nul

echo OK 代理運作中 (port 7777)
echo.
echo 正在開啟瀏覽器...
REM 優先用 Chrome 開
start "" "chrome.exe" "http://localhost:7777" 2>nul || start "" "http://localhost:7777"

echo.
echo 使用完畢後，關閉這個視窗即可停止伺服器。
echo.
pause
