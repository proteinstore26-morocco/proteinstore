@echo off
REM Ouvre un tunnel public temporaire vers la boutique locale
REM (utile pour montrer le site a quelqu'un sans deployer)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-proteinstore.ps1" -Public
echo.
type "%~dp0..\data\public_url.txt"
echo.
pause
