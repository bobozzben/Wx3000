const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile, spawn } = require('child_process');

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// ========== 實體磁碟路徑輔助 (防止 pkg 虛擬路徑 C:\snapshot\ 導致 spawn/LoadLibrary ENOENT) ==========
const EXEC_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;

function isSnapshotPath(p) {
  return !p || /^[a-zA-Z]:[\\/]snapshot([\\/]|$)/i.test(p) || p.startsWith('/snapshot/');
}

function existsOnRealDisk(p) {
  return Boolean(p) && !isSnapshotPath(p) && fs.existsSync(p);
}

// ========== 通用設定檔 ==========
let DLL_CONFIG = { dlls: {} };
try {
  const cfgCands = [
    path.join(EXEC_DIR, 'dlls.json'),
    path.join(process.cwd(), 'dlls.json'),
    path.join(__dirname, 'dlls.json')
  ];
  for (const cfgPath of cfgCands) {
    if (fs.existsSync(cfgPath)) {
      DLL_CONFIG = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      console.log(`[CONFIG] 載入 dlls.json (${cfgPath})`, Object.keys(DLL_CONFIG.dlls || {}));
      break;
    }
  }
} catch (e) { console.error('dlls.json 載入失敗', e.message); }

const CONFIG = {
  MODE: process.env.WBASE_MODE || 'bridge',
  PORT: 18889,
  getDllPath(dllKey) {
    if (process.env.WBASE_DLL_PATH && existsOnRealDisk(process.env.WBASE_DLL_PATH)) return process.env.WBASE_DLL_PATH;
    const info = (DLL_CONFIG.dlls || {})[dllKey];
    if (!info) return null;
    const relPaths = [info.path, ...(info.fallback_paths || [])].filter(Boolean);
    const cands = [];
    for (const p of relPaths) {
      if (path.isAbsolute(p)) {
        cands.push(p);
      } else {
        cands.push(path.resolve(EXEC_DIR, p));
        cands.push(path.resolve(process.cwd(), p));
      }
    }
    for (const p of cands) {
      if (existsOnRealDisk(p)) return p;
    }
    return cands[0] || path.resolve(EXEC_DIR, info.path);
  },
  getBridgePath() {
    const cands = [
      path.join(EXEC_DIR, 'WbaseBridge.exe'),
      path.join(EXEC_DIR, 'WbaseBridge_Generic.exe'),
      path.join(EXEC_DIR, 'bridge', 'lazarus', 'WbaseBridge.exe'),
      path.join(EXEC_DIR, 'bridge', 'lazarus', 'WbaseBridge_Generic.exe'),
      path.join(EXEC_DIR, 'bridge', 'WbaseBridge.exe'),
      path.join(process.cwd(), 'WbaseBridge.exe'),
      path.join(process.cwd(), 'bridge', 'lazarus', 'WbaseBridge.exe')
    ];
    for (const p of cands) if (existsOnRealDisk(p)) return p;
    return cands[0];
  },
  getDbfBridgePath() {
    const cands = [
      path.join(EXEC_DIR, 'DBFBridge.exe'),
      path.join(EXEC_DIR, 'bridge', 'lazarus', 'DBFBridge.exe'),
      path.join(process.cwd(), 'DBFBridge.exe'),
      path.join(process.cwd(), 'bridge', 'lazarus', 'DBFBridge.exe')
    ];
    for (const p of cands) if (existsOnRealDisk(p)) return p;
    return cands[0];
  }
};

// ========== DBF Bridge 串列執行隊列 (保證單一 DBF/COM 不撞檔) ==========
let dbfQueue = Promise.resolve();

