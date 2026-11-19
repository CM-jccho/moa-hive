@echo off
rem ─────────────────────────────────────────────────────────────
rem  MOA Hive — Windows 원클릭 실행
rem  더블클릭하면 로컬 서버를 켜고 브라우저를 엽니다.
rem  이 창을 닫으면 서버도 종료됩니다. (Node.js v18 이상 필요)
rem ─────────────────────────────────────────────────────────────
setlocal
chcp 65001 >nul
cd /d "%~dp0"

set "PORT=3847"
if not "%~1"=="" set "PORT=%~1"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js가 필요합니다 ^(v18 이상^).
  echo   https://nodejs.org 에서 설치한 뒤 다시 실행해 주세요.
  echo.
  pause
  exit /b 1
)

echo.
echo   MOA Hive 시작 — http://127.0.0.1:%PORT%
echo   이 창을 닫으면 서버가 종료됩니다. 데이터는 .\data\ 에만 저장됩니다.
echo.

rem 2초 뒤 기본 브라우저 열기 (서버가 뜨는 시간 확보)
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:%PORT%'"

set "PORT=%PORT%"
node server.js
if errorlevel 1 (
  echo.
  echo   서버가 비정상 종료되었습니다. 위 메시지를 확인해 주세요.
  echo   포트가 사용 중이면:  start.bat 3900
  pause
)
endlocal
