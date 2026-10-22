@echo off
pushd "%~dp0"
echo === Wx3000Agent v22 Build (Dual Mode) ===
echo Step 1: npm install
call npm install
if errorlevel 1 goto :err

echo.
echo Step 2: check bridge
if exist bridge\lazarus\WbaseBridge.exe (
  copy /Y bridge\lazarus\WbaseBridge.exe WbaseBridge.exe >nul
  echo WbaseBridge.exe copied from bridge\lazarus\
) else if exist bridge\lazarus\WbaseBridge_Generic.exe (
  copy /Y bridge\lazarus\WbaseBridge_Generic.exe WbaseBridge.exe >nul
  echo WbaseBridge.exe copied from bridge\lazarus\WbaseBridge_Generic.exe
)

echo.
echo Step 3: pkg Level1
if not exist dist mkdir dist
call npx pkg package.json -t node18-win-x64 -o dist\Wx3000Agent.exe --compress GZip --public
if errorlevel 1 call npx pkg package.json -t node18-win-x64 -o dist\Wx3000Agent.exe --compress GZip

echo.
echo Step 4: copy assets
if exist "wbase\wbaseRP.dll" (
  if not exist dist\wbase mkdir dist\wbase
  xcopy /E /I /Y "wbase\*" "dist\wbase\" >nul
  echo DLL copied from wbase\
)
if exist WbaseBridge.exe copy /Y WbaseBridge.exe dist\ >nul
if exist bridge\WbaseBridge.exe copy /Y bridge\WbaseBridge.exe dist\ >nul
if exist dlls.json copy /Y dlls.json dist\ >nul
if exist DBFBridge.exe copy /Y DBFBridge.exe dist\ >nul
if exist w3000_dbf.dll copy /Y w3000_dbf.dll dist\ >nul
if exist w3000_dbf.VBR copy /Y w3000_dbf.VBR dist\ >nul
if exist vfpencryption.fll copy /Y vfpencryption.fll dist\ >nul
if exist install_service.bat copy /Y install_service.bat dist\ >nul
copy /Y test.html dist\ >nul

echo.
echo Step 5: Sync to ..\publish\localagent\dist\
if not exist "..\publish\localagent\dist" mkdir "..\publish\localagent\dist"
xcopy /E /I /Y "dist\*" "..\publish\localagent\dist\" >nul

echo.
echo === Done ===
dir "..\publish\localagent\dist\"
echo.
echo 產出目錄: ..\publish\localagent\dist\
echo 測試:
echo 1. koffi 模式: ..\publish\localagent\dist\Wx3000Agent.exe  (預設)
echo 2. bridge 模式: set WBASE_MODE=bridge && ..\publish\localagent\dist\Wx3000Agent.exe
echo    或 WS 發送 {"cmd":"setMode","mode":"bridge"}
popd
if /I not "%CI%"=="true" pause
exit /b 0
:err
echo Build error
popd
if /I not "%CI%"=="true" pause
exit /b 1