function callDbfBridge(reqObj) {
  const run = () => new Promise((resolve) => {
    const bridgeExe = CONFIG.getDbfBridgePath();
    if (!existsOnRealDisk(bridgeExe)) {
      resolve({ success: false, error: `DBFBridge.exe 不存在於實體磁碟: ${bridgeExe}` });
      return;
    }

    const jsonStr = typeof reqObj === 'string' ? reqObj : JSON.stringify(reqObj);
    const b64 = Buffer.from(jsonStr, 'utf8').toString('base64');

    const child = spawn(bridgeExe, [b64], {
      cwd: path.dirname(bridgeExe),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdoutData = '';
    let stderrData = '';
    let resolved = false;

    child.stdout.on('data', (d) => { stdoutData += d.toString('utf8'); });
    child.stderr.on('data', (d) => { stderrData += d.toString('utf8'); });

    child.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        resolve({ success: false, error: 'DBFBridge 進程啟動失敗: ' + err.message });
      }
    });

    child.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        const out = stdoutData.trim();
        try {
          const parsed = JSON.parse(out);
          resolve(parsed);
        } catch (e) {
          if (code === 0 && out) {
            resolve({ success: true, raw: out });
          } else {
            resolve({
              success: false,
              error: `DBFBridge 輸出非合法 JSON (Exit code ${code}): ${out || stderrData}`
            });
          }
        }
      }
    });
  });

  const next = dbfQueue.then(run, run);
  dbfQueue = next;
  return next;
}

let koffi = null;
try { koffi = require('koffi'); } catch (e) { console.warn('koffi not installed, 請 npm install koffi 或用 bridge 模式'); }

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
  } catch (e) {
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
    const last = args[args.length - 1];
    if (typeof last === 'string' && (last.includes(':\\') || last.includes('/'))) {
      try { const dir = path.dirname(last); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch (e) { }
    }
    const ret = fn(...args);
    return { success: true, mode: 'koffi', dll: dllKey, func: funcName, retCode: ret };
  } catch (e) {
    return { success: false, mode: 'koffi', error: e.message };
  }
}

