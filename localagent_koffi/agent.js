const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

// ========== 通用設定檔 ==========
let DLL_CONFIG = { dlls: {} };
try {
  const cfgPath = path.join(__dirname, 'dlls.json');
  if (fs.existsSync(cfgPath)) {
    DLL_CONFIG = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    console.log('[CONFIG] 載入 dlls.json', Object.keys(DLL_CONFIG.dlls || {}));
  }
} catch(e) { console.error('dlls.json 載入失敗', e.message); }

const CONFIG = {
  MODE: process.env.WBASE_MODE || 'koffi',
  PORT: 18889,
  getDllPath(dllKey) {
    if (process.env.WBASE_DLL_PATH && fs.existsSync(process.env.WBASE_DLL_PATH)) return process.env.WBASE_DLL_PATH;
    const info = (DLL_CONFIG.dlls || {})[dllKey];
    if (!info) return null;
    const cands = [
      path.join(path.dirname(process.execPath), info.path),
      path.join(__dirname, info.path),
      ...(info.fallback_paths || [])
    ];
    for (const p of cands) if (fs.existsSync(p)) return p;
    return cands[0];
  },
  getBridgePath() {
    const cands = [
      path.join(path.dirname(process.execPath), 'WbaseBridge.exe'),
      path.join(__dirname, 'WbaseBridge.exe'),
      path.join(__dirname, 'bridge', 'WbaseBridge.exe'),
    ];
    for (const p of cands) if (fs.existsSync(p)) return p;
    return cands[0];
  }
};

let koffi = null;
try { koffi = require('koffi'); } catch(e) { console.warn('koffi not installed, 請 npm install koffi 或用 bridge 模式'); }

const loadedLibs = {}; // dllKey -> { lib, funcs: {name: func} }

