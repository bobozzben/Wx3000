@echo off
echo === Wx3000Agent v22 Build (Dual Mode) ===
echo Step 1: npm install
call npm install
if errorlevel 1 goto :err

echo.
echo Step 2: check bridge
if exist bridge\lazarus\WbaseBridge.dpr (
  echo lazarus bridge source exists at bridge\lazarus\WbaseBridge.dpr
  echo 請用 lazarus 編譯成 WbaseBridge.exe 到根目錄或 dist\
  echo 如果已編譯，build 會自動複製
)

echo.
echo Step 3: pkg Level1
if not exist dist mkdir dist
call npx pkg package.json -t node18-win-x64 -o dist\Wx3000Agent.exe --compress GZip --public
if errorlevel 1 call npx pkg package.json -t node18-win-x64 -o dist\Wx3000Agent.exe --compress GZip

echo.
echo Step 4: copy assets
if exist "F:\ADSProject\Wx3000\report\wbase\wbaseRP.dll" (
  if not exist dist\wbase mkdir dist\wbase
  copy /Y "F:\ADSProject\Wx3000\report\wbase\wbaseRP.dll" dist\wbase\ >nul
  echo DLL copied
)
if exist WbaseBridge.exe copy /Y WbaseBridge.exe dist\ >nul
if exist bridge\WbaseBridge.exe copy /Y bridge\WbaseBridge.exe dist\ >nul
copy /Y test.html dist\ >nul

echo.
echo === Done ===
dir dist\
echo.
echo 測試:
echo 1. koffi 模式: dist\Wx3000Agent.exe  (預設)
echo 2. bridge 模式: set WBASE_MODE=bridge && dist\Wx3000Agent.exe
echo    或 WS 發送 {"cmd":"setMode","mode":"bridge"}
pause
exit /b 0
:err
echo Build error
pause
exit /b 1
