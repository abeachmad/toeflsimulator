@echo off
echo.
echo ====================================
echo   TOEFL Audio Downloader
echo ====================================
echo.
echo This will download audio files from Archive.org
echo and set them up for your TOEFL simulator.
echo.
pause

cd backend\scripts
powershell -ExecutionPolicy Bypass -File download-archive-org-audio.ps1

pause
