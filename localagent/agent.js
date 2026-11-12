const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const crypto = require('crypto');
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

// 把一個動作排進隊列；前一個動作結束後才開始，同一時間只有一個動作在執行
function enqueueDbf(task) {
  const next = dbfQueue.then(task, task);
  dbfQueue = next.catch(() => {});
  return next;
}

// 排進隊列，但最多等 timeoutMs 毫秒 (0 表示不限)：輪到之前就逾時，或 isCancelled() 表示呼叫端已經離開，就不執行 task。
// 回傳 { value } (已執行)、{ error } (task 拋出例外) 或 { skipped: 'QUEUE_TIMEOUT' | 'CLIENT_GONE' } (沒有執行)。
// 寫入一定要用這個：後端等不到回覆就會告訴使用者失敗，之後才執行的寫入等於偷偷存進 DBF。
function enqueueDbfWithin(task, { timeoutMs = 0, isCancelled } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = timeoutMs > 0
      ? setTimeout(() => {
          if (!settled) { settled = true; resolve({ skipped: 'QUEUE_TIMEOUT' }); }
        }, timeoutMs)
      : null;
    enqueueDbf(async () => {
      if (timer) clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (isCancelled && isCancelled()) {
        resolve({ skipped: 'CLIENT_GONE' });
        return;
      }
      try {
        resolve({ value: await task() });
      } catch (error) {
        resolve({ error });
      }
    });
  });
}

function callDbfBridge(reqObj) {
  return enqueueDbf(() => runDbfBridge(reqObj));
}