function callViaBridge(dllKey, funcName, args) {
  return new Promise((resolve) => {
    const bridgePath = CONFIG.getBridgePath();
    console.log(`bridgePath: ${bridgePath}`);
    if (!existsOnRealDisk(bridgePath)) {
      resolve({ success: false, mode: 'bridge', error: `Bridge not found on real disk: ${bridgePath}` });
      return;
    }
    // 使用 Base64 編碼傳遞 JSON 參數，徹底避免 Windows 命令行引號與反斜線轉義問題
    const argsJson = Buffer.from(JSON.stringify(args), 'utf8').toString('base64');
    const dllPath = (CONFIG.getDllPath(dllKey) || dllKey).replace(/\\/g, '/');
    const cmdArgs = ['--dll', dllPath, '--func', funcName, '--args', argsJson, '--dllkey', dllKey];

    let resolved = false;
    let stdoutData = '';
    let stderrData = '';

    try {
      const child = spawn(bridgePath, cmdArgs, {
        cwd: path.dirname(bridgePath),
        windowsHide: false,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      child.stdout?.on('data', (d) => { stdoutData += d.toString(); });
      child.stderr?.on('data', (d) => { stderrData += d.toString(); });
      child.stdout?.on('error', (e) => { console.warn('[child stdout]', e.message); });
      child.stderr?.on('error', (e) => { console.warn('[child stderr]', e.message); });

      child.on('error', (err) => {
        if (resolved) return;
        resolved = true;
        resolve({ success: false, mode: 'bridge', error: err.message });
      });

      child.on('close', (code) => {
        if (resolved) return;
        resolved = true;
        const out = stdoutData.trim();
        if (out.includes('OK:')) {
          const m = out.match(/OK:(-?\d+)/);
          resolve({ success: true, mode: 'bridge', retCode: m ? parseInt(m[1]) : 0, raw: out });
        } else {
          resolve({ success: false, mode: 'bridge', error: out || stderrData || `Exit code: ${code}` });
        }
      });

      // 若為預覽模式 (IsPrint = 0)，進程啟動成功且穩定運作 600ms 後即先行回覆前端成功，並徹底釋放進程與管線
      const isPreview = Array.isArray(args) && args.length >= 5 && Number(args[4]) === 0;
      if (isPreview) {
        setTimeout(() => {
          if (!resolved && !child.killed && child.exitCode === null) {
            resolved = true;
            try {
              child.stdout?.removeAllListeners();
              child.stderr?.removeAllListeners();
              child.stdout?.destroy();
              child.stderr?.destroy();
              child.unref();
            } catch (e) {}
            resolve({ success: true, mode: 'bridge', message: '報表預覽視窗已成功開啟', pid: child.pid });
          }
        }, 600);
      }
    } catch (spawnErr) {
      if (!resolved) {
        resolved = true;
        resolve({ success: false, mode: 'bridge', error: spawnErr.message });
      }
    }
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
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, macs: getMacs() }));
    return;
  }
  if (url.pathname === '/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ mode: CONFIG.MODE, dlls: DLL_CONFIG, bridgeExists: fs.existsSync(CONFIG.getBridgePath()) }));
    return;
  }
  if (url.pathname === '/dllList') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(DLL_CONFIG));
    return;
  }

  // ========== DBF Bridge API (/api/dbf/*) ==========
  if (url.pathname.startsWith('/api/dbf/')) {
    const dbfAction = url.pathname.replace('/api/dbf/', '').toUpperCase();

    if (req.method === 'GET') {
      if (dbfAction === 'PING') {
        const result = await callDbfBridge({ action: 'PING' });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
        return;
      }
      if (dbfAction === 'CHECKSUM') {
        const filePath = url.searchParams.get('path') || url.searchParams.get('filePath') || '';
        const dbfPath = url.searchParams.get('dbfPath') || '';
        const dbfName = url.searchParams.get('dbfName') || '';
        const result = await callDbfBridge({ action: 'CHECKSUM', filePath, dbfPath, dbfName });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
        return;
      }
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (dbfAction === 'CALL') {
            const result = await callDbfBridge(payload);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(result));
            return;
          }

          const reqPayload = { action: dbfAction, ...payload };
          const result = await callDbfBridge(reqPayload);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }
  }

  // 相容 POST /report, /waccrep3101_b, /wbase320_buyinv 及 /wbase350_buyinv_list
  if ((url.pathname === '/report' || url.pathname === '/waccrep3101_b' || url.pathname === '/wbase320_buyinv' || url.pathname === '/wbase350_buyinv_list') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const funcName = data.func || (url.pathname.replace('/', '') || 'waccrep3101_b');
        let targetPath = data.path || '';

        // 若有傳入 jsonData，自動產生暫存檔路徑
        if (data.jsonData !== undefined) {
          const tempDir = path.join(os.tmpdir(), 'Wx3000');
          if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
          const tempFilePath = path.join(tempDir, `report_data_${Date.now()}.json`).replace(/\\/g, '/');
          fs.writeFileSync(tempFilePath, typeof data.jsonData === 'string' ? data.jsonData : JSON.stringify(data.jsonData, null, 2), 'utf8');
          targetPath = tempFilePath;
        }

        const args = funcName === 'wbase350_buyinv_list' ? [
          data.hs_chk !== undefined ? Number(data.hs_chk) : 0.125,
          data.top_mag !== undefined ? Number(data.top_mag) : 0.0,
          data.left_mag !== undefined ? Number(data.left_mag) : 0.0,
          data.PrtIndex !== undefined ? Number(data.PrtIndex) : 0,
          data.IsPrint !== undefined ? Number(data.IsPrint) : 0,
          data.rep_type !== undefined ? Number(data.rep_type) : 1,
          targetPath
        ] : [
          data.hs_chk !== undefined ? Number(data.hs_chk) : 0.125,
          data.top_mag !== undefined ? Number(data.top_mag) : 0.0,
          data.left_mag !== undefined ? Number(data.left_mag) : 0.0,
          data.PrtIndex !== undefined ? Number(data.PrtIndex) : 0,
          data.IsPrint !== undefined ? Number(data.IsPrint) : 0,
          targetPath
        ];
        const result = await genericCall('wbaseRP', funcName, args);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }
  // 相容 GET /report, /waccrep3101_b 及 /wbase320_buyinv
  if ((url.pathname === '/report' || url.pathname === '/waccrep3101_b' || url.pathname === '/wbase320_buyinv' || url.pathname === '/wbase350_buyinv_list') && req.method === 'GET') {
    try {
      const funcName = url.searchParams.get('func') || (url.pathname.replace('/', '') || 'waccrep3101_b');
      const args = funcName === 'wbase350_buyinv_list' ? [
        parseFloat(url.searchParams.get('hs_chk') || '0.125'),
        parseFloat(url.searchParams.get('top_mag') || '0'),
        parseFloat(url.searchParams.get('left_mag') || '0'),
        parseInt(url.searchParams.get('PrtIndex') || '0'),
        parseInt(url.searchParams.get('IsPrint') || '0'),
        parseInt(url.searchParams.get('rep_type') || '1'),
        url.searchParams.get('path') || ''
      ] : [
        parseFloat(url.searchParams.get('hs_chk') || '0.125'),
        parseFloat(url.searchParams.get('top_mag') || '0'),
        parseFloat(url.searchParams.get('left_mag') || '0'),
        parseInt(url.searchParams.get('PrtIndex') || '0'),
        parseInt(url.searchParams.get('IsPrint') || '0'),
        url.searchParams.get('path') || ''
      ];
      const result = await genericCall('wbaseRP', funcName, args);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: e.message }));
      return;
    }
  }
  // 舊相容
  if (url.pathname === '/wbaseReport') {
    const args = [
      parseFloat(url.searchParams.get('hs_chk') || '0'),
      parseFloat(url.searchParams.get('top_mag') || '0'),
      parseFloat(url.searchParams.get('left_mag') || '0'),
      parseInt(url.searchParams.get('PrtIndex') || '0'),
      parseInt(url.searchParams.get('IsPrint') || '0'),
      url.searchParams.get('path') || 'C:\\temp\\wbase_report.pdf'
    ];
    const result = await genericCall('wbaseRP', 'waccrep3101_b', args);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
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
        let callArgs = data.args || [];

        // 若請求帶有 jsonData，自動將資料寫入本機暫存 JSON 檔案，並將路徑帶入 args 最後一個參數
        if (data.jsonData !== undefined) {
          const tempDir = path.join(os.tmpdir(), 'Wx3000');
          if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
          const tempFilePath = path.join(tempDir, `report_data_${Date.now()}.json`).replace(/\\/g, '/');
          fs.writeFileSync(tempFilePath, typeof data.jsonData === 'string' ? data.jsonData : JSON.stringify(data.jsonData, null, 2), 'utf8');
          console.log(`[LocalAgent] 自動建立 JSON 暫存檔: ${tempFilePath}`);

          if (callArgs.length > 0) {
            callArgs[callArgs.length - 1] = tempFilePath;
          } else {
            callArgs.push(tempFilePath);
          }
        }

        // 確保所有字串參數路徑斜線格式正確
        callArgs = callArgs.map(arg => typeof arg === 'string' ? arg.replace(/\\/g, '/') : arg);

        const result = await genericCall(data.dll, data.func, callArgs);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
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
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
      return;
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: e.message }));
      return;
    }
  }
  if (url.pathname === '/' || url.pathname === '/test.html') {
    const p = path.join(__dirname, 'test.html');
    if (fs.existsSync(p)) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(fs.readFileSync(p)); return; }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not Found');
});

