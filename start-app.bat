@echo off
echo Starting iDJ Application...
echo.

echo Building the app...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed! Please check for errors.
    pause
    exit /b 1
)

echo.
echo Starting Electron app with server...
call npm run electron

echo.
echo App closed. Press any key to exit...
pause >nul
