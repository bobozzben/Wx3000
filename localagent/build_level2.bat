@echo off
@chcp 65001 >nul
echo === Wx3000Agent Level 2 Build (Obfuscated) ===

echo Step 1: npm install
call npm install
if errorlevel 1 goto :err

echo.
echo Step 2: Obfuscating
call node build-obfuscate.js
if errorlevel 1 goto :err

echo.
echo Step 3: pkg Level2
if not exist dist mkdir dist
call npx pkg agent.obf.js -t node18-win-x64 -o dist\Wx3000Agent_L2.exe --compress GZip
if errorlevel 1 goto :err

echo.
echo Step 4: copy assets
if not exist dist\wbase mkdir dist\wbase
if exist wbase\wbaseRP.dll copy /Y wbase\wbaseRP.dll dist\wbase\ >nul
if exist "%~dp0..\report\wbase\wbaseRP.dll" copy /Y "%~dp0..\report\wbase\wbaseRP.dll" dist\wbase\ >nul

if exist bridge\lazarus\WbaseBridge.exe copy /Y bridge\lazarus\WbaseBridge.exe dist\ >nul
if exist WbaseBridge.exe copy /Y WbaseBridge.exe dist\ >nul

if exist DBFBridge.exe copy /Y DBFBridge.exe dist\ >nul
if exist bridge\lazarus\DBFBridge.exe if not exist dist\DBFBridge.exe copy /Y bridge\lazarus\DBFBridge.exe dist\ >nul

if exist dlls.json copy /Y dlls.json dist\ >nul
if exist test.html copy /Y test.html dist\ >nul
if exist w3000_dbf.dll copy /Y w3000_dbf.dll dist\ >nul
if exist vfpencryption.fll copy /Y vfpencryption.fll dist\ >nul
if exist w3000_dbf.VBR copy /Y w3000_dbf.VBR dist\ >nul

echo.
echo === Done ===
dir dist\
if /i "%1" neq "nopause" pause
exit /b 0

:err
echo Build error
if /i "%1" neq "nopause" pause
exit /b 1
