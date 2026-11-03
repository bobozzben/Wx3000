const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { execFile, spawn } = require('child_process');
const { StringDecoder } = require('string_decoder');

let iconv;
try {
  iconv = require('iconv-lite');
} catch (e) {
  // iconv-lite optional fallback
}

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// ========== 實體磁碟路徑輔助 (防止 pkg 虛擬路徑 C:\snapshot\ 導致 spawn/LoadLibrary ENOENT) ==========
const EXEC_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;

// 串流每段約 64KB，切點可能落在多位元組字元中間，必須跨段解碼；逐段 toString 會把中文變成 U+FFFD
function collectUtf8(stream) {
  const decoder = new StringDecoder('utf8');
  let text = '';
  stream.on('data', (chunk) => { text += decoder.write(chunk); });
  return () => text + decoder.end();
}

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
  PORT: 5009,
  // 只監聽本機。同時綁 IPv4/IPv6，避免 localhost 先解析到 ::1 時連線被拒而延遲
  HOSTS: ['127.0.0.1', '::1'],
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

    let resolved = false;

    const getStdout = collectUtf8(child.stdout);
    const getStderr = collectUtf8(child.stderr);

    child.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        resolve({ success: false, error: 'DBFBridge 進程啟動失敗: ' + err.message });
      }
    });

    child.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        const out = getStdout().trim();
        try {
          const parsed = JSON.parse(out);
          resolve(parsed);
        } catch (e) {
          if (code === 0 && out) {
            resolve({ success: true, raw: out });
          } else {
            resolve({
              success: false,
              error: `DBFBridge 輸出非合法 JSON (Exit code ${code}): ${out || getStderr()}`
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

// 預覽關閉後 Bridge 還要輸出 OK:n，管線只能 unref 不能關閉，否則它會寫入失敗而異常結束
function releasePreviewChild(child) {
  child.stdout?.unref?.();
  child.stderr?.unref?.();
  child.unref();
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
    const dllPath = CONFIG.getDllPath(dllKey).replace(/\\/g, '/');
    const cmdArgs = ['--dll', dllPath, '--func', funcName, '--args', argsJson, '--dllkey', dllKey];

    let resolved = false;

    try {
      const child = spawn(bridgePath, cmdArgs, {
        cwd: path.dirname(bridgePath),
        windowsHide: false,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      const getStdout = collectUtf8(child.stdout);
      const getStderr = collectUtf8(child.stderr);
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
        const out = getStdout().trim();
        if (out.includes('OK:')) {
          const m = out.match(/OK:(-?\d+)/);
          resolve({ success: true, mode: 'bridge', retCode: m ? parseInt(m[1]) : 0, raw: out });
        } else {
          resolve({ success: false, mode: 'bridge', error: out || getStderr() || `Exit code: ${code}` });
        }
      });

      // 若為預覽模式 (IsPrint = 0)，進程啟動成功且穩定運作 600ms 後即先行回覆前端成功
      const isPreview = Array.isArray(args) && args.length >= 5 && Number(args[4]) === 0;
      if (isPreview) {
        setTimeout(() => {
          if (!resolved && !child.killed && child.exitCode === null) {
            resolved = true;
            releasePreviewChild(child);
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

// 只允許呼叫 dlls.json 明確登記的 DLL 與函數，呼叫端傳入的名稱絕不當成檔案路徑
function isAllowedDllCall(dllKey, funcName) {
  const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const dlls = DLL_CONFIG.dlls || {};
  return typeof dllKey === 'string' && typeof funcName === 'string' &&
    hasOwn(dlls, dllKey) && hasOwn(dlls[dllKey].functions || {}, funcName);
}

async function genericCall(dllKey, funcName, args) {
  if (!isAllowedDllCall(dllKey, funcName)) {
    return { success: false, errorType: 'FORBIDDEN', error: `未開放的 DLL 函數: ${dllKey}.${funcName}` };
  }
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

function toVfpLiteral(val) {
  if (val === null || val === undefined) return "''";
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '.T.' : '.F.';
  const str = String(val);
  // 若包含換行或引號，以 Base64 + CP950 編碼，透過 VFP 原生 STRCONV(..., 14) 解碼，保證 100% 免疫語法錯誤與亂碼
  if (str.includes('\r') || str.includes('\n') || str.includes("'") || str.includes('"')) {
    const buf = iconv ? iconv.encode(str, 'cp950') : Buffer.from(str, 'utf8');
    const b64 = buf.toString('base64');
    return `STRCONV("${b64}", 14)`;
  }
  return `'${str}'`;
}

function buildWhereClause(keyField, keyValue) {
  const parseSingle = (k, v) => {
    k = (k || '').trim();
    v = (v || '').trim();
    if (k.startsWith('ALLTRIM(') || k.startsWith('STR(') || k.startsWith('VAL(') || k.startsWith('TRANSFORM(')) {
      return `${k} == ${toVfpLiteral(v)}`;
    }
    // 使用 ALLTRIM(TRANSFORM(field)) 能 100% 同時相容字串、數值、日期等所有資料型態
    return `ALLTRIM(TRANSFORM(${k})) == ${toVfpLiteral(v)}`;
  };

  if (keyField.includes(',')) {
    const keys = keyField.split(',');
    const vals = (keyValue || '').split(',');
    const conds = [];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i].trim();
      if (!k) continue;
      const v = (vals[i] || '').trim();
      conds.push(parseSingle(k, v));
    }
    return conds.join(' AND ');
  }
  return parseSingle(keyField, keyValue);
}

// 別名、欄位名與鍵值運算式會直接組進 VFP 腳本，必須限制為識別字，否則等於可執行任意 VFP 指令
const VFP_NAME = '[\\p{L}_][\\p{L}\\p{N}_]*';
const VFP_IDENTIFIER = new RegExp(`^${VFP_NAME}$`, 'u');
const VFP_KEY_TERM = `(?:${VFP_NAME}|RECNO\\(\\))`;
const VFP_KEY_EXPR = new RegExp(`^(?:${VFP_KEY_TERM}|(?:ALLTRIM|STR|VAL|TRANSFORM)\\(${VFP_KEY_TERM}\\))$`, 'u');

function validateDbfWrite(cAlias, keyField, fields) {
  if (!VFP_IDENTIFIER.test(cAlias)) return `不合法的 DBF 名稱: ${cAlias}`;
  const badKey = String(keyField).split(',').map((k) => k.trim()).find((k) => !VFP_KEY_EXPR.test(k));
  if (badKey !== undefined) return `不合法的鍵值欄位: ${badKey}`;
  const badField = Object.keys(fields).find((k) => !VFP_IDENTIFIER.test(k));
  if (badField !== undefined) return `不合法的欄位名稱: ${badField}`;
  return null;
}

async function executeDbfWrite(payload) {
  const operation = (payload.operation || 'UPDATE').toUpperCase();
  const dbfPath = payload.dbfPath || 'C:\\w3000\\comm';
  const dbfName = payload.dbfName || 'keyin';
  const keyField = payload.keyField || 'no';
  const keyValue = payload.keyValue || '';
  const fields = payload.fields || {};

  const cAlias = path.basename(dbfName, path.extname(dbfName));
  const invalid = validateDbfWrite(cAlias, keyField, fields);
  if (invalid) {
    return { success: false, errorType: 'INVALID_REQUEST', error: invalid };
  }
  const fullPath = path.join(dbfPath, cAlias + (cAlias.toLowerCase().endsWith('.dbf') ? '' : '.dbf'));
  if (!fs.existsSync(fullPath)) {
    return { success: false, error: `找不到 DBF 檔案: ${fullPath}` };
  }

  const vfpFullPath = fullPath.replace(/\\/g, '\\\\');
  const whereClause = buildWhereClause(keyField, keyValue);

  let script = '';
  if (operation === 'INSERT') {
    const cols = Object.keys(fields).join(', ');
    const vals = Object.values(fields).map(toVfpLiteral).join(', ');
    script = [
      `USE "${vfpFullPath}" IN 0 ALIAS ${cAlias} SHARED AGAIN`,
      `SELECT ${cAlias}`,
      `INSERT INTO ${cAlias} (${cols}) VALUES (${vals})`,
      `lnRec = RECNO("${cAlias}")`,
      `USE IN ${cAlias}`,
      `RETURN TRANSFORM(lnRec)`
    ].join('\r\n');
  } else if (operation === 'UPDATE') {
    // 採用 FoxPro 原生 REPLACE [alias.]field WITH ...，徹底避免 SQL UPDATE 遇到保留字 (如 desc, order, date, status 等) 拋出語法錯誤 10
    const replList = Object.entries(fields).map(([k, v]) => `${cAlias}.${k} WITH ${toVfpLiteral(v)}`);
    const cReplace = replList.length > 0 ? `REPLACE ${replList.join(', ')}` : `* no fields to update`;
    script = [
      `USE "${vfpFullPath}" IN 0 ALIAS ${cAlias} SHARED AGAIN`,
      `SELECT ${cAlias}`,
      `LOCATE FOR ${whereClause}`,
      `IF EOF()`,
      `  USE IN ${cAlias}`,
      `  RETURN "RECORD_NOT_FOUND"`,
      `ENDIF`,
      `lnRec = RECNO("${cAlias}")`,
      cReplace,
      `USE IN ${cAlias}`,
      `RETURN TRANSFORM(lnRec)`
    ].join('\r\n');
  } else if (operation === 'DELETE') {
    script = [
      `USE "${vfpFullPath}" IN 0 ALIAS ${cAlias} SHARED AGAIN`,
      `SELECT ${cAlias}`,
      `LOCATE FOR ${whereClause}`,
      `IF EOF()`,
      `  USE IN ${cAlias}`,
      `  RETURN "RECORD_NOT_FOUND"`,
      `ENDIF`,
      `lnRec = RECNO("${cAlias}")`,
      `DELETE`,
      `USE IN ${cAlias}`,
      `RETURN TRANSFORM(lnRec)`
    ].join('\r\n');
  } else {
    return { success: false, error: `未知的操作類型: ${operation}` };
  }

  const execRes = await callDbfBridge({ action: 'EXEC_VFP', script });
  if (!execRes.success) {
    return execRes;
  }
  if (execRes.result === 'RECORD_NOT_FOUND') {
    return {
      success: false,
      errorType: 'RECORD_NOT_FOUND',
      error: `找不到欲${operation === 'DELETE' ? '刪除' : '更新'}的記錄: ${whereClause}`
    };
  }
  const recno = parseInt(execRes.result, 10) || 0;
  return {
    success: true,
    operation,
    recno,
    elapsedMs: execRes.elapsedMs
  };
}

// ========== 存取控制 ==========
// 正式環境的前端由 http://<主機>:5007 提供，主機位址無法事先得知，因此放行內網位址與單段主機名；
// 其他網域 (如 ngrok、企業內網 FQDN) 請以逗號分隔設定於環境變數 WX3000_AGENT_ALLOWED_ORIGINS
const EXTRA_ALLOWED_ORIGINS = new Set(
  (process.env.WX3000_AGENT_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
);

function isAllowedOrigin(origin) {
  if (EXTRA_ALLOWED_ORIGINS.has(String(origin).toLowerCase())) return true;
  let parsed;
  try { parsed = new URL(origin); } catch (e) { return false; }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  if (host === '[::1]') return true;
  if (net.isIPv4(host)) return /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  return /^[a-z0-9-]+$/.test(host); // localhost 與 SERVER01 這類單段主機名
}

function isLoopbackHost(hostHeader) {
  const host = String(hostHeader || '').replace(/:\d+$/, '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

// 無副作用且瀏覽器跨站也讀不到回應的端點 (Electron file:// 頁面的 GET 不帶 Origin，需要放行)
const READ_ONLY_PATHS = new Set(['/', '/test.html', '/mac', '/config', '/dllList', '/api/check-drive', '/api/dbf/check_drive']);

// 回傳拒絕原因；可放行時回傳 null
function authorizeRequest(req, pathname) {
  // 防 DNS rebinding：對瀏覽器而言 evil.com:5009 是同源，只有 Host 看得出來
  if (!isLoopbackHost(req.headers.host)) return 'Host 不允許';

  const origin = req.headers.origin;
  const site = req.headers['sec-fetch-site'];

  // DBF 端點只供本機後端與診斷腳本使用，這些呼叫端不會帶瀏覽器標頭
  if (pathname.startsWith('/api/dbf/') && !READ_ONLY_PATHS.has(pathname) && (origin !== undefined || site !== undefined)) {
    return '此端點不開放瀏覽器呼叫';
  }

  if (origin !== undefined) return isAllowedOrigin(origin) ? null : 'Origin 不允許';

  // 沒有 Origin 的跨站請求：瀏覽器的 POST 一定帶 Origin，所以這只會是 Electron file:// 頁面 (webSecurity: false)；
  // GET 則可能是惡意網頁的 <img>，只放行唯讀端點
  if (site === 'cross-site' || site === 'same-site') {
    const isSafeRead = (req.method === 'GET' || req.method === 'HEAD') && READ_ONLY_PATHS.has(pathname);
    const isElectronPost = req.method === 'POST';
    if (!isSafeRead && !isElectronPost) return '拒絕跨站請求';
  }
  return null;
}

// 可由 HTTP 轉送給 DBFBridge 的動作白名單；EXEC_VFP 只能由 executeDbfWrite 內部使用
const DBF_BRIDGE_ACTIONS = new Set(['PING', 'CHECKSUM', 'READ', 'GET_PG_SCRIPT']);

function buildDbfBridgeRequest(action, payload) {
  if (!DBF_BRIDGE_ACTIONS.has(action)) return null;
  return { ...payload, action }; // action 放最後，呼叫端的 payload 不可覆寫
}

// ========== HTTP + WS ==========
const handleRequest = async (req, res) => {
  const url = new URL(req.url, `http://localhost:${CONFIG.PORT}`);

  const denied = authorizeRequest(req, url.pathname);
  if (denied) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, errorType: 'FORBIDDEN', error: denied }));
    return;
  }

  res.setHeader('Vary', 'Origin');
  if (req.headers.origin !== undefined) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

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
  if (url.pathname === '/api/check-drive' || url.pathname === '/api/dbf/check_drive') {
    const rawDrive = (url.searchParams.get('drive') || 'C').trim();
    const match = rawDrive.match(/^[A-Za-z]/);
    const drive = match ? match[0].toUpperCase() : 'C';
    const targetDir = `${drive}:\\W3000`;
    const exists = fs.existsSync(targetDir);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      success: exists,
      exists,
      drive,
      path: targetDir,
      message: exists
        ? `磁碟機 ${drive}: 檢查通過，已偵測到 W3000 目錄`
        : `磁碟機 ${drive}: 下找不到 W3000 目錄 (路徑: ${targetDir} 不存在)`
    }));
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
      const getBody = collectUtf8(req);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(getBody() || '{}');

          if (dbfAction === 'WRITE') {
            const result = await executeDbfWrite(payload);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(result));
            return;
          }

          const reqPayload = buildDbfBridgeRequest(dbfAction, payload);
          if (!reqPayload) {
            res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, error: `未知的 DBF 動作: ${dbfAction}` }));
            return;
          }
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
    const getBody = collectUtf8(req);
    req.on('end', async () => {
      try {
        const data = JSON.parse(getBody() || '{}');
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
    const getBody = collectUtf8(req);
    req.on('end', async () => {
      try {
        const data = JSON.parse(getBody());
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
};

const wss = new WebSocket.Server({ noServer: true });
wss.on('connection', (ws) => {
  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.cmd === 'mac') ws.send(JSON.stringify({ cmd: 'mac', success: true, macs: getMacs() }));
      if (data.cmd === 'dllList') ws.send(JSON.stringify({ cmd: 'dllList', ...DLL_CONFIG }));
      if (data.cmd === 'setMode') {
        const validMode = data.mode === 'bridge' || data.mode === 'koffi';
        if (validMode) CONFIG.MODE = data.mode;
        ws.send(JSON.stringify({ cmd: 'setMode', success: validMode, mode: CONFIG.MODE }));
      }
      if (data.cmd === 'call') {
        const r = await genericCall(data.dll, data.func, data.args || []);
        ws.send(JSON.stringify({ cmd: 'call', ...r }));
      }
      if (data.cmd === 'wbaseReport') {
        const r = await genericCall('wbaseRP', 'waccrep3101_b', [data.hs_chk, data.top_mag, data.left_mag, data.PrtIndex, data.IsPrint, data.path]);
        ws.send(JSON.stringify({ cmd: 'wbaseReport', ...r }));
      }
    } catch (e) { ws.send(JSON.stringify({ success: false, error: e.message })); }
  });
});

function startServers() {
  for (const host of CONFIG.HOSTS) {
    const server = http.createServer(handleRequest);
    server.on('upgrade', (req, socket, head) => {
      const { pathname } = new URL(req.url, `http://localhost:${CONFIG.PORT}`);
      if (authorizeRequest(req, pathname)) {
        socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    });
    server.on('error', (err) => {
      console.error(`[LISTEN] ${host}:${CONFIG.PORT} 監聽失敗: ${err.message}`);
    });
    server.listen(CONFIG.PORT, host, () => {
      console.log(`Wx3000Agent v26 generic http://${net.isIPv6(host) ? `[${host}]` : host}:${CONFIG.PORT} MODE=${CONFIG.MODE}`);
    });
  }
}

if (require.main === module || process.pkg) startServers();

module.exports = {
  collectUtf8,
  isAllowedDllCall,
  genericCall,
  validateDbfWrite,
  buildWhereClause,
  executeDbfWrite,
  isAllowedOrigin,
  authorizeRequest,
  buildDbfBridgeRequest,
  releasePreviewChild,
  handleRequest
};