const wss = new WebSocket.Server({ server });
wss.on('connection', (ws) => {
  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.cmd === 'mac') ws.send(JSON.stringify({ cmd: 'mac', success: true, macs: getMacs() }));
      if (data.cmd === 'dllList') ws.send(JSON.stringify({ cmd: 'dllList', ...DLL_CONFIG }));
      if (data.cmd === 'setMode') { CONFIG.MODE = data.mode; ws.send(JSON.stringify({ cmd: 'setMode', success: true, mode: CONFIG.MODE })); }
      if (data.cmd === 'call') {
        const r = await genericCall(data.dll, data.func, data.args || []);
        ws.send(JSON.stringify({ cmd: 'call', ...r }));
      }
      if (data.cmd === 'wbaseReport') {
        const r = await genericCall('wbaseRP', 'waccrep3101_b', [data.hs_chk, data.top_mag, data.left_mag, data.PrtIndex, data.IsPrint, data.path]);
        ws.send(JSON.stringify({ cmd: 'wbaseReport', ...r }));
      }
      if (data.cmd === 'dbf' || data.cmd === 'dbf_call') {
        const r = await callDbfBridge(data.payload || data);
        ws.send(JSON.stringify({ cmd: data.cmd, ...r }));
      }
    } catch (e) { ws.send(JSON.stringify({ success: false, error: e.message })); }
  });
});

server.listen(CONFIG.PORT, () => {
  console.log(`Wx3000Agent v26 generic http://localhost:${CONFIG.PORT} MODE=${CONFIG.MODE}`);
});
