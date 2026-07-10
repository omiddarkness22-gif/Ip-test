@echo off
title Cloudflare Clean IP Scanner (Python Desktop)
echo Starting Cloudflare Clean IP Scanner...
echo Ensure Python 3 is installed and in your system PATH.
echo.
python cloudflare_scanner.py
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to start. Trying to run with 'python3'...
    python3 cloudflare_scanner.py
)
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] If you see a module error, make sure Tkinter and python are installed correctly.
    pause
)
