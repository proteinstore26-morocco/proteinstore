@echo off
REM ============================================================
REM  ProteinStore (projet reel) - serveur de developpement
REM  Demarre aussi le Supabase-mock local si necessaire.
REM  Site : http://localhost:5173   |   Admin : /admin
REM  Login admin (mock) : admin@proteinstore.pro / admin123
REM  Les cles viennent du fichier .env (mock local par defaut).
REM ============================================================
cd /d "%~dp0"

REM --- Charge les variables du .env ---
for /f "usebackq tokens=1,* delims==" %%a in (".env") do set "%%a=%%b"

REM --- Supabase-mock : demarre s'il ne tourne pas deja ---
powershell -NoProfile -Command "if (-not (Get-NetTCPConnection -LocalPort 8210 -State Listen -ErrorAction SilentlyContinue)) { Start-Process python -ArgumentList '..\supabase-mock\server.py' -WorkingDirectory (Split-Path -Parent (Get-Location)) -WindowStyle Hidden }"

REM --- Serveur de dev ---
call bun run dev
pause
