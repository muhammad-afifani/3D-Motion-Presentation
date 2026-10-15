@echo off
rem start.bat - jalankan server presentasi offline lalu buka browser.
rem Urutan: Node (server.mjs) -> Python (server.py) -> PowerShell (start.ps1, belum diuji).
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node server.mjs --open
  goto :eof
)
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 server.py --open
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  python server.py --open
  goto :eof
)
echo Node dan Python tidak ditemukan. Mencoba server PowerShell (belum diuji di lingkungan pengembangan)...
powershell -ExecutionPolicy Bypass -File "%~dp0start.ps1"
