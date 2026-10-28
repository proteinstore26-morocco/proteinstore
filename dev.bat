@echo off
REM ============================================================
REM  ProteinStore (projet reel) - serveur de developpement
REM  Necessite .env rempli avec les cles Supabase.
REM  Site : http://localhost:5173
REM ============================================================
cd /d "%~dp0"
bun run dev
pause
