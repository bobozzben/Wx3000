@echo off
call node build-obfuscate.js
rem // 用這個檔 package.obf.json 打包成執行檔,執行會跳出來,這個看似沒作用
rem call npx pkg package.obf.json -t node18-win-x64 -o dist\Rx3000Agent_L2.exe --compress GZip

rem OK
call npx pkg agent.obf.js   -t node18-win-x64 -o dist\Rx3000Agent_L2.exe --compress GZip 

rem copy test.html dist\ >nul
rem copy /Y node_modules\ws\package.json dist\ >nul 2>&1

 dir dist
pause
