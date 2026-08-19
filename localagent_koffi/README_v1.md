# v22 Dual Mode

## 兩種模式
- koffi: Node.js 直接 load wbaseRP.dll，最快，維護最簡單 (推薦)
- bridge: Node.js 呼叫 WbaseBridge.exe (Delphi 寫的)，再由 exe 呼叫 DLL，最穩，pkg 不會出問題

## 切換方式 (3種)
1. 環境變數 (發佈時用):
   set WBASE_MODE=bridge
   Rx3000Agent.exe
   或
   set WBASE_MODE=koffi
   Rx3000Agent.exe

2. WS 即時切換 (測試用):
   ws.send(JSON.stringify({cmd:'setMode', mode:'bridge'}))
   ws.send(JSON.stringify({cmd:'setMode', mode:'koffi'}))

3. 改 agent.js 第一行 CONFIG.MODE 預設值

## 編譯 WbaseBridge.exe (Delphi 團隊維護)
1. 開啟 bridge/delphi/WbaseBridge.dpr
2. Delphi 編譯成 WbaseBridge.exe
3. 放到 專案根目錄 或 dist\

## 發佈結構
dist/
  Rx3000Agent.exe
  WbaseBridge.exe (bridge 模式才需要)
  wbase/
    wbaseRP.dll
  test.html

## 測試
http://localhost:18889/config 查看目前模式
http://localhost:18889/wbaseReport?handle=0&path=C:\temp\test.pdf
