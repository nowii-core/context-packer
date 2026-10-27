@echo off
rem Drag a folder onto this file to pack it, or double-click to pack this folder.
rem The result is copied to your clipboard.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required: https://nodejs.org
  pause
  exit /b 1
)
set "TARGET=%~1"
if "%TARGET%"=="" set "TARGET=%~dp0"
node "%~dp0bin\ctx-pack.js" "%TARGET%" --copy
echo.
echo Done. Paste it into your AI chat with Ctrl+V.
pause
