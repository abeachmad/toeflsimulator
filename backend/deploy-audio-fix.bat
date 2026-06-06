@echo off
REM Deploy audio data fix to production Railway database
echo.
echo ================================================
echo  Deploy Audio Data Fix to Railway Production
echo ================================================
echo.
echo This will:
echo   1. Run link-unused-audio.ts against Railway database
echo   2. Create 42 new questions for 14 unused audio files
echo   3. Increase listening items from ~169 to ~211
echo.
echo Press Ctrl+C to cancel, or
pause

echo.
echo Running data fix against Railway database...
echo.
npx tsx link-unused-audio.ts

echo.
echo ================================================
echo  Deployment Complete!
echo ================================================
echo.
echo Verify at: https://toeflsimulator.up.railway.app/db-status
echo.
pause
