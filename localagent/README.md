# v26 通用版 - 多DLL多函數

## 1. 只改 dlls.json 就能擴充
{
  "dlls": {
    "wbaseRP": {
      "path": "wbase/wbaseRP.dll",
      "functions": {
        "waccrep3101_b": { "ret": "int", "params": ["double","double","double","int","int","str"], "bringToFront": true },
        "waccrep3102_b": { "ret": "int", "params": ["double","str"] }
      }
    },
    "newDLL": {
      "path": "wbase/new.dll",
      "functions": {
        "newFunc": { "ret": "int", "params": ["int","str"] }
      }
    }
  }
}

## 2. agent.js 通用呼叫 (koffi 模式)
POST http://localhost:18889/api/call
Body: { "dll": "wbaseRP", "func": "waccrep3101_b", "args": [1,10,10,0,0,"C:\\temp\\a.pdf"] }

GET http://localhost:18889/api/call?dll=wbaseRP&func=waccrep3101_b&args=[1,10,10,0,0,"C:\\temp\\a.pdf"]

WS: ws.send(JSON.stringify({cmd:"call", dll:"wbaseRP", func:"waccrep3101_b", args:[1,10,10,0,0,"C:\\temp\\a.pdf"]}))

## 3. WbaseBridge 通用呼叫 (bridge 模式)
WbaseBridge.exe --dll wbase/wbaseRP.dll --func waccrep3101_b --args "[1,10,10,0,0,\"C:\\temp\\a.pdf\"]"

舊相容:
WbaseBridge.exe 1 10 10 0 0 C:\temp\a.pdf

## 4. 加新函數要改哪裡
- koffi 模式: 完全不用改程式，只要改 dlls.json
- bridge 模式: WbaseBridge.lpr 最下方有 // ========== 通用分發表 ========== 註解處，複製 waccrep3101_b 那一段，改參數類型即可

因為 Pascal 無法真正動態呼叫任意簽名，所以 bridge 需要加一個分支，但只要 5 行。