function loadDllKoffi(dllKey) {
  if (!koffi) return { success: false, error: 'koffi not installed' };
  const info = DLL_CONFIG.dlls[dllKey];
  if (!info) return { success: false, error: `dll ${dllKey} not in dlls.json` };
  const dllPath = CONFIG.getDllPath(dllKey);
  if (!fs.existsSync(dllPath)) return { success: false, error: `DLL not found: ${dllPath}` };
  
  try {
    if (!loadedLibs[dllKey]) {
      const lib = koffi.load(dllPath);
      loadedLibs[dllKey] = { lib, path: dllPath, funcs: {}, info };
    }
    const entry = loadedLibs[dllKey];
    // 載入所有函數
    for (const [funcName, funcDef] of Object.entries(info.functions || {})) {
      if (!entry.funcs[funcName]) {
        entry.funcs[funcName] = entry.lib.func('__stdcall', funcDef.func || funcName, funcDef.ret || 'int', funcDef.params || []);
        console.log(`[koffi] ${dllKey}.${funcName} 載入成功`);
      }
    }
    return { success: true, dllPath };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// 預先載入
if (CONFIG.MODE === 'koffi') {
  for (const k of Object.keys(DLL_CONFIG.dlls || {})) loadDllKoffi(k);
}

function callViaKoffi(dllKey, funcName, args) {
  const entry = loadedLibs[dllKey];
  if (!entry || !entry.funcs[funcName]) {
    const r = loadDllKoffi(dllKey);
    if (!r.success) return r;
  }
  try {
    const fn = loadedLibs[dllKey].funcs[funcName];
    if (!fn) return { success: false, error: `func ${funcName} not found` };
    // 確保目錄存在 (如果最後一個參數是路徑)
    const last = args[args.length-1];
    if (typeof last === 'string' && (last.includes(':\\') || last.includes('/'))) {
      try { const dir = path.dirname(last); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch(e) {}
    }
    const ret = fn(...args);
    return { success: true, mode: 'koffi', dll: dllKey, func: funcName, retCode: ret };
  } catch(e) {
    return { success: false, mode: 'koffi', error: e.message };
  }
}

function callViaBridge(dllKey, funcName, args) {
  return new Promise((resolve) => {
    const bridgePath = CONFIG.getBridgePath();
    if (!fs.existsSync(bridgePath)) {
      resolve({ success: false, mode: 'bridge', error: `Bridge not found: ${bridgePath}` });
      return;
    }
    // 通用參數格式: --dll wbaseRP --func waccrep3101_b --args JSON
    const argsJson = JSON.stringify(args);
    const dllPath = CONFIG.getDllPath(dllKey) || dllKey;
    const cmdArgs = ['--dll', dllPath, '--func', funcName, '--args', argsJson, '--dllkey', dllKey];
    
    execFile(bridgePath, cmdArgs, { timeout: 60000, windowsHide: false }, (err, stdout, stderr) => {
      if (err) {
        resolve({ success: false, mode: 'bridge', error: err.message, stderr, stdout });
        return;
      }
      const out = stdout.toString().trim();
      if (out.includes('OK:')) {
        const m = out.match(/OK:(-?\d+)/);
        resolve({ success: true, mode: 'bridge', retCode: m ? parseInt(m[1]) : 0, raw: out });
      } else {
        resolve({ success: false, mode: 'bridge', error: out || stderr });
      }
    });
  });
}

async function genericCall(dllKey, funcName, args) {
  if (CONFIG.MODE === 'bridge') return await callViaBridge(dllKey, funcName, args);
  return callViaKoffi(dllKey, funcName, args);
}

function getMacs() {
  const interfaces = os.networkInterfaces();
  const macs = [];
  for (const k of Object.keys(interfaces)) for (const iface of interfaces[k]) {
    if (iface.mac && iface.mac !== '00:00:00:00:00:00' && !iface.internal) macs.push(iface.mac);
  }
  return [...new Set(macs)];
}

// ========== HTTP + WS ==========
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${CONFIG.PORT}`);

  if (url.pathname === '/mac') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ success: true, macs: getMacs() }));
    return;
  }
  if (url.pathname === '/config') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ mode: CONFIG.MODE, dlls: DLL_CONFIG, bridgeExists: fs.existsSync(CONFIG.getBridgePath()) }));
    return;
  }
  if (url.pathname === '/dllList') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify(DLL_CONFIG));
    return;
  }
  // 舊相容
  if (url.pathname === '/wbaseReport') {
    const args = [
      parseFloat(url.searchParams.get('hs_chk')||'0'),
      parseFloat(url.searchParams.get('top_mag')||'0'),
      parseFloat(url.searchParams.get('left_mag')||'0'),
      parseInt(url.searchParams.get('PrtIndex')||'0'),
      parseInt(url.searchParams.get('IsPrint')||'0'),
      url.searchParams.get('path')||'C:\\temp\\wbase_report.pdf'
    ];
    const result = await genericCall('wbaseRP', 'waccrep3101_b', args);
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify(result));
    return;
  }
  // 通用 POST /api/call
  if (url.pathname === '/api/call' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const result = await genericCall(data.dll, data.func, data.args || []);
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify(result));
      } catch(e) {
        res.writeHead(400, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }
  // 通用 GET /api/call?dll=...&func=...&args=JSON
  if (url.pathname === '/api/call' && req.method === 'GET') {
    try {
      const dll = url.searchParams.get('dll');
      const func = url.searchParams.get('func');
      const argsStr = url.searchParams.get('args') || '[]';
      const args = JSON.parse(argsStr);
      const result = await genericCall(dll, func, args);
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify(result));
      return;
    } catch(e) {
      res.writeHead(400, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ success: false, error: e.message }));
      return;
    }
  }
  if (url.pathname === '/' || url.pathname === '/test.html') {
    const p = path.join(__dirname, 'test.html');
    if (fs.existsSync(p)) { res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); res.end(fs.readFileSync(p)); return; }
  }
  res.writeHead(404); res.end('Not Found');
});

const wss = new WebSocket.Server({ server });
wss.on('connection', (ws) => {
  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.cmd === 'mac') ws.send(JSON.stringify({ cmd:'mac', success:true, macs:getMacs() }));
      if (data.cmd === 'dllList') ws.send(JSON.stringify({ cmd:'dllList', ...DLL_CONFIG }));
      if (data.cmd === 'setMode') { CONFIG.MODE = data.mode; ws.send(JSON.stringify({ cmd:'setMode', success:true, mode:CONFIG.MODE })); }
      if (data.cmd === 'call') {
        const r = await genericCall(data.dll, data.func, data.args || []);
        ws.send(JSON.stringify({ cmd:'call', ...r }));
      }
      if (data.cmd === 'wbaseReport') {
        const r = await genericCall('wbaseRP', 'waccrep3101_b', [data.hs_chk, data.top_mag, data.left_mag, data.PrtIndex, data.IsPrint, data.path]);
        ws.send(JSON.stringify({ cmd:'wbaseReport', ...r }));
      }
    } catch(e) { ws.send(JSON.stringify({ success:false, error:e.message })); }
  });
});

server.listen(CONFIG.PORT, () => {
  console.log(`Rx3000Agent v26 generic http://localhost:${CONFIG.PORT} MODE=${CONFIG.MODE}`);
});
