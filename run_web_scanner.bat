@echo off
:: Set terminal encoding to UTF-8 to display Persian characters correctly
chcp 65001 > nul
title اسکنر آی‌پی تمیز کلادفلر (نسخه تحت وب)

echo ====================================================================
echo                   اسکنر آی‌پی تمیز کلادفلر (نسخه تحت وب)             
echo ====================================================================
echo.

:: 1. Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [خطا] برنامه Node.js روی سیستم شما نصب نیست!
    echo برای اجرای این برنامه تحت وب، ابتدا باید Node.js را دانلود و نصب کنید.
    echo آدرس سایت رسمی جهت دانلود: https://nodejs.org
    echo پس از نصب، سیستم خود را یکبار ری‌استارت کرده و مجددا این فایل را اجرا کنید.
    echo.
    pause
    exit /b
)

:: 2. Check if node_modules folder exists
if not exist "node_modules\" (
    echo [اطلاع] پکیج‌های پیش‌نیاز یافت نشدند. در حال نصب خودکار پیش‌نیازها...
    echo لطفا منتظر بمانید (این فرآیند فقط برای بار اول طول می‌کشد)...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [خطا] نصب پیش‌نیازها با خطا مواجه شد. لطفا اتصال اینترنت خود را بررسی کنید.
        pause
        exit /b
    )
    echo [موفقیت] پیش‌نیازها با موفقیت نصب شدند!
    echo.
)

:: 3. Find Local IP address for mobile connection
echo در حال دریافت آی‌پی محلی سیستم شما برای اتصال موبایل...
set "local_ip=127.0.0.1"
for /f "tokens=4 delims= " %%a in ('route print ^| findstr "\<0.0.0.0\>"') do (
    set "local_ip=%%a"
)

echo.
echo ====================================================================
echo  [راهنمای استفاده و اتصال گوشی موبایل]
echo.
echo  1. برنامه تحت وب تا لحظاتی دیگر در مرورگر شما به صورت خودکار باز خواهد شد.
echo.
echo  2. آدرس دسترسی در همین کامپیوتر (PC):
echo     http://localhost:3000
echo.
echo  3. آدرس دسترسی از طریق گوشی موبایل، تبلت یا سایر سیستم‌ها:
echo     http://%local_ip%:3000
echo.
echo  ⚠️  نکته مهم برای موبایل: گوشی شما و کامپیوتر باید به یک مودم یا وای‌فای (Wi-Fi)
echo     مشترک وصل باشند.
echo ====================================================================
echo.
echo در حال اجرای سرور محلی... (این پنجره را نبندید)
echo.

:: 4. Open the browser automatically in 2 seconds in the background
timeout /t 2 /nobreak > nul
start "" "http://localhost:3000"

:: 5. Run the web application
call npm run dev

pause
