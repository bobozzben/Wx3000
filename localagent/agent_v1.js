const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFile, execFileSync } = require('child_process');

// ==================== 設定區 (可切換) ====================
const CONFIG = {
  // 切換方式: 'koffi' 直接載入DLL, 'bridge' 透過外部exe呼叫
  // 可用環境變數覆蓋: set WBASE_MODE=bridge
  MODE: process.env.WBASE_MODE || 'koffi', // 'koffi' | 'bridge'
  PORT: 18889,
  // DLL 路徑自動偵測
  getDllPath() {
    const cands = [
      path.join(path.dirname(process.execPath), 'wbase', 'wbaseRP.dll'),
      path.join(__dirname, 'wbase', 'wbaseRP.dll'),
      'F:\\ADSProject\\Wx3000\\report\\wbase\\wbaseRP.dll'
    ];
    for (const p of cands) if (fs.existsSync(p)) return p;
    return cands[0];
  },
  getBridgePath() {
    const cands = [
      path.join(path.dirname(process.execPath), 'WbaseBridge.exe'),
      path.join(path.dirname(process.execPath), 'bridge', 'WbaseBridge.exe'),
      path.join(__dirname, 'WbaseBridge.exe'),
      path.join(__dirname, 'bridge', 'WbaseBridge.exe'),
      'F:\\ADSProject\\Wx3000\\localagent_koffi\\bridge\\lazarus\\lib\\x86_64-win64\\WbaseBridge.exe'
    ];
    for (const p of cands) if (fs.existsSync(p)) return p;
    return cands[0];
  }
};

console.log(`[CONFIG] MODE=${CONFIG.MODE} (可設環境變數 WBASE_MODE=bridge/koffi 切換)`);

let koffi = null;
let wbaseLib = null;
let waccrep3101_b = null;

function loadKoffi() {
  if (CONFIG.MODE !== 'koffi') return { success: false, error: 'MODE is bridge' };
  try { koffi = require('koffi'); } catch (e) {
    return { success: false, error: 'koffi not installed. npm install koffi 或切換到 bridge 模式' };
  }
  const dllPath = CONFIG.getDllPath();
  try {
    if (!fs.existsSync(dllPath)) return { success: false, error: `DLL not found: ${dllPath}` };
    wbaseLib = koffi.load(dllPath);
    waccrep3101_b = wbaseLib.func('__stdcall', 'waccrep3101_b', 'int', ['void*', 'double', 'double', 'double', 'int', 'int', 'str']);
    console.log(`[DLL][koffi] 載入成功: ${dllPath}`);
    return { success: true, dllPath };
  } catch (e) {
    console.error('[DLL][koffi] 載入失敗', e.message);
    return { success: false, error: e.message };
  }
}

if (CONFIG.MODE === 'koffi') loadKoffi();

function callViaKoffi(vMainAppHandle, hs_chk, top_mag, left_mag, PrtIndex, IsPrint, savePath) {
  if (!waccrep3101_b) {
    const r = loadKoffi();
    if (!r.success) return r;
  }
  try {
    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const hHandle = koffi.as(Number(vMainAppHandle) || 0, 'void*');
    const ret = waccrep3101_b(hHandle, parseFloat(hs_chk) || 0, parseFloat(top_mag) || 0, parseFloat(left_mag) || 0, parseInt(PrtIndex) || 0, parseInt(IsPrint) || 0, savePath);
    return { success: true, mode: 'koffi', retCode: ret, path: savePath };
  } catch (e) {
    return { success: false, mode: 'koffi', error: e.message };
  }
}

function callViaBridge(vMainAppHandle, hs_chk, top_mag, left_mag, PrtIndex, IsPrint, savePath, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const bridgePath = CONFIG.getBridgePath();
    if (!fs.existsSync(bridgePath)) {
      resolve({ success: false, mode: 'bridge', error: `Bridge not found: ${bridgePath}. 請先編譯 bridge/delphi/WbaseBridge.dpr` });
      return;
    }
    try {
      const dir = path.dirname(savePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (e) { }

    const args = [
      String(Number(vMainAppHandle) || 0),
      String(parseFloat(hs_chk) || 0),
      String(parseFloat(top_mag) || 0),
      String(parseFloat(left_mag) || 0),
      String(parseInt(PrtIndex) || 0),
      String(parseInt(IsPrint) || 0),
      savePath
    ];
    console.log(`[DLL][bridge] exec ${bridgePath} ${args.join(' ')}`);

    execFile(bridgePath, args, { timeout: timeoutMs, windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        console.error('[BRIDGE ERR]', err.message, stderr);
        resolve({ success: false, mode: 'bridge', error: err.message, stderr });
        return;
      }
      const out = stdout.toString().trim();
      // Bridge 回傳格式: OK:0 或 ERROR:...
      if (out.startsWith('OK:')) {
        const code = parseInt(out.substring(3)) || 0;
        resolve({ success: true, mode: 'bridge', retCode: code, path: savePath, raw: out });
      } else if (out.startsWith('ERROR:')) {
        resolve({ success: false, mode: 'bridge', error: out });
      } else {
        // 相容舊版直接回數字
        const code = parseInt(out) || 0;
        resolve({ success: true, mode: 'bridge', retCode: code, path: savePath, raw: out });
      }
    });
  });
}

