@echo off
REM ============================================================
REM  ProteinStore - demarrage boutique + tunnel public
REM  Double-cliquez ce fichier pour relancer le site de test.
REM ============================================================
cd /d "%~dp0"

start "ProteinStore serveur" cmd /k python server.py
timeout /t 2 /nobreak >nul
start "ProteinStore tunnel public" cmd /k "%~dp0..\tools\cloudflared.exe" tunnel --url http://127.0.0.1:8000

echo.
echo  Boutique locale : http://127.0.0.1:8000
echo  Admin           : http://127.0.0.1:8000/admin
echo.
echo  L'URL publique (https://xxxx.trycloudflare.com) s'affiche
echo  dans la fenetre "ProteinStore tunnel public".
echo  NB : l'URL change a chaque relance du tunnel.
echo.
pause