// bridgeExe 只有測試會指定 (用真的 VFP 驗證寫入腳本)
function runDbfBridge(reqObj, bridgeExe = CONFIG.getDbfBridgePath()) {
  return new Promise((resolve) => {
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
}

// ========== 寫入前後的 DBF 比對 (讓後端判斷快照能否直接沿用) ==========
// 與 DBFBridge CHECKSUM (VFP CheckSum_SHA256) 相同的格式：小寫 SHA-256 hex + ":" + 檔案位元組數
function dbfChecksum(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex') + ':' + buf.length;
}

/**
 * 優先直接在 Node.js 讀取 DBF 計算 SHA-256 Checksum (~1ms)，避免每次進畫面都 spawn 32-bit DBFBridge.exe (~600ms)；
 * 僅當檔案無法直接讀取（例如被 VFP 獨佔開啟）時才退回 DBFBridge。
 */
async function executeDbfChecksum(payload = {}) {
  let targetPath = String(payload.filePath || payload.path || '').trim();
  if (!targetPath && payload.dbfPath && payload.dbfName) {
    targetPath = path.join(String(payload.dbfPath), String(payload.dbfName));
  }
  if (targetPath && !targetPath.toLowerCase().endsWith('.dbf')) {
    targetPath += '.dbf';
  }
  if (targetPath) {
    const buf = await enqueueDbf(() => readFileOrNull(targetPath));
    if (buf !== null) {
      return { success: true, filePath: targetPath, checksum: dbfChecksum(buf) };
    }
  }
  return callDbfBridge(buildDbfBridgeRequest('CHECKSUM', payload));
}

async function readFileOrNull(filePath) {
  try {
    return await fs.promises.readFile(filePath);
  } catch (e) {
    return null;
  }
}

function parseDbfLayout(buf) {
  if (!buf || buf.length < 32) return null;
  const count = buf.readUInt32LE(4);
  const headerLen = buf.readUInt16LE(8);
  const recLen = buf.readUInt16LE(10);
  if (headerLen < 33 || recLen < 1 || headerLen > buf.length) return null;
  const fields = new Map();
  let off = 32;
  let pos = 1; // 每筆的第 0 個位元組是刪除旗標
  while (off + 32 <= headerLen && buf[off] !== 0x0d) {
    const name = buf.toString('latin1', off, off + 11).replace(/\0[\s\S]*$/, '').toLowerCase();
    const len = buf[off + 16];
    fields.set(name, { offset: pos, len });
    pos += len;
    off += 32;
  }
  return { count, headerLen, recLen, fields };
}

// 確認寫入前後的差異只落在這次寫入會動到的位元組：
//   檔頭前 32 個位元組 (最後更新日期、記錄數)，以及
//   INSERT 新增的那一筆與其後的檔尾標記；UPDATE 該筆中有寫的欄位與 _nullflags；DELETE 該筆的刪除旗標。
// 其他位元組有變動，代表舊系統或其他程式在同一段時間也改了這個檔案。
function onlyExpectedChanges(before, after, { operation, recno, fieldNames = [] }) {
  const lb = parseDbfLayout(before);
  const la = parseDbfLayout(after);
  if (!lb || !la || lb.headerLen !== la.headerLen || lb.recLen !== la.recLen || !(recno > 0)) return false;

  const recStart = la.headerLen + (recno - 1) * la.recLen;
  const allowed = [[0, 32]];
  if (operation === 'INSERT') {
    if (la.count !== lb.count + 1 || recno !== la.count) return false;
    allowed.push([recStart, Math.max(before.length, after.length)]);
  } else {
    if (la.count !== lb.count || before.length !== after.length || recno > la.count) return false;
    if (operation === 'DELETE') {
      allowed.push([recStart, recStart + 1]);
    } else {
      for (const name of fieldNames.map((n) => String(n).toLowerCase())) {
        const f = la.fields.get(name);
        if (!f) return false;
        allowed.push([recStart + f.offset, recStart + f.offset + f.len]);
      }
      const nullFlags = la.fields.get('_nullflags');
      if (nullFlags) allowed.push([recStart + nullFlags.offset, recStart + nullFlags.offset + nullFlags.len]);
    }
  }

  allowed.sort((a, b) => a[0] - b[0]);
  const end = Math.max(before.length, after.length);
  let cursor = 0;
  for (const [start, stop] of [...allowed, [end, end]]) {
    if (start > cursor) {
      if (start > before.length || start > after.length) return false;
      if (!before.subarray(cursor, start).equals(after.subarray(cursor, start))) return false;
    }
    cursor = Math.max(cursor, stop);
  }
  return true;
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

// 日期 (D) 欄位以 { "$date": "YYYY-MM-DD" } 傳入，空字串或 null 代表空日期；
// 一般字串一律當字元值，避免把剛好長得像日期的 C 欄位內容誤轉成日期
const DATE_VALUE_KEY = '$date';
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isDateValue(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val) &&
    Object.keys(val).length === 1 && Object.prototype.hasOwnProperty.call(val, DATE_VALUE_KEY);
}

function isValidIsoDate(str) {
  const m = ISO_DATE.exec(str);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return y >= 1 && dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function isValidFieldValue(val) {
  if (val === null || val === undefined || typeof val === 'string' || typeof val === 'boolean') return true;
  if (typeof val === 'number') return Number.isFinite(val);
  if (isDateValue(val)) {
    const d = val[DATE_VALUE_KEY];
    return d === null || d === '' || (typeof d === 'string' && isValidIsoDate(d));
  }
  return false;
}

function toVfpLiteral(val) {
  if (val === null || val === undefined) return "''";
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '.T.' : '.F.';
  if (isDateValue(val)) {
    const d = val[DATE_VALUE_KEY];
    return d ? `{^${d}}` : '{}';
  }
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
  const badValue = Object.keys(fields).find((k) => !isValidFieldValue(fields[k]));
  if (badValue !== undefined) return `不合法的欄位值: ${badValue}`;
  return null;
}

// 鍵值含 RECNO() 的新增 (例如共用摘要以 "RECNO()","0" 新增) 本來就沒有可比對的鍵值
function shouldCheckDuplicateKey(operation, keyField, allowDuplicateKey) {
  return operation === 'INSERT' && !allowDuplicateKey && !/RECNO\(\)/i.test(String(keyField));
}

// 寫入最多排隊多久 (毫秒)：後端傳 queueTimeoutMs，要比它呼叫 LocalAgent 的逾時短，後端才收得到「沒有寫入」的明確回覆
const MAX_WRITE_QUEUE_MS = 10 * 60 * 1000;

// ========== 新增時的防重複與取號 ==========
// 後端判斷「新增或修改」或取 MAX()+1 時只看 PostgreSQL 快照，快照過期、多人同時新增或舊系統剛新增時 DBF 會重複 (DBF 沒有唯一限制)。
// 所以 INSERT 預設都在同一段 VFP 腳本內先查重 (shouldCheckDuplicateKey；後端可傳 allowDuplicateKey 略過，或傳 unique 明確要求)，
// 另可帶 autoNumber 由 VFP 以 CALCULATE MAX() 取號 (不含已刪除記錄)，號碼寫進 field 與 assignTo，回傳給後端寫 PostgreSQL；
// 有 autoNumber 時不做預設查重，因為 keyValue 裡的號碼只是後端由快照算的。
// 有查重或取號時先以 RLOCK("0") 鎖住檔頭：舊系統與其他程式的 APPEND / INSERT 會等到這段結束，修改既有記錄不受影響。
// 沒有用 FLOCK()：舊系統編輯記錄時常持有記錄鎖，FLOCK() 會讓網頁的新增經常失敗，實測檔頭鎖仍會成功。
// 舊版 LocalAgent 不認得 unique / autoNumber，會照原本的 INSERT 寫入 fields 裡的值，所以後端仍要在 fields 放入自己算的號碼。
const AUTO_NUMBER_PREFIX = /^[A-Za-z0-9]{1,10}$/;
const INSERT_LOCK_SECONDS = 2; // 檔頭被其他工作站鎖住時最多等幾秒

// 這些結果代表腳本沒有寫入任何東西 (DUPLICATE_KEY 後面接 ":<既有記錄的 RECNO>")
const isNoWriteResult = (result) => {
  const r = String(result ?? '');
  return r === 'RECORD_NOT_FOUND' || r === 'LOCK_TIMEOUT' || r.startsWith('DUPLICATE_KEY');
};

const isVfpKeyExpr = (expr) => typeof expr === 'string' && expr.trim() !== '' &&
  expr.split(',').every((k) => VFP_KEY_EXPR.test(k.trim()));

function validateInsertGuard(operation, { unique, autoNumber }) {
  if (unique !== undefined && unique !== null && typeof unique !== 'boolean') return 'unique 必須是 true 或 false';
  const hasAutoNumber = autoNumber !== undefined && autoNumber !== null;
  if (unique !== true && !hasAutoNumber) return null;
  if (operation !== 'INSERT') return 'unique / autoNumber 只能用於 INSERT';
  if (!hasAutoNumber) return null;
  if (typeof autoNumber !== 'object' || Array.isArray(autoNumber)) return 'autoNumber 格式錯誤';

  const { field, assignTo, scopeField, scopeValue, prefix, width } = autoNumber;
  if (typeof field !== 'string' || !VFP_IDENTIFIER.test(field)) return `不合法的取號欄位: ${field}`;
  if (assignTo !== undefined && (!Array.isArray(assignTo) || assignTo.some((f) => typeof f !== 'string' || !VFP_IDENTIFIER.test(f)))) {
    return `不合法的取號填入欄位: ${JSON.stringify(assignTo)}`;
  }
  if (scopeField !== undefined) {
    if (!isVfpKeyExpr(scopeField)) return `不合法的取號範圍欄位: ${scopeField}`;
    if (typeof scopeValue !== 'string') return '取號範圍的值必須是字串';
  }
  if (prefix !== undefined) {
    if (typeof prefix !== 'string' || !AUTO_NUMBER_PREFIX.test(prefix)) return `不合法的取號前綴: ${prefix}`;
    if (!Number.isInteger(width) || width < 1 || width > 18) return '取號前綴要搭配 1~18 的 width';
  } else if (width !== undefined) {
    return 'width 只能搭配 prefix';
  }
  return null;
}

/**
 * 組 INSERT / UPDATE / DELETE 的 VFP 腳本；呼叫前必須先通過 validateDbfWrite 與 validateInsertGuard。未知的操作回傳 null。
 * checkDuplicate (或 unique)：新增前在檔頭鎖內找未刪除、鍵值相同的記錄，有就回 "DUPLICATE_KEY:<RECNO>" 而不新增。
 * autoNumber：在檔頭鎖內以 CALCULATE MAX() 取號再新增，回 "OK<TAB>RECNO<TAB>號碼"。
 */
function buildDbfWriteScript({ operation, vfpFullPath, cAlias, keyField, keyValue, fields, checkDuplicate, unique, autoNumber }) {
  const whereClause = buildWhereClause(keyField, keyValue);
  const guard = checkDuplicate === true || unique === true;
  const open = [
    `USE "${vfpFullPath}" IN 0 ALIAS ${cAlias} SHARED AGAIN`,
    `SELECT ${cAlias}`
  ];

  if (operation === 'INSERT' && !guard && !autoNumber) {
    const cols = Object.keys(fields).join(', ');
    const vals = Object.values(fields).map(toVfpLiteral).join(', ');
    return [
      ...open,
      `INSERT INTO ${cAlias} (${cols}) VALUES (${vals})`,
      `lnRec = RECNO("${cAlias}")`,
      `USE IN ${cAlias}`,
      `RETURN TRANSFORM(lnRec)`
    ].join('\r\n');
  }

  if (operation === 'INSERT') {
    const lines = [
      'SET DELETED ON',
      'SET MULTILOCKS ON',
      `SET REPROCESS TO ${INSERT_LOCK_SECONDS} SECONDS`,
      ...open,
      `IF !RLOCK("0", "${cAlias}")`,
      `  USE IN ${cAlias}`,
      '  RETURN "LOCK_TIMEOUT"',
      'ENDIF'
    ];
    if (guard) {
      lines.push(
        `LOCATE FOR (${whereClause}) AND NOT DELETED()`,
        'IF FOUND()',
        `  lnRec = RECNO("${cAlias}")`,
        `  UNLOCK IN ${cAlias}`,
        `  USE IN ${cAlias}`,
        '  RETURN "DUPLICATE_KEY:" + TRANSFORM(lnRec)',
        'ENDIF'
      );
    }

    let numberFields = [];
    if (autoNumber) {
      const { field, assignTo = [], scopeField, scopeValue, prefix, width } = autoNumber;
      numberFields = [...new Set([field, ...assignTo].map((f) => f.toLowerCase()))];
      const conds = [];
      if (prefix) conds.push(`LEFT(ALLTRIM(${field}), ${prefix.length}) == ${toVfpLiteral(prefix)}`);
      if (scopeField) conds.push(buildWhereClause(scopeField, scopeValue));
      const target = prefix ? `VAL(SUBSTR(ALLTRIM(${field}), ${prefix.length + 1}))` : field;
      lines.push(
        'lnWxMax = 0',
        `CALCULATE MAX(${target}) TO lnWxMax${conds.length ? ` FOR ${conds.join(' AND ')}` : ''}`,
        prefix
          ? `lvWxNo = ${toVfpLiteral(prefix)} + PADL(TRANSFORM(lnWxMax + 1), ${width}, "0")`
          : 'lvWxNo = lnWxMax + 1'
      );
    }

    // 取號欄位一律用 VFP 算出的號碼，fields 裡同名的值 (後端給舊版 LocalAgent 用的) 不寫
    const plain = Object.entries(fields).filter(([k]) => !numberFields.includes(k.toLowerCase()));
    const cols = [...plain.map(([k]) => k), ...numberFields].join(', ');
    const vals = [...plain.map(([, v]) => toVfpLiteral(v)), ...numberFields.map(() => 'lvWxNo')].join(', ');
    lines.push(
      `INSERT INTO ${cAlias} (${cols}) VALUES (${vals})`,
      `lnRec = RECNO("${cAlias}")`,
      `UNLOCK IN ${cAlias}`,
      `USE IN ${cAlias}`,
      `RETURN "OK" + CHR(9) + TRANSFORM(lnRec) + CHR(9) + ${autoNumber ? 'TRANSFORM(lvWxNo)' : '""'}`
    );
    return lines.join('\r\n');
  }

  if (operation === 'UPDATE') {
    // 採用 FoxPro 原生 REPLACE [alias.]field WITH ...，徹底避免 SQL UPDATE 遇到保留字 (如 desc, order, date, status 等) 拋出語法錯誤 10
    const replList = Object.entries(fields).map(([k, v]) => `${cAlias}.${k} WITH ${toVfpLiteral(v)}`);
    const cReplace = replList.length > 0 ? `REPLACE ${replList.join(', ')}` : `* no fields to update`;
    return [
      ...open,
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
  }

  if (operation === 'DELETE') {
    return [
      ...open,
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
  }
  return null;
}

// 有查重或取號的 INSERT 回 "OK<TAB>記錄號<TAB>號碼"；其他寫入只回記錄號
function parseWriteResult(raw) {
  const parts = String(raw ?? '').split('\t');
  if (parts[0] === 'OK' && parts.length === 3) return { recno: parseInt(parts[1], 10) || 0, autoNumber: parts[2].trim() };
  return { recno: parseInt(parts[0], 10) || 0, autoNumber: '' };
}

/**
 * options.isCancelled()：呼叫端 (後端) 已經斷線時回傳 true，還沒輪到的寫入就不執行。
 * options.runBridge：只有測試會替換 (假的橋接程式，或指定執行檔的真 DBFBridge)。
 */
async function executeDbfWrite(payload, { isCancelled, runBridge = runDbfBridge } = {}) {
  const operation = (payload.operation || 'UPDATE').toUpperCase();
  const dbfPath = payload.dbfPath || 'C:\\w3000\\comm';
  const dbfName = payload.dbfName || 'keyin';
  const keyField = payload.keyField || 'no';
  const keyValue = payload.keyValue || '';
  const fields = payload.fields || {};
  const queueTimeoutMs = Math.min(Math.max(Number(payload.queueTimeoutMs) || 0, 0), MAX_WRITE_QUEUE_MS);
  const unique = payload.unique === true;
  const autoNumber = payload.autoNumber || undefined;

  const cAlias = path.basename(dbfName, path.extname(dbfName));
  const invalid = validateDbfWrite(cAlias, keyField, fields) || validateInsertGuard(operation, payload);
  if (invalid) {
    return { success: false, errorType: 'INVALID_REQUEST', error: invalid };
  }
  if (!['INSERT', 'UPDATE', 'DELETE'].includes(operation)) {
    return { success: false, error: `未知的操作類型: ${operation}` };
  }
  const fullPath = path.join(dbfPath, cAlias + (cAlias.toLowerCase().endsWith('.dbf') ? '' : '.dbf'));
  if (!fs.existsSync(fullPath)) {
    return { success: false, error: `找不到 DBF 檔案: ${fullPath}` };
  }

  const vfpFullPath = fullPath.replace(/\\/g, '\\\\');
  const whereClause = buildWhereClause(keyField, keyValue);
  // 預設查重；後端明確傳 unique 時一定查，有 autoNumber 時 keyValue 只是快照算的號碼，不查
  const checkDuplicate = unique || (!autoNumber && shouldCheckDuplicateKey(operation, keyField, payload.allowDuplicateKey));
  const script = buildDbfWriteScript({ operation, vfpFullPath, cAlias, keyField, keyValue, fields, checkDuplicate, autoNumber });

  // 寫入前後的檔案內容在同一個隊列項目內讀取，中間不會插進其他 LocalAgent 動作；
  // 舊系統 (VFP) 若在這段時間也改了檔案，onlyExpectedChanges 會發現多出來的差異
  const queued = await enqueueDbfWithin(async () => {
    const beforeBuf = await readFileOrNull(fullPath);
    const res = await runBridge({ action: 'EXEC_VFP', script });
    const afterBuf = res.success && !isNoWriteResult(res.result) ? await readFileOrNull(fullPath) : null;
    return { execRes: res, before: beforeBuf, after: afterBuf };
  }, { timeoutMs: queueTimeoutMs, isCancelled });

  if (queued.skipped) {
    const reason = queued.skipped === 'QUEUE_TIMEOUT'
      ? `地端 LocalAgent 忙碌，排隊超過 ${Math.round(queueTimeoutMs / 1000)} 秒仍未輪到`
      : '呼叫端已中斷連線';
    return {
      success: false,
      errorType: 'AGENT_BUSY',
      error: `${reason}，未執行寫入 (${operation} ${cAlias})`,
      message: `${reason}，這次沒有寫入 DBF，請稍後再試`
    };
  }
  if (queued.error) {
    return { success: false, error: `寫入 DBF 發生例外: ${queued.error.message || queued.error}` };
  }

  const { execRes, before, after } = queued.value;
  if (!execRes.success) {
    // EXEC_VFP 只回 lockHint (VFP 錯誤 3/108/109/130/1705)；轉成後端判斷 409 用的 LOCK_TIMEOUT
    if (execRes.lockHint) {
      return { ...execRes, errorType: 'LOCK_TIMEOUT', message: execRes.lockHint };
    }
    return execRes;
  }
  if (String(execRes.result).startsWith('DUPLICATE_KEY')) {
    const existingRecno = parseInt(String(execRes.result).split(':')[1], 10) || 0;
    return {
      success: false,
      errorType: 'DUPLICATE_KEY',
      recno: existingRecno,
      error: `DBF 已有相同鍵值的記錄${existingRecno ? ` (第 ${existingRecno} 筆)` : ''}: ${whereClause}`,
      message: `${cAlias}.dbf 已有 ${keyValue} 的資料 (可能剛被其他工作站新增)，這次沒有新增。網頁上的資料可能還沒同步，請重新整理後再確認`
    };
  }
  if (execRes.result === 'RECORD_NOT_FOUND') {
    return {
      success: false,
      errorType: 'RECORD_NOT_FOUND',
      error: `找不到欲${operation === 'DELETE' ? '刪除' : '更新'}的記錄: ${whereClause}`
    };
  }
  if (execRes.result === 'LOCK_TIMEOUT') {
    return {
      success: false,
      errorType: 'LOCK_TIMEOUT',
      error: `${INSERT_LOCK_SECONDS} 秒內無法鎖定 ${cAlias}.dbf 檔頭`,
      message: '資料檔正被其他工作站新增或整批處理中，這次新增已取消 (未寫入)。請稍候幾秒再試一次。'
    };
  }
  const { recno, autoNumber: number } = parseWriteResult(execRes.result);
  // 後端只有在 checksumBefore 等於快照記錄、且 otherChanges 為 false 時，才把 checksumAfter 記為快照的 checksum
  const integrity = before && after
    ? {
        checksumBefore: dbfChecksum(before),
        checksumAfter: dbfChecksum(after),
        otherChanges: !onlyExpectedChanges(before, after, { operation, recno, fieldNames: Object.keys(fields) })
      }
    : { checksumBefore: null, checksumAfter: null, otherChanges: true };
  return {
    success: true,
    operation,
    recno,
    ...(autoNumber ? { autoNumber: number } : {}),
    elapsedMs: execRes.elapsedMs,
    ...integrity
  };
}

// ========== 客戶資料匯出 / 匯入 custbak.dbf (wbase2020 / wbase2030) ==========
// 對應 VFP base20.prg 的 COPY TO 與 APPEND FROM + SEEK/GATHER；腳本由固定範本組成，呼叫端只能傳路徑與客戶代號。
// 代號清單寫進暫存檔再由 VFP FILETOSTR 讀入，不組進腳本字串，避開字串常值與單行 8,192 字元的限制。
const CUSTBAK_TABLE = 'customer';
const CUSTBAK_KEY_MAX = 8; // customer.no C(8)
const CUSTBAK_KEY_SEPARATOR = '|';
// EXEC_VFP 以 TRY/CATCH 自行攔截錯誤時，bridge 不會給 lockHint，這裡依 VFP 錯誤碼判斷
const VFP_LOCK_ERRORS = new Set([3, 108, 109, 130, 1705]);

function isAbsoluteWinPath(p) {
  return typeof p === 'string' && /^(?:[a-zA-Z]:[\\/]|\\\\[^\\/])/.test(p);
}

function sameFile(a, b) {
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}

// 回傳錯誤訊息；合法時回傳 null。kind 為 'export' (targetFile 不可已存在) 或 'import' (sourceFile 必須存在)
function validateCustbakRequest(kind, payload) {
  const { dbfPath, keys } = payload || {};
  const file = kind === 'export' ? payload?.targetFile : payload?.sourceFile;
  if (!isAbsoluteWinPath(dbfPath) || /["\r\n]/.test(dbfPath)) return `不合法的 DBF 目錄: ${dbfPath}`;
  const tablePath = path.join(dbfPath, `${CUSTBAK_TABLE}.dbf`);
  if (!fs.existsSync(tablePath)) return `找不到 DBF 檔案: ${tablePath}`;
  if (!isAbsoluteWinPath(file) || /["\r\n]/.test(file) || path.extname(file).toLowerCase() !== '.dbf') return `不合法的檔案路徑: ${file}`;
  const dir = path.dirname(file);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return `目錄不存在: ${dir}`;
  if (sameFile(file, tablePath)) return '來源或目的檔不可為客戶資料檔本身';
  if (kind === 'export' && fs.existsSync(file)) return `目的檔已存在: ${file}`;
  if (kind === 'import' && !fs.existsSync(file)) return `找不到來源檔: ${file}`;
  if (!Array.isArray(keys) || keys.length === 0) return '至少要指定一個客戶代號';
  const badKey = keys.find((k) => typeof k !== 'string' || !k.trim() || k.trim().length > CUSTBAK_KEY_MAX ||
    k.includes(CUSTBAK_KEY_SEPARATOR) || /[\x00-\x1f]/.test(k));
  if (badKey !== undefined) return `不合法的客戶代號: ${JSON.stringify(badKey)}`;
  return null;
}

function writeCustbakKeysFile(keys) {
  const dir = path.join(os.tmpdir(), 'Wx3000');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `custbak_keys_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
  const text = CUSTBAK_KEY_SEPARATOR + keys.map((k) => k.trim()).join(CUSTBAK_KEY_SEPARATOR) + CUSTBAK_KEY_SEPARATOR;
  // DBF 內容是 CP950，ALLTRIM(no) 比對的是 Big5 位元組
  fs.writeFileSync(file, iconv ? iconv.encode(text, 'cp950') : Buffer.from(text, 'utf8'));
  return file;
}

function buildCustbakExportScript({ dbfPath, keysFile, targetFile }) {
  const tablePath = path.join(dbfPath, `${CUSTBAK_TABLE}.dbf`);
  return [
    'SET DELETED ON',
    'SET SAFETY OFF',
    'SET CPDIALOG OFF',
    'lcResult = ""',
    'TRY',
    `  lcKeys = FILETOSTR("${keysFile}")`,
    `  USE "${tablePath}" IN 0 ALIAS wx_cust SHARED AGAIN`,
    '  SELECT wx_cust',
    '  IF TAGNO("NO") > 0',
    '    SET ORDER TO TAG no',
    '  ENDIF',
    `  COPY TO "${targetFile}" FOR ("${CUSTBAK_KEY_SEPARATOR}" + ALLTRIM(no) + "${CUSTBAK_KEY_SEPARATOR}") $ lcKeys`,
    '  USE IN wx_cust',
    `  USE "${targetFile}" IN 0 ALIAS wx_bak EXCLUSIVE`,
    // 只改輸出檔，與 VFP 匯出的 custbak.dbf 一致；customer.dbf 的 sel 不動
    '  REPLACE sel WITH "=>" ALL IN wx_bak',
    '  lcResult = "OK" + CHR(10) + TRANSFORM(RECCOUNT("wx_bak"))',
    'CATCH TO loErr',
    '  lcResult = "ERR" + CHR(10) + TRANSFORM(loErr.ErrorNo) + CHR(10) + loErr.Message',
    'FINALLY',
    '  IF USED("wx_cust")',
    '    USE IN wx_cust',
    '  ENDIF',
    '  IF USED("wx_bak")',
    '    USE IN wx_bak',
    '  ENDIF',
    'ENDTRY',
    'RETURN lcResult'
  ].join('\r\n');
}

// 依 VFP 2-3：用 customer 結構建暫存 cursor 再 APPEND FROM (依欄名對應，來源缺的欄位成為空值)，
// 以 no 為鍵存在就整筆覆蓋、不存在就新增。唯一差異是不寫 sel：既有客戶保留原值，新客戶為空白
function buildCustbakImportScript({ dbfPath, keysFile, sourceFile }) {
  const tablePath = path.join(dbfPath, `${CUSTBAK_TABLE}.dbf`);
  return [
    'SET DELETED ON',
    'SET SAFETY OFF',
    'SET CPDIALOG OFF',
    'SET REPROCESS TO 10',
    'STORE 0 TO lnIns, lnUpd',
    'lcFail = ""',
    'lcResult = ""',
    'TRY',
    `  lcKeys = FILETOSTR("${keysFile}")`,
    `  USE "${tablePath}" IN 0 ALIAS wx_cust SHARED AGAIN ORDER TAG no`,
    '  =AFIELDS(laF, "wx_cust")',
    '  CREATE CURSOR wx_src FROM ARRAY laF',
    `  APPEND FROM "${sourceFile}"`,
    '  SELECT wx_src',
    `  SCAN FOR ("${CUSTBAK_KEY_SEPARATOR}" + ALLTRIM(no) + "${CUSTBAK_KEY_SEPARATOR}") $ lcKeys`,
    '    SCATTER MEMVAR',
    '    lcNo = ALLTRIM(wx_src.no)',
    '    TRY',
    '      IF SEEK(wx_src.no, "wx_cust", "no")',
    '        IF RLOCK("wx_cust")',
    '          m.sel = wx_cust.sel',
    '          SELECT wx_cust',
    '          GATHER MEMVAR',
    '          UNLOCK IN wx_cust',
    '          lnUpd = lnUpd + 1',
    '        ELSE',
    '          lcFail = lcFail + lcNo + CHR(9) + "LOCK" + CHR(10)',
    '        ENDIF',
    '      ELSE',
    // INSERT 一次寫入整筆；APPEND BLANK 後 GATHER 失敗會留下一筆空白客戶
    '        m.sel = ""',
    '        INSERT INTO wx_cust FROM MEMVAR',
    '        UNLOCK IN wx_cust',
    '        lnIns = lnIns + 1',
    '      ENDIF',
    '    CATCH TO loRowErr',
    '      lcFail = lcFail + lcNo + CHR(9) + TRANSFORM(loRowErr.ErrorNo) + " " + loRowErr.Message + CHR(10)',
    '      UNLOCK IN wx_cust',
    '    ENDTRY',
    '    SELECT wx_src',
    '  ENDSCAN',
    '  lcResult = "OK" + CHR(10) + TRANSFORM(lnIns) + CHR(10) + TRANSFORM(lnUpd) + CHR(10) + lcFail',
    'CATCH TO loErr',
    '  lcResult = "ERR" + CHR(10) + TRANSFORM(loErr.ErrorNo) + CHR(10) + loErr.Message + CHR(10) + TRANSFORM(lnIns) + CHR(10) + TRANSFORM(lnUpd)',
    'FINALLY',
    '  IF USED("wx_src")',
    '    USE IN wx_src',
    '  ENDIF',
    '  IF USED("wx_cust")',
    '    USE IN wx_cust',
    '  ENDIF',
    'ENDTRY',
    'RETURN lcResult'
  ].join('\r\n');
}

function vfpLockMessage(errorNo) {
  return errorNo === 3 || errorNo === 1705
    ? '客戶資料檔正被其他工作站獨佔使用，請等該站作業完成後再試。'
    : '客戶資料正被其他工作站編輯中，請稍候再試。';
}

// 腳本回傳 "OK\n..." 或 "ERR\n錯誤碼\n訊息[\n新增\n覆蓋]"
function parseCustbakResult(kind, raw) {
  const lines = String(raw ?? '').split('\n').map((s) => s.replace(/\r$/, ''));
  if (lines[0] === 'OK' && kind === 'export') {
    return { success: true, count: parseInt(lines[1], 10) || 0 };
  }
  if (lines[0] === 'OK') {
    const failed = lines.slice(3).filter((l) => l.trim()).map((l) => {
      const [key, reason = ''] = l.split('\t');
      const code = parseInt(reason, 10);
      const isLock = reason === 'LOCK' || VFP_LOCK_ERRORS.has(code);
      return { key: key.trim(), reason: isLock ? vfpLockMessage(code) : reason.trim() };
    });
    return { success: true, inserted: parseInt(lines[1], 10) || 0, updated: parseInt(lines[2], 10) || 0, failed };
  }
  if (lines[0] === 'ERR') {
    const errorNo = parseInt(lines[1], 10) || 0;
    const partial = kind === 'import' ? { inserted: parseInt(lines[3], 10) || 0, updated: parseInt(lines[4], 10) || 0 } : {};
    if (VFP_LOCK_ERRORS.has(errorNo)) {
      return { success: false, errorType: 'LOCK_TIMEOUT', error: `VFP 錯誤 ${errorNo}: ${lines[2] || ''}`, message: vfpLockMessage(errorNo), ...partial };
    }
    return { success: false, errorType: 'VFP_ERROR', error: `VFP 錯誤 ${errorNo}: ${lines[2] || ''}`, ...partial };
  }
  return { success: false, errorType: 'VFP_ERROR', error: `無法解讀 VFP 回傳值: ${String(raw ?? '').slice(0, 200)}` };
}

async function executeCustbak(kind, payload) {
  const invalid = validateCustbakRequest(kind, payload);
  if (invalid) return { success: false, errorType: 'INVALID_REQUEST', error: invalid };

  const keysFile = writeCustbakKeysFile(payload.keys);
  try {
    const script = kind === 'export'
      ? buildCustbakExportScript({ dbfPath: payload.dbfPath, keysFile, targetFile: payload.targetFile })
      : buildCustbakImportScript({ dbfPath: payload.dbfPath, keysFile, sourceFile: payload.sourceFile });
    const execRes = await callDbfBridge({ action: 'EXEC_VFP', script });
    if (!execRes.success) {
      if (execRes.lockHint) return { ...execRes, errorType: 'LOCK_TIMEOUT', message: execRes.lockHint };
      return execRes;
    }
    return { ...parseCustbakResult(kind, execRes.result), elapsedMs: execRes.elapsedMs };
  } finally {
    fs.rm(keysFile, { force: true }, () => {});
  }
}

const executeCustbakExport = (payload) => executeCustbak('export', payload);
const executeCustbakImport = (payload) => executeCustbak('import', payload);

// ========== Office (Word) 開檔與套印 (5-6 委任書 wbs_rep2 F6 / F7) ==========
// 開檔與轉出 Word 都在使用者本機執行。呼叫端只能指定範本代號與資料磁碟機代號，檔案路徑由下面的白名單組出；
// PowerShell 腳本是固定字串，資料寫進暫存 JSON，以環境變數傳路徑，不組進腳本或命令列。
const WORD_TEMPLATES = {
  // VFP gutil.prg Pap1 / decode_Pa1：listMacro 換成一筆一段的清單，其餘巨集換成呼叫端給的文字
  bsdesc: {
    file: 'wbase001.DOC',
    outputName: '委任書',
    listMacro: 'THINGS',
    macros: [
      'NAME', 'HNAME', 'HIDNO', 'UNINO', 'ADDR', 'TEL',
      'COMPHNAME', 'COMPHIDNO', 'COMPNAME', 'COMPUNINO', 'COMPADDR', 'COMPTEL',
      'BKCNO1', 'BKCNO2', 'BKCNO3', 'CNO2', 'RPDATE',
      'ENGNAME', 'MEMO', 'MEMO01', 'MEMO02', 'MEMO03',
      'CAPITAL', 'CAPITALBIG5', 'RECAMT', 'RECAMTBIG5'
    ]
  }
};
const WORD_MAX_COPIES = 200;      // VFP 每家客戶一份；目前網頁版只送一份
const WORD_MAX_PARAGRAPHS = 1000;
const WORD_MAX_TEXT = 20000;      // 單一段落或巨集值的字元數
const WORD_TIMEOUT_MS = 120 * 1000;
const OFFICE_TEMP_DIR = path.join(os.tmpdir(), 'Wx3000');

const hasOwnKey = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function systemExe(...parts) {
  return path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', ...parts);
}

// 只接受單一磁碟機字母 (前端 getDataDrive() 的值)，路徑一律是 <drive>:\W3000\comm\<範本檔>
function resolveWordTemplate(templateKey, drive) {
  if (typeof templateKey !== 'string' || !hasOwnKey(WORD_TEMPLATES, templateKey)) {
    return { error: `未開放的 Word 範本: ${templateKey}` };
  }
  if (typeof drive !== 'string' || !/^[A-Za-z]$/.test(drive)) {
    return { error: `不合法的資料磁碟機: ${drive}` };
  }
  const spec = WORD_TEMPLATES[templateKey];
  return { spec, filePath: `${drive.toUpperCase()}:\\W3000\\comm\\${spec.file}` };
}

// Word 的 Range.Text 以 \r 分段、\v (CHR(11)) 為段內換行；其他控制字元 (如表格儲存格結尾 CHR(7)) 會破壞版面
function toWordText(value) {
  return String(value ?? '')
    .replace(/\r\n|\r|\n/g, '\v')
    .replace(/[\x00-\x08\x0c\x0e-\x1f\x7f]/g, '');
}

// 回傳錯誤訊息；合法時回傳 null
function validateWordMerge(payload) {
  const { paragraphs, copies } = payload || {};
  const resolved = resolveWordTemplate(payload?.template, payload?.drive);
  if (resolved.error) return resolved.error;
  if (!Array.isArray(paragraphs) || paragraphs.length > WORD_MAX_PARAGRAPHS) {
    return `paragraphs 必須是最多 ${WORD_MAX_PARAGRAPHS} 筆的文字陣列`;
  }
  if (paragraphs.some((p) => typeof p !== 'string' || p.length > WORD_MAX_TEXT)) {
    return `段落必須是文字，且不可超過 ${WORD_MAX_TEXT} 字`;
  }
  if (!Array.isArray(copies) || copies.length < 1 || copies.length > WORD_MAX_COPIES) {
    return `copies 必須是 1 ~ ${WORD_MAX_COPIES} 份`;
  }
  const allowed = new Set(resolved.spec.macros);
  for (const copy of copies) {
    if (copy === null || typeof copy !== 'object' || Array.isArray(copy)) return 'copies 每一份必須是巨集名稱對應文字的物件';
    const badKey = Object.keys(copy).find((k) => !allowed.has(k));
    if (badKey !== undefined) return `範本沒有這個巨集: ${badKey}`;
    const badValue = Object.keys(copy).find((k) => typeof copy[k] !== 'string' || copy[k].length > WORD_MAX_TEXT);
    if (badValue !== undefined) return `巨集 ${badValue} 的值必須是不超過 ${WORD_MAX_TEXT} 字的文字`;
  }
  return null;
}

// 給 PowerShell 的工作內容：macros[0] 是清單巨集，每份的 values 與 macros 一一對應；呼叫端沒給的巨集換成空字串 (同 decode_Pa1 的 Otherwise)
function buildWordMergeJob(spec, { templatePath, workPath, outputPath, paragraphs, copies, open = true }) {
  const listText = paragraphs.map(toWordText).join('\r');
  return {
    template: templatePath,
    work: workPath,
    output: outputPath,
    open: Boolean(open),
    macros: [spec.listMacro, ...spec.macros].map((m) => `[${m}]`),
    copies: copies.map((copy) => [listText, ...spec.macros.map((m) => toWordText(hasOwnKey(copy, m) ? copy[m] : ''))])
  };
}

function officeTempFile(prefix, ext) {
  if (!fs.existsSync(OFFICE_TEMP_DIR)) fs.mkdirSync(OFFICE_TEMP_DIR, { recursive: true });
  return path.join(OFFICE_TEMP_DIR, `${prefix}_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
}

// 委任書_20261105_143012.docx；同一秒內重複時加序號
function wordOutputPath(name, now = new Date()) {
  if (!fs.existsSync(OFFICE_TEMP_DIR)) fs.mkdirSync(OFFICE_TEMP_DIR, { recursive: true });
  const p2 = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}_${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}`;
  for (let i = 1; ; i++) {
    const file = path.join(OFFICE_TEMP_DIR, `${name}_${stamp}${i > 1 ? `_${i}` : ''}.docx`);
    if (!fs.existsSync(file)) return file;
  }
}

// 以 ShellExecute 開檔 (預設程式，.DOC 通常是 Word)
const OFFICE_OPEN_SCRIPT = `
$ErrorActionPreference = 'Stop'
$r = @{ success = $true }
try { Start-Process -FilePath $env:WX3000_OFFICE_FILE } catch { $r = @{ success = $false; errorType = 'OPEN_FAILED'; error = $_.Exception.Message } }
[IO.File]::WriteAllText($env:WX3000_OFFICE_RESULT, (ConvertTo-Json $r -Compress), (New-Object Text.UTF8Encoding $false))
`;

// 對應 VFP Pap1：模板複本當底，第 2 份起在文件尾加分頁並插入模板，逐份把巨集換成該份的值後另存 .docx。
// 不用 Find.Replacement.Text：它限 255 字，且會把 ^p、^& 當成特殊碼；改用 Range.Text 逐一取代。
// AutomationSecurity = 3 (msoAutomationSecurityForceDisable)：範本可由使用者編修，不執行其中的巨集。
const WORD_MERGE_SCRIPT = `
$ErrorActionPreference = 'Stop'
$job = [IO.File]::ReadAllText($env:WX3000_OFFICE_JOB, [Text.Encoding]::UTF8) | ConvertFrom-Json
$r = @{ success = $false; errorType = 'WORD_ERROR'; error = '' }
$word = $null; $doc = $null; $stage = 'start'
try {
  try { $word = New-Object -ComObject Word.Application } catch { $r.errorType = 'NO_WORD'; throw }
  $word.Visible = $false
  $word.DisplayAlerts = 0
  try { $word.AutomationSecurity = 3 } catch {}
  $stage = 'open'
  $doc = $word.Documents.Open([string]$job.work, $false, $false, $false)
  $stage = 'replace'
  $count = 0
  for ($i = 0; $i -lt $job.copies.Count; $i++) {
    $start = 0
    if ($i -gt 0) {
      $rg = $doc.Content; $rg.Collapse(0); $rg.InsertBreak(7)
      $rg = $doc.Content; $rg.Collapse(0); $start = $rg.Start
      $rg.InsertFile([string]$job.template)
    }
    $values = @($job.copies[$i])
    $map = New-Object 'System.Collections.Generic.Dictionary[string,string]'
    for ($k = 0; $k -lt $job.macros.Count; $k++) { $map[[string]$job.macros[$k]] = [string]$values[$k] }
    # 從這一份的開頭單次掃描 [大寫英數]：換上的文字在游標之後，不會再被當成巨集
    $rg = $doc.Range($start, $doc.Content.End)
    $f = $rg.Find
    $f.ClearFormatting()
    $f.Text = '\\[[A-Z0-9]{1,}\\]'
    $f.MatchWildcards = $true; $f.Forward = $true; $f.Wrap = 0; $f.Format = $false
    $guard = 0
    while ($f.Execute()) {
      $key = [string]$rg.Text
      if ($map.ContainsKey($key)) { $rg.Text = $map[$key]; $count++ }
      $rg.Collapse(0)
      if (++$guard -ge 5000) { break }
    }
  }
  if ($job.copies.Count -gt 1) {
    $tail = $doc.Range($doc.Content.End - 2, $doc.Content.End)
    if ($tail.Text -eq "\`r\`r") { $doc.Range($doc.Content.End - 2, $doc.Content.End - 1).Delete() | Out-Null }
  }
  $stage = 'save'
  $out = [string]$job.output
  try { $doc.SaveAs2($out, 12) } catch { $fmt = 12; $doc.SaveAs([ref]$out, [ref]$fmt) }
  $doc.Close([ref]0); $doc = $null
  if ($job.open) { $stage = 'show'; Start-Process -FilePath $out }
  $r = @{ success = $true; path = $out; replaced = $count }
} catch {
  $r.error = "[$stage] " + $_.Exception.Message
} finally {
  if ($doc -ne $null) { try { $doc.Close([ref]0) } catch {} }
  if ($word -ne $null) {
    try { if ($word.Documents.Count -eq 0) { $word.Quit([ref]0) } } catch {}
    try { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word) } catch {}
  }
}
[IO.File]::WriteAllText($env:WX3000_OFFICE_RESULT, (ConvertTo-Json $r -Compress), (New-Object Text.UTF8Encoding $false))
`;

// 執行固定的 PowerShell 腳本，結果由腳本寫進 resultFile (UTF-8 JSON)；PowerShell 主控台輸出是 Big5，不拿來判斷結果
function runOfficeScript(script, env, timeoutMs) {
  return new Promise((resolve) => {
    const resultFile = officeTempFile('office_result', '.json');
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    let timedOut = false;
    let child;
    const finish = (fallback) => {
      let parsed = null;
      try { parsed = JSON.parse(fs.readFileSync(resultFile, 'utf8').replace(/^\uFEFF/, '')); } catch (e) { /* 腳本沒寫出結果 */ }
      fs.rm(resultFile, { force: true }, () => {});
      resolve(parsed || fallback);
    };
    try {
      child = spawn(systemExe('WindowsPowerShell', 'v1.0', 'powershell.exe'),
        ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, ...env, WX3000_OFFICE_RESULT: resultFile }
        });
    } catch (e) {
      finish({ success: false, errorType: 'POWERSHELL_FAILED', error: `無法啟動 PowerShell: ${e.message}` });
      return;
    }
    const getStderr = collectUtf8(child.stderr);
    child.stdout.resume();
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      finish({ success: false, errorType: 'POWERSHELL_FAILED', error: `無法啟動 PowerShell: ${err.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      finish(timedOut
        ? { success: false, errorType: 'TIMEOUT', error: `Word 作業超過 ${Math.round(timeoutMs / 1000)} 秒未完成，已中止` }
        : { success: false, errorType: 'POWERSHELL_FAILED', error: `PowerShell 結束碼 ${code}: ${getStderr().trim().slice(0, 500)}` });
    });
  });
}

// Word 作業一次只做一份，避免同時開多個 Word 執行個體
let officeQueue = Promise.resolve();
function enqueueOffice(task) {
  const next = officeQueue.then(task, task);
  officeQueue = next.catch(() => {});
  return next;
}

// 本機是否註冊了 Word.Application (WPS 等相容軟體若接管這個 ProgID 也算)
function detectWord() {
  return new Promise((resolve) => {
    execFile(systemExe('reg.exe'), ['query', 'HKCR\\Word.Application', '/s'], { windowsHide: true, timeout: 5000 }, (err, stdout) => {
      const text = String(stdout || '');
      if (err || !/\\CLSID\b/i.test(text)) {
        resolve({ success: true, word: false });
        return;
      }
      const m = text.match(/Word\.Application\.(\d+)/i);
      resolve({ success: true, word: true, version: m ? m[1] : '' });
    });
  });
}

async function openWordTemplate(payload) {
  const resolved = resolveWordTemplate(payload?.template, payload?.drive);
  if (resolved.error) return { success: false, errorType: 'INVALID_REQUEST', error: resolved.error };
  if (!fs.existsSync(resolved.filePath)) {
    return { success: false, errorType: 'NOT_FOUND', error: `找不到範本檔: ${resolved.filePath}` };
  }
  const res = await runOfficeScript(OFFICE_OPEN_SCRIPT, { WX3000_OFFICE_FILE: resolved.filePath }, 30 * 1000);
  return { ...res, path: resolved.filePath };
}

async function mergeWordTemplate(payload, options = {}) {
  const invalid = validateWordMerge(payload);
  if (invalid) return { success: false, errorType: 'INVALID_REQUEST', error: invalid };
  const { spec, filePath } = resolveWordTemplate(payload.template, payload.drive);
  if (!fs.existsSync(filePath)) {
    return { success: false, errorType: 'NOT_FOUND', error: `找不到範本檔: ${filePath}` };
  }

  return enqueueOffice(async () => {
    // 同 VFP 先把模板複製成暫存檔再開啟：範本本身不會被鎖住，第 2 份起也才能 InsertFile 原範本
    const workPath = officeTempFile('word_work', path.extname(filePath) || '.doc');
    const jobPath = officeTempFile('word_job', '.json');
    try {
      fs.copyFileSync(filePath, workPath);
      const job = buildWordMergeJob(spec, {
        templatePath: filePath,
        workPath,
        outputPath: wordOutputPath(spec.outputName),
        paragraphs: payload.paragraphs,
        copies: payload.copies,
        open: payload.open !== false
      });
      fs.writeFileSync(jobPath, JSON.stringify(job), 'utf8');
      const res = await runOfficeScript(WORD_MERGE_SCRIPT, { WX3000_OFFICE_JOB: jobPath }, options.timeoutMs || WORD_TIMEOUT_MS);
      return { ...res, copies: payload.copies.length, paragraphs: payload.paragraphs.length };
    } catch (e) {
      return { success: false, errorType: 'WORD_ERROR', error: e.message };
    } finally {
      fs.rm(jobPath, { force: true }, () => {});
      fs.rm(workPath, { force: true }, () => {});
    }
  });
}

// ========== 本機印表機列舉與靜默直接列印 (供網頁版 /api/printers 與 /api/print/direct 使用) ==========
const LIST_PRINTERS_SCRIPT = `
$r = $null
try {
  Add-Type -AssemblyName System.Drawing
  $pd = New-Object System.Drawing.Printing.PrintDocument
  $defName = $pd.PrinterSettings.PrinterName
  $pd.Dispose()
  $list = @()
  foreach ($p in [System.Drawing.Printing.PrinterSettings]::InstalledPrinters) {
    $list += @{ name = [string]$p; displayName = [string]$p; isDefault = ([string]$p -eq [string]$defName) }
  }
  $r = @{ success = $true; printers = $list }
} catch {
  $r = @{ success = $false; errorType = 'PRINTER_ERROR'; error = $_.Exception.Message; printers = @() }
}
[IO.File]::WriteAllText($env:WX3000_OFFICE_RESULT, (ConvertTo-Json $r -Depth 4 -Compress), (New-Object Text.UTF8Encoding $false))
`;

const DIRECT_PRINT_SCRIPT = `
$r = $null
try {
  Add-Type -AssemblyName System.Drawing
  $job = Get-Content -Raw -Encoding UTF8 $env:WX3000_PRINT_JOB | ConvertFrom-Json
  $doc = New-Object System.Drawing.Printing.PrintDocument
  if ($job.jobName) { $doc.DocumentName = [string]$job.jobName }
  if ($job.deviceName) { $doc.PrinterSettings.PrinterName = [string]$job.deviceName }
  if (-not $doc.PrinterSettings.IsValid) {
    throw "無效的印表機名稱: $($job.deviceName)"
  }
  $doc.DefaultPageSettings.Landscape = [bool]$job.landscape
  $doc.DefaultPageSettings.Color = [bool]$job.color
  if ($job.paperSize) {
    $targetKind = switch ([string]$job.paperSize) {
      'A4' { 'A4' }
      'Letter' { 'Letter' }
      'B4' { 'B4' }
      default { '' }
    }
    if ($targetKind) {
      foreach ($ps in $doc.PrinterSettings.PaperSizes) {
        if ([string]$ps.Kind -eq $targetKind -or $ps.PaperName -like "*$targetKind*") {
          $doc.DefaultPageSettings.PaperSize = $ps
          break
        }
      }
    }
  }
  $doc.OriginAtMargins = $false
  $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController
  $files = @($job.imageFiles)
  $script:pageIdx = 0
  $handler = [System.Drawing.Printing.PrintPageEventHandler]{
    param($sender, $e)
    $img = [System.Drawing.Image]::FromFile($files[$script:pageIdx])
    try {
      $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $e.Graphics.DrawImage($img, $e.PageBounds)
    } finally {
      $img.Dispose()
    }
    $script:pageIdx++
    $e.HasMorePages = ($script:pageIdx -lt $files.Count)
  }
  $doc.add_PrintPage($handler)
  $doc.Print()
  $printerUsed = $doc.PrinterSettings.PrinterName
  $doc.Dispose()
  $r = @{ success = $true; printedPages = $files.Count; printer = $printerUsed }
} catch {
  $r = @{ success = $false; errorType = 'PRINT_ERROR'; error = $_.Exception.Message }
}
[IO.File]::WriteAllText($env:WX3000_OFFICE_RESULT, (ConvertTo-Json $r -Compress), (New-Object Text.UTF8Encoding $false))
`;

async function listSystemPrinters() {
  return runOfficeScript(LIST_PRINTERS_SCRIPT, {}, 15 * 1000);
}

async function directPrintImages(payload) {
  const pages = payload?.pages;
  if (!Array.isArray(pages) || pages.length === 0) {
    return { success: false, errorType: 'INVALID_REQUEST', error: '缺少要列印的頁面影像資料 (pages)' };
  }
  if (pages.length > 500) {
    return { success: false, errorType: 'INVALID_REQUEST', error: '單次列印頁數不可超過 500 頁' };
  }

  const tempFiles = [];
  const jobPath = officeTempFile('print_job', '.json');
  try {
    for (let i = 0; i < pages.length; i++) {
      const raw = String(pages[i] || '');
      const base64 = raw.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      if (!base64) {
        return { success: false, errorType: 'INVALID_REQUEST', error: `第 ${i + 1} 頁影像資料為空` };
      }
      const imgFile = officeTempFile(`print_page_${i + 1}`, '.jpg');
      fs.writeFileSync(imgFile, Buffer.from(base64, 'base64'));
      tempFiles.push(imgFile);
    }

    const job = {
      deviceName: typeof payload.deviceName === 'string' ? payload.deviceName : '',
      landscape: Boolean(payload.landscape),
      color: payload.color !== false,
      paperSize: typeof payload.paperSize === 'string' ? payload.paperSize : 'A4',
      jobName: typeof payload.jobName === 'string' ? payload.jobName : 'Wx3000 報表列印',
      imageFiles: tempFiles
    };
    fs.writeFileSync(jobPath, JSON.stringify(job), 'utf8');
    return await runOfficeScript(DIRECT_PRINT_SCRIPT, { WX3000_PRINT_JOB: jobPath }, 120 * 1000);
  } catch (e) {
    return { success: false, errorType: 'PRINT_ERROR', error: e.message };
  } finally {
    fs.rm(jobPath, { force: true }, () => {});
    for (const f of tempFiles) {
      fs.rm(f, { force: true }, () => {});
    }
  }
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
const READ_ONLY_PATHS = new Set(['/', '/test.html', '/mac', '/config', '/dllList', '/api/check-drive', '/api/dbf/check_drive', '/api/office/status', '/api/printers']);

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
        const result = await executeDbfChecksum({ filePath, dbfPath, dbfName });
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
            // 後端逾時放棄時會斷線；還沒輪到的寫入就不執行，免得使用者看到失敗、DBF 卻在之後被寫入
            let clientGone = false;
            res.on('close', () => { if (!res.writableFinished) clientGone = true; });
            const result = await executeDbfWrite(payload, { isCancelled: () => clientGone });
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(result));
            return;
          }

          if (dbfAction === 'EXPORT_CUSTBAK' || dbfAction === 'IMPORT_CUSTBAK') {
            const result = dbfAction === 'EXPORT_CUSTBAK' ? await executeCustbakExport(payload) : await executeCustbakImport(payload);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(result));
            return;
          }

          if (dbfAction === 'CHECKSUM') {
            const result = await executeDbfChecksum(payload);
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

  // ========== Office (Word) API (/api/office/*)：前端直接呼叫，只開放固定範本 ==========
  if (url.pathname === '/api/office/status' && req.method === 'GET') {
    const result = await detectWord();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
    return;
  }
  if ((url.pathname === '/api/office/word/open' || url.pathname === '/api/office/word/merge') && req.method === 'POST') {
    const getBody = collectUtf8(req);
    req.on('end', async () => {
      let payload;
      try {
        payload = JSON.parse(getBody() || '{}');
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, errorType: 'INVALID_REQUEST', error: e.message }));
        return;
      }
      try {
        const result = url.pathname.endsWith('/open') ? await openWordTemplate(payload) : await mergeWordTemplate(payload);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, errorType: 'WORD_ERROR', error: e.message }));
      }
    });
    return;
  }

  // ========== 本機印表機列舉與靜默列印 API (/api/printers, /api/print/direct) ==========
  if (url.pathname === '/api/printers' && req.method === 'GET') {
    const result = await listSystemPrinters();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
    return;
  }
  if (url.pathname === '/api/print/direct' && req.method === 'POST') {
    const getBody = collectUtf8(req);
    req.on('end', async () => {
      let payload;
      try {
        payload = JSON.parse(getBody() || '{}');
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, errorType: 'INVALID_REQUEST', error: e.message }));
        return;
      }
      const result = await directPrintImages(payload);
      res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    });
    return;
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
  toVfpLiteral,
  validateInsertGuard,
  buildDbfWriteScript,
  shouldCheckDuplicateKey,
  parseWriteResult,
  runDbfBridge,
  enqueueDbf,
  enqueueDbfWithin,
  executeDbfWrite,
  executeDbfChecksum,
  dbfChecksum,
  onlyExpectedChanges,
  validateCustbakRequest,
  buildCustbakExportScript,
  buildCustbakImportScript,
  parseCustbakResult,
  executeCustbakExport,
  executeCustbakImport,
  WORD_TEMPLATES,
  resolveWordTemplate,
  toWordText,
  validateWordMerge,
  buildWordMergeJob,
  WORD_MERGE_SCRIPT,
  OFFICE_OPEN_SCRIPT,
  detectWord,
  openWordTemplate,
  mergeWordTemplate,
  listSystemPrinters,
  directPrintImages,
  LIST_PRINTERS_SCRIPT,
  DIRECT_PRINT_SCRIPT,
  isAllowedOrigin,
  authorizeRequest,
  buildDbfBridgeRequest,
  releasePreviewChild,
  handleRequest
};
