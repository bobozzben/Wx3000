Rx3000 v19 - 不外流發佈版說明

3種保護等級:

Level1 pkg打包EXE (推薦)
  npm install
  build_exe.bat
  得到 dist/Rx3000Agent.exe (原始碼看不到)

Level2 混淆+pkg
  先用 javascript-obfuscator 混淆再 pkg

Level3 Inno Setup安裝包 (最專業)
  用 installer.iss 編譯成 Setup.exe
  客戶一鍵安裝成Service，無黑窗，Program Files

建議: 正式給客戶用 Level1 EXE + install_service.bat 裝成Service
