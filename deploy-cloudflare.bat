@echo off
REM ============================================================
REM  Deploie la boutique sur Cloudflare (test2.proteinstore26.workers.dev)
REM  Le token API est lu dans C:\Users\nitro\.cf-token (hors du repo).
REM ============================================================
cd /d "%~dp0"
set "PATH=%~dp0..\tools\bun;%~dp0..\tools\node22;%PATH%"
set "VITE_STATIC_MODE=1"
set /p CLOUDFLARE_API_TOKEN=<"%USERPROFILE%\.cf-token"
set "CLOUDFLARE_ACCOUNT_ID=dde0765ce823cef5558258563925f43e"
set "DEPLOY_DIR=C:\Users\nitro\Downloads\proteinstore-cloudflare"

echo [1/3] Build statique (SPA)...
call bun run build

echo [2/3] Copie vers le dossier de deploiement...
robocopy "%~dp0dist\client" "%DEPLOY_DIR%" /E /NFL /NDL /NJH /NJS >nul
copy /y "%DEPLOY_DIR%\_shell.html" "%DEPLOY_DIR%\index.html" >nul
if exist "%DEPLOY_DIR%\index.html" del "%DEPLOY_DIR%\index.html"
if exist "%DEPLOY_DIR%\_shell.html" ren "%DEPLOY_DIR%\_shell.html" "index.html"

echo [3/3] Deploiement Cloudflare...
pushd "%DEPLOY_DIR%"
call bun x wrangler deploy
popd

echo.
echo  Site live : https://test2.proteinstore26.workers.dev
pause
