@echo off
echo Updating LinkedIn Lead Scorer...
cd /d "%~dp0"
git pull
echo.
echo Done! Now go to chrome://extensions and click the reload button on LinkedIn Lead Scorer.
start chrome "chrome://extensions"
pause
