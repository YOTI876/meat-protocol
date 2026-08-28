@echo off
REM ---------------------------------------------------------------
REM  Play MEAT PROTOCOL as a desktop app, locally.
REM
REM  This launches the same window the packaged .exe does, but through
REM  Electron's own binary in desktop\node_modules -- which Smart App
REM  Control allows, because it is a binary Microsoft has seen a million
REM  times. A freshly built .exe has no such reputation and gets blocked.
REM
REM  Needs "npm install" to have been run once inside desktop\.
REM ---------------------------------------------------------------
cd /d "%~dp0desktop"
if not exist node_modules (
  echo First run: installing Electron. This takes a few minutes.
  call npm install
)
if not exist game (
  echo Staging the game...
  cd /d "%~dp0"
  call node build.js --min
  cd /d "%~dp0desktop"
  xcopy /E /I /Y /Q "..\dist" "game" >nul
)
call npm start
