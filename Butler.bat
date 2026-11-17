@echo off
setlocal
cd /d "%~dp0"
echo Iniciando OpenKEY (alias heredado Butler)...
python run.py
if errorlevel 1 pause
