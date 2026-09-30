const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const CONFIG = {
  MODE: process.env.WBASE_MODE || 'koffi', // koffi | bridge
  PORT: 18889,
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

console.log(`[CONFIG] MODE=${CONFIG.MODE}`);

let koffi = null;
let wbaseLib = null;
let waccrep3101_b = null;

function loadKoffi() {
  if (CONFIG.MODE !== 'koffi') return { success: false, error: 'MODE=bridge' };
  try { koffi = require('koffi'); } catch (e) {
    return { success: false, error: 'koffi not installed' };
  }
  const dllPath = CONFIG.getDllPath();
  try {
    if (!fs.existsSync(dllPath)) return { success: false, error: `DLL not found: ${dllPath}` };
    wbaseLib = koffi.load(dllPath);
    // 新版: 取消 vMainAppHandle，只剩 6 參數
    // Function waccrep3101_b(Const hs_chk, top_mag, left_mag: double; Const PrtIndex, IsPrint: integer; Const path: ansistring): integer; stdcall;
    waccrep3101_b = wbaseLib.func('__stdcall', 'waccrep3101_b', 'int', [
      'double', // hs_chk
      'double', // top_mag
      'double', // left_mag
      'int',    // PrtIndex
      'int',    // IsPrint
      'str'     // path
    ]);
    console.log(`[DLL][koffi] 載入成功 (無Handle版): ${dllPath}`);
    return { success: true, dllPath };
  } catch (e) {
    console.error('[DLL][koffi] 載入失敗', e.message);
    return { success: false, error: e.message };
  }
}

if (CONFIG.MODE === 'koffi') loadKoffi();

function callViaKoffi(hs_chk, top_mag, left_mag, PrtIndex, IsPrint, savePath) {
  if (!waccrep3101_b) {
    const r = loadKoffi();
    if (!r.success) return r;
  }
  try {
    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const ret = waccrep3101_b(
      parseFloat(hs_chk) || 0,
      parseFloat(top_mag) || 0,
      parseFloat(left_mag) || 0,
      parseInt(PrtIndex) || 0,
      parseInt(IsPrint) || 0,
      savePath
    );
    return { success: true, mode: 'koffi', retCode: ret, path: savePath };
  } catch (e) {
    return { success: false, mode: 'koffi', error: e.message };
  }
}

function callViaBridge(hs_chk, top_mag, left_mag, PrtIndex, IsPrint, savePath, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const bridgePath = CONFIG.getBridgePath();
    if (!fs.existsSync(bridgePath)) {
      resolve({ success: false, mode: 'bridge', error: `Bridge not found: ${bridgePath}` });
      return;
    }
    try {
      const dir = path.dirname(savePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (e) { }

    const args = [
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
        resolve({ success: false, mode: 'bridge', error: err.message, stderr });
        return;
      }
      const out = stdout.toString().trim();
      if (out.startsWith('OK:')) {
        resolve({ success: true, mode: 'bridge', retCode: parseInt(out.substring(3)) || 0, path: savePath, raw: out });
      } else if (out.startsWith('ERROR:')) {
        resolve({ success: false, mode: 'bridge', error: out });
      } else {
        resolve({ success: true, mode: 'bridge', retCode: parseInt(out) || 0, path: savePath, raw: out });
      }
    });
  });
}

async function call_waccrep3101_b(hs_chk, top_mag, left_mag, PrtIndex, IsPrint, savePath) {
  if (!savePath) return { success: false, error: 'path 空' };
  if (CONFIG.MODE === 'bridge') {
    return await callViaBridge(hs_chk, top_mag, left_mag, PrtIndex, IsPrint, savePath);
  } else {
    return callViaKoffi(hs_chk, top_mag, left_mag, PrtIndex, IsPrint, savePath);
  }
}

function getMacs() {
  const interfaces = os.networkInterfaces();
  const macs = [];
  for (const k of Object.keys(interfaces)) for (const iface of interfaces[k]) {
    if (iface.mac && iface.mac !== '00:00:00:00:00:00' && !iface.internal) macs.push(iface.mac);
  }
  return [...new Set(macs)];
}

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
      signature: 'waccrep3101_b(hs_chk, top_mag, left_mag: double; PrtIndex, IsPrint: integer; path: ansistring)'
    }));
    return;
  }
  if (url.pathname === '/wbaseReport') {
    const result = await call_waccrep3101_b(
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
      if (data.cmd === 'setMode' && (data.mode === 'koffi' || data.mode === 'bridge')) {
        CONFIG.MODE = data.mode;
        if (CONFIG.MODE === 'koffi') loadKoffi();
        ws.send(JSON.stringify({ cmd: 'setMode', success: true, mode: CONFIG.MODE }));
      }
      if (data.cmd === 'wbaseReport') {
        const r = await call_waccrep3101_b(data.hs_chk, data.top_mag, data.left_mag, data.PrtIndex, data.IsPrint, data.path);
        ws.send(JSON.stringify({ cmd: 'wbaseReport', ...r }));
      }
    } catch (e) { ws.send(JSON.stringify({ success: false, error: e.message })); }
  });
});

server.listen(CONFIG.PORT, () => {
  console.log(`Rx3000Agent v23 noHandle running http://localhost:${CONFIG.PORT} MODE=${CONFIG.MODE}`);
});
