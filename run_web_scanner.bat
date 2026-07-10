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

:: 2. Check if node_modules/tsx exists. If not, or if force re-install is needed
set "install_needed=0"
if not exist "node_modules\" set "install_needed=1"
if not exist "node_modules\.bin\tsx" if not exist "node_modules\.bin\tsx.cmd" set "install_needed=1"

if "%install_needed%"=="1" (
    echo [!] پکیج‌های پیش‌نیاز یافت نشدند یا ناقص هستند (علت ارور tsx).
    echo برای حل مشکل، پکیج‌ها باید نصب شوند.
    echo.
    echo گزینه‌های نصب:
    echo [1] نصب با استفاده از سرور کمکی بدون تحریم (NPM Mirror - توصیه شده برای کاربران ایران)
    echo [2] نصب استاندارد (نیازمند روشن بودن قندشکن/VPN شما)
    echo.
    set /p choice="لطفاً یک گزینه را انتخاب کنید (1 یا 2): "

    if "%choice%"=="1" (
        echo.
        echo در حال نصب پکیج‌ها با سرور کمکی بدون تحریم (npmmirror.com)...
        echo لطفا منتظر بمانید (این فرآیند چند دقیقه طول می‌کشد)...
        echo.
        call npm install --registry=https://registry.npmmirror.com
    ) else (
        echo.
        echo لطفاً مطمئن شوید VPN شما روشن است.
        echo در حال نصب پکیج‌ها به صورت استاندارد...
        echo لطفا منتظر بمانید...
        echo.
        call npm install
    )

    if %errorlevel% neq 0 (
        echo.
        echo [خطا] نصب پکیج‌ها با خطا مواجه شد!
        echo راه حل: لطفاً VPN خود را روشن یا خاموش کرده و مجدداً این فایل را اجرا کنید.
        echo همچنین مطمئن شوید به اینترنت متصل هستید.
        echo.
        pause
        exit /b
    )
    echo [موفقیت] پکیج‌ها با موفقیت نصب شدند!
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

:: 4. Open the browser automatically in Google Chrome or Fallback to default
timeout /t 3 /nobreak > nul
reg query "HKEY_LOCAL_MACHINE\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" >nul 2>nul
if %errorlevel% equ 0 (
    echo در حال باز کردن برنامه در مرورگر Google Chrome...
    start chrome "http://localhost:3000"
) else (
    echo در حال باز کردن برنامه در مرورگر پیش‌فرض سیستم...
    start "" "http://localhost:3000"
)

:: 5. Run the web application
call npm run dev

pause