// 統一入口，支援同步/非同步
async function call_waccrep3101_b(vMainAppHandle, hs_chk, top_mag, left_mag, PrtIndex, IsPrint, savePath) {
  if (!savePath) return { success: false, error: 'path 空' };
  if (CONFIG.MODE === 'bridge') {
    return await callViaBridge(vMainAppHandle, hs_chk, top_mag, left_mag, PrtIndex, IsPrint, savePath);
  } else {
    // koffi 是同步的，但包成 Promise 統一介面
    return callViaKoffi(vMainAppHandle, hs_chk, top_mag, left_mag, PrtIndex, IsPrint, savePath);
  }
}

// MAC
function getMacs() {
  const interfaces = os.networkInterfaces();
  const macs = [];
  for (const k of Object.keys(interfaces)) for (const iface of interfaces[k]) {
    if (iface.mac && iface.mac !== '00:00:00:00:00:00' && !iface.internal) macs.push(iface.mac);
  }
  return [...new Set(macs)];
}

// HTTP+WS
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  const url = new URL(req.url, `http://localhost:${CONFIG.PORT}`);

  if (url.pathname === '/mac') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, macs: getMacs() }));
    return;
  }
  if (url.pathname === '/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      mode: CONFIG.MODE,
      dllPath: CONFIG.getDllPath(),
      dllExists: fs.existsSync(CONFIG.getDllPath()),
      bridgePath: CONFIG.getBridgePath(),
      bridgeExists: fs.existsSync(CONFIG.getBridgePath()),
      koffiLoaded: !!waccrep3101_b
    }));
    return;
  }
  if (url.pathname === '/wbaseReport') {
    const handle = url.searchParams.get('handle') || url.searchParams.get('vMainAppHandle') || '0';
    const result = await call_waccrep3101_b(handle,
      url.searchParams.get('hs_chk') || '0',
      url.searchParams.get('top_mag') || '0',
      url.searchParams.get('left_mag') || '0',
      url.searchParams.get('PrtIndex') || '0',
      url.searchParams.get('IsPrint') || '0',
      url.searchParams.get('path') || 'C:\\temp\\wbase_report.pdf'
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }
  if (url.pathname === '/' || url.pathname === '/test.html') {
    const p = path.join(__dirname, 'test.html');
    if (fs.existsSync(p)) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(fs.readFileSync(p)); return; }
  }
  res.writeHead(404); res.end('Not Found');
});

const wss = new WebSocket.Server({ server });
wss.on('connection', (ws) => {
  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.cmd === 'mac') ws.send(JSON.stringify({ cmd: 'mac', success: true, macs: getMacs() }));
      if (data.cmd === 'config') ws.send(JSON.stringify({ cmd: 'config', mode: CONFIG.MODE, dllPath: CONFIG.getDllPath(), bridgePath: CONFIG.getBridgePath() }));
      if (data.cmd === 'setMode' && (data.mode === 'koffi' || data.mode === 'bridge')) {
        CONFIG.MODE = data.mode;
        if (CONFIG.MODE === 'koffi') loadKoffi();
        ws.send(JSON.stringify({ cmd: 'setMode', success: true, mode: CONFIG.MODE }));
      }
      if (data.cmd === 'wbaseReport') {
        const r = await call_waccrep3101_b(data.handle || data.vMainAppHandle || 0, data.hs_chk, data.top_mag, data.left_mag, data.PrtIndex, data.IsPrint, data.path);
        ws.send(JSON.stringify({ cmd: 'wbaseReport', ...r }));
      }
    } catch (e) { ws.send(JSON.stringify({ success: false, error: e.message })); }
  });
});

server.listen(CONFIG.PORT, () => {
  console.log(`Rx3000Agent v22 running http://localhost:${CONFIG.PORT} MODE=${CONFIG.MODE}`);
  console.log(`DLL: ${CONFIG.getDllPath()} Exists=${fs.existsSync(CONFIG.getDllPath())}`);
  console.log(`Bridge: ${CONFIG.getBridgePath()} Exists=${fs.existsSync(CONFIG.getBridgePath())}`);
});
