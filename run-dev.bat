@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%spring-social"
set "FRONTEND_DIR=%ROOT_DIR%react-social"

echo Starting Spring Boot backend (port 8091)...
start "career-nine backend" cmd /k "cd /d "%BACKEND_DIR%" && mvn spring-boot:run"

if not exist "%FRONTEND_DIR%\node_modules" (
  echo Installing frontend dependencies...
  pushd "%FRONTEND_DIR%"
  call npm install
  popd
)

echo Starting React frontend (port 3000)...
start "career-nine frontend" cmd /k "cd /d "%FRONTEND_DIR%" && npm start"

echo.
echo Backend and frontend launched in separate windows.
echo Close those windows to stop the services.
endlocal
