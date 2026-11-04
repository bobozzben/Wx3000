#!/usr/bin/env node
// Wx3000 多人使用壓力測試 (Node 18 以上，不需額外套件)
//
// 模擬多個使用者同時操作網頁版，以及舊系統 (VFP) 同時修改 DBF，檢查：
//   回應時間與錯誤率、DBF 與 PostgreSQL 快照是否一致、取號是否重複、同時存檔是否互相覆蓋。
// 會寫入資料，只能對 subst 掛上的測試複本執行；一般請用同目錄的 Run-StressTest.ps1，它會建立複本並在測完後清除。
//
//   node tests/stress/stress.mjs --drive V [--api http://localhost:5007] [--agent http://127.0.0.1:5009]
//        [--users 1,5,10,20] [--duration 15] [--burst 10] [--rounds 20] [--scenarios all|名稱,名稱] [--out 目錄]
//
// 情境名稱見下方 SCENARIOS。有任何 FAIL 時結束代碼為 1。

import http from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readActiveRows } from './lib/dbf.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- 參數
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const API = String(args.api || 'http://localhost:5007').replace(/\/+$/, '');
const AGENT = String(args.agent || 'http://127.0.0.1:5009').replace(/\/+$/, '');
const DRIVE = String(args.drive || '').trim().toUpperCase().replace(/:.*$/, '');
const USERS = String(args.users || '1,5,10,20').split(',').map(Number).filter((n) => n > 0);
const DURATION = Number(args.duration || 15);
const BURST = Number(args.burst || 10);
const ROUNDS = Number(args.rounds || 20);
const THINK_MS = Number(args.think || 0);
const OUT_DIR = path.resolve(String(args.out || path.join(__dirname, '..', 'out', 'stress')));
const DBF_DIR = `${DRIVE}:\\w3000\\comm`;
const SLOW_P95_MS = 3000;

const SCENARIOS = {
  'cold-sync': coldSync,
  'agent-queue': agentQueue,
  'read-load': readLoad,
  stampede,
  'dup-key': dupKey,
  numbering,
  'lost-update': lostUpdate,
  'legacy-race': legacyRace,
  consistency,
};

// ---------------------------------------------------------------- HTTP
const keepAlive = new http.Agent({ keepAlive: true, maxSockets: 512 });

// 用 node:http 而不是 fetch：LocalAgent 的 /api/dbf/* 會拒絕帶 Origin 的請求，這裡完全掌握送出的標頭
function request(base, method, urlPath, body, headers = {}, timeoutMs = 120000) {
  const url = new URL(base + urlPath);
  const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body), 'utf8');
  const started = performance.now();
  return new Promise((resolve) => {
    const req = http.request(url, {
      method,
      agent: keepAlive,
      headers: {
        Accept: 'application/json',
        ...(payload ? { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': payload.length } : {}),
        ...headers,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json;
        try { json = text ? JSON.parse(text) : undefined; } catch { /* 非 JSON */ }
        const status = res.statusCode || 0;
        resolve({ status, ok: status >= 200 && status < 300, ms: performance.now() - started, json, text });
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.on('error', (err) => resolve({ status: 0, ok: false, ms: performance.now() - started, error: err.message, text: '' }));
    if (payload) req.write(payload);
    req.end();
  });
}

const api = (method, urlPath, body) => request(API, method, urlPath, body, { 'X-Data-Drive': DRIVE });
const agent = (method, urlPath, body) => request(AGENT, method, urlPath, body);

/**
 * 模擬舊系統 (VFP) 直接改 DBF：另外啟動一個 32-bit DBFBridge.exe 執行 REPLACE，
 * 和真正的 VFP 工作站一樣不經 LocalAgent 的隊列，也不經後端，所以 PostgreSQL 與 checksum 字典都不會更新。
 * legacyWrite 以單一欄位定位後 REPLACE，legacyInsert 直接 INSERT；值只能是英數字 (測試標記)。
 */
const BRIDGE_EXE = path.resolve(String(args.bridge || path.join(__dirname, '..', '..', 'localagent', 'bridge', 'lazarus', 'DBFBridge.exe')));

function legacyWrite(dbfName, keyField, keyValue, fields) {
  const alias = `lg_${dbfName}`;
  const vfpPath = legacyPath(dbfName, [keyValue, ...Object.values(fields)]);
  return legacyExec([
    `USE "${vfpPath}" IN 0 ALIAS ${alias} SHARED AGAIN`,
    `SELECT ${alias}`,
    `LOCATE FOR ALLTRIM(${keyField}) == "${keyValue}"`,
    'IF EOF()',
    `  USE IN ${alias}`,
    '  RETURN "RECORD_NOT_FOUND"',
    'ENDIF',
    `REPLACE ${Object.entries(fields).map(([k, v]) => `${alias}.${k} WITH "${v}"`).join(', ')}`,
    `USE IN ${alias}`,
    'RETURN "OK"',
  ]);
}

function legacyInsert(dbfName, fields) {
  const alias = `lg_${dbfName}`;
  const vfpPath = legacyPath(dbfName, Object.values(fields));
  return legacyExec([
    `USE "${vfpPath}" IN 0 ALIAS ${alias} SHARED AGAIN`,
    `INSERT INTO ${alias} (${Object.keys(fields).join(', ')}) VALUES (${Object.values(fields).map((v) => `"${v}"`).join(', ')})`,
    `USE IN ${alias}`,
    'RETURN "OK"',
  ]);
}

function legacyPath(dbfName, values) {
  for (const v of values) {
    if (!/^[A-Za-z0-9 -]*$/.test(String(v))) throw new Error(`模擬舊系統寫入只接受英數字：${v}`);
  }
  return `${DBF_DIR}\\${dbfName}.dbf`.replace(/\\/g, '\\\\');
}

function legacyExec(lines) {
  const started = performance.now();
  const script = lines.join('\r\n');
  const b64 = Buffer.from(JSON.stringify({ action: 'EXEC_VFP', script }), 'utf8').toString('base64');
  return new Promise((resolve) => {
    const child = spawn(BRIDGE_EXE, [b64], { cwd: path.dirname(BRIDGE_EXE), windowsHide: true });
    const out = [];
    child.stdout.on('data', (c) => out.push(c));
    child.on('error', (err) => resolve({ ok: false, ms: performance.now() - started, error: err.message, text: '' }));
    child.on('close', () => {
      const text = Buffer.concat(out).toString('utf8').trim();
      let json;
      try { json = JSON.parse(text); } catch { /* 非 JSON */ }
      const ok = Boolean(json?.success) && json?.result === 'OK';
      resolve({ ok, status: ok ? 200 : 500, ms: performance.now() - started, json, text, error: ok ? undefined : (json?.error || json?.result || text) });
    });
  });
}

// ---------------------------------------------------------------- 工具
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const trim = (v) => (v == null ? '' : String(v).trim());
const fmtMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`);
const dbfRows = (name) => readActiveRows(path.join(DBF_DIR, `${name}.dbf`));
const readFileSize = (name) => statSync(path.join(DBF_DIR, `${name}.dbf`)).size;

function percentile(sorted, q) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))];
}

function summarize(samples) {
  const s = samples.map((x) => x.ms).sort((a, b) => a - b);
  return {
    n: s.length,
    p50: percentile(s, 0.5),
    p95: percentile(s, 0.95),
    p99: percentile(s, 0.99),
    max: s.length ? s[s.length - 1] : 0,
    errors: samples.filter((x) => !x.ok).length,
  };
}

function duplicates(rows, keyFn) {
  const map = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map].filter(([, c]) => c > 1);
}

function statusCounts(responses) {
  const map = new Map();
  for (const r of responses) {
    const k = r.status === 0 ? `連線失敗(${r.error})` : String(r.status);
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map].map(([k, c]) => `${k}×${c}`).join('、');
}

function errorSample(responses) {
  const bad = responses.find((r) => !r.ok);
  if (!bad) return '';
  const msg = bad.json?.message || bad.json?.error || bad.json?.title || bad.error || bad.text;
  const text = String(msg ?? '').replace(/\s+/g, ' ').replace(/ DETAIL: Detail redacted.*$/, '').slice(0, 200);
  return `${bad.status}: ${text || '(沒有錯誤訊息，後端未處理的例外)'}`;
}

const results = [];
function report(scenario, status, title, details = [], metrics = undefined) {
  results.push({ scenario, status, title, details, metrics });
  const color = { PASS: 32, FAIL: 31, WARN: 33, INFO: 36 }[status] || 0;
  console.log(`\x1b[${color}m[${status}]\x1b[0m ${scenario}: ${title}`);
  for (const d of details) console.log(`        ${d}`);
}

function fatal(msg) {
  console.error(`\x1b[31m[中止]\x1b[0m ${msg}`);
  process.exit(2);
}

// ---------------------------------------------------------------- 安全檢查
async function guard() {
  if (!/^[A-Z]$/.test(DRIVE)) fatal('請用 --drive 指定測試複本的磁碟機代號 (例如 --drive V)');
  if (DRIVE === 'C') fatal('不可對 C 碟執行：C:\\w3000\\comm 是正式資料');
  if (!existsSync(DBF_DIR)) fatal(`找不到 ${DBF_DIR}`);
  if (!args['allow-non-subst']) {
    let substList = '';
    try { substList = execFileSync('subst', [], { encoding: 'utf8' }); } catch { /* 沒有任何 subst */ }
    if (!new RegExp(`^${DRIVE}:\\\\: =>`, 'mi').test(substList)) {
      fatal(`${DRIVE}: 不是 subst 掛上的磁碟機。壓力測試會寫入資料，只能對複本執行；確定 ${DBF_DIR} 是複本時加 --allow-non-subst`);
    }
  }

  const health = await request(API, 'GET', '/health');
  if (!health.ok) fatal(`後端 ${API} 沒有回應 (${health.error || health.status})，請先啟動後端 (pnpm dev:api)`);
  const ping = await agent('GET', '/api/dbf/ping');
  if (!ping.ok || ping.json?.success === false) {
    fatal(`LocalAgent ${AGENT} 沒有回應或 DBFBridge 無法使用 (${ping.error || ping.status} ${trim(ping.text).slice(0, 120)})，請先啟動 (pnpm dev:agent)`);
  }

  const cfg = await request(API, 'GET', '/api/systemconfig');
  const serverDrive = trim(cfg.json?.dataDrive).toUpperCase();
  if (serverDrive && serverDrive === DRIVE) {
    fatal(`${DRIVE}: 是後端目前的預設磁碟機，可能是正式資料，拒絕執行`);
  }
  if (!existsSync(BRIDGE_EXE)) fatal(`找不到 ${BRIDGE_EXE} (用來模擬舊系統寫入)，請用 --bridge 指定 DBFBridge.exe`);
}

// ---------------------------------------------------------------- 準備共用資料
const READ_CANDIDATES = [
  '/api/wbase1020',
  '/api/wbase1030',
  '/api/wbase2010',
  '/api/wbase2040',
  '/api/wbase4020/descrip',
  '/api/wbase5010/bsdesc',
];
let readEndpoints = [];
let cpaCodes = [];

async function prepare() {
  cpaCodes = dbfRows('cpa').map((r) => trim(r.no)).filter(Boolean);
  if (cpaCodes.length < 2) fatal('cpa.dbf 至少要有 2 筆會計師資料才能執行寫入情境');
}

async function ensureReadEndpoints() {
  if (readEndpoints.length) return;
  for (const ep of READ_CANDIDATES) {
    const r = await api('GET', ep);
    if (r.ok) readEndpoints.push(ep);
    else console.log(`        (略過讀取端點 ${ep}：${r.status} ${errorSample([r])})`);
  }
  if (readEndpoints.length === 0) fatal('沒有任何讀取端點可用');
}

async function cpaRecord(code) {
  const r = await api('GET', `/api/wbase1020/${encodeURIComponent(code)}`);
  if (!r.ok || !r.json) throw new Error(`讀取會計師 ${code} 失敗：${errorSample([r])}`);
  return r.json;
}

// ---------------------------------------------------------------- 情境
/** 新的磁碟機第一次被讀取時，多人同時開畫面：每個請求都會發現沒有快照而同時建表、重灌。 */
async function coldSync() {
  const endpoints = ['/api/wbase1020', '/api/wbase1030', '/api/wbase5010/bsdesc', '/api/wbase4020/descrip'];
  const reqs = [];
  for (let i = 0; i < BURST; i++) for (const ep of endpoints) reqs.push(api('GET', ep).then((r) => ({ ...r, ep })));
  const res = await Promise.all(reqs);
  const failed = res.filter((r) => !r.ok);

  // 再讀一次，確認快照筆數與 DBF 相同 (同步失敗時 API 仍可能回 200 + 不完整的資料)
  const checks = [
    ['/api/wbase1020', 'cpa', (r) => trim(r.no)],
    ['/api/wbase1030', 'keyin', (r) => trim(r.no)],
    ['/api/wbase5010/bsdesc', 'bsdesc', (r) => String(r.seq)],
    ['/api/wbase4020/descrip', 'descrip', null],
  ];
  const mismatch = [];
  for (const [ep, dbf, keyFn] of checks) {
    const r = await api('GET', ep);
    const rows = dbfRows(dbf);
    const expected = keyFn ? new Set(rows.map(keyFn)).size : rows.length;
    const got = Array.isArray(r.json) ? r.json.length : -1;
    if (got !== expected) mismatch.push(`${ep}：API ${got} 筆，DBF ${expected} 筆`);
  }

  const details = [
    `${res.length} 個請求同時讀 4 張尚未建立快照的表 (每張 ${BURST} 個)，狀態：${statusCounts(res)}`,
    `最慢 ${fmtMs(Math.max(...res.map((r) => r.ms)))}`,
  ];
  if (failed.length) details.push(`錯誤範例 ${failed[0].ep} → ${errorSample(failed)}`);
  details.push(...mismatch);
  if (failed.length || mismatch.length) {
    report('cold-sync', 'FAIL', '多人同時第一次開啟畫面時，部分請求失敗或快照不完整', details);
  } else {
    report('cold-sync', 'PASS', '多人同時第一次開啟畫面，全部成功且快照完整', details);
  }
}

/** LocalAgent 把所有 DBF 動作排成一列，每個動作都重新啟動一次 32-bit DBFBridge.exe。 */
async function agentQueue() {
  const body = { filePath: `${DBF_DIR}\\cpa.dbf`, dbfPath: DBF_DIR, dbfName: 'cpa' };
  const single = [];
  for (let i = 0; i < 5; i++) single.push(await agent('POST', '/api/dbf/checksum', body));
  const singleAvg = single.reduce((a, r) => a + r.ms, 0) / single.length;

  const started = performance.now();
  const burst = await Promise.all(Array.from({ length: BURST }, () => agent('POST', '/api/dbf/checksum', body)));
  const wall = performance.now() - started;
  const s = summarize(burst);

  report('agent-queue', 'INFO', `LocalAgent 一次只執行一個 DBF 動作，每秒約 ${(1000 / singleAvg).toFixed(1)} 個`, [
    `單一 checksum 平均 ${fmtMs(singleAvg)} (每次都重新啟動 DBFBridge.exe 與 VFP COM)`,
    `${BURST} 個同時送出：全部完成 ${fmtMs(wall)}，最快 ${fmtMs(Math.min(...burst.map((r) => r.ms)))}、最慢 ${fmtMs(s.max)}；錯誤 ${s.errors}`,
    '網頁每次讀取都要先算一次 DBF checksum，所以全公司的讀取都排在這一列裡',
  ], { singleAvgMs: singleAvg, burstWallMs: wall, burstMaxMs: s.max });
}

/** 多個使用者不停地開清單畫面 (沒有思考時間，代表最壞情況)。 */
async function readLoad() {
  await ensureReadEndpoints();
  const rows = [];
  let worst = 'PASS';
  for (const users of USERS) {
    const samples = [];
    const until = Date.now() + DURATION * 1000;
    await Promise.all(Array.from({ length: users }, async (_, vu) => {
      let i = vu;
      while (Date.now() < until) {
        const ep = readEndpoints[i++ % readEndpoints.length];
        const r = await api('GET', ep);
        samples.push({ ms: r.ms, ok: r.ok, ep, status: r.status, err: r.ok ? '' : errorSample([r]) });
        if (THINK_MS) await sleep(THINK_MS);
      }
    }));
    const s = summarize(samples);
    const rps = s.n / DURATION;
    const level = s.errors ? 'FAIL' : s.p95 > SLOW_P95_MS ? 'WARN' : 'PASS';
    if (level === 'FAIL' || (level === 'WARN' && worst === 'PASS')) worst = level;
    rows.push({ users, ...s, rps, level, errSample: samples.find((x) => !x.ok)?.err || '' });
  }

  const details = [
    `端點：${readEndpoints.join('、')}`,
    '使用者 | 請求數 | 每秒 | p50 | p95 | p99 | 最慢 | 錯誤',
    ...rows.map((r) => `${String(r.users).padStart(5)} | ${String(r.n).padStart(6)} | ${r.rps.toFixed(1).padStart(5)} | ${fmtMs(r.p50)} | ${fmtMs(r.p95)} | ${fmtMs(r.p99)} | ${fmtMs(r.max)} | ${r.errors}${r.errSample ? ` (${r.errSample})` : ''}`),
  ];
  const title = worst === 'PASS'
    ? '各級人數下讀取都沒有錯誤，p95 在 3 秒內'
    : worst === 'WARN' ? `人數增加後 p95 超過 ${SLOW_P95_MS / 1000} 秒` : '人數增加後出現錯誤';
  report('read-load', worst, title, details, rows);
}

/** 舊系統改了 DBF 後，多人同時打開同一個畫面：每個請求都發現 checksum 不同而各自重灌。 */
async function stampede() {
  const cases = [
    { label: '會計師', dbf: 'cpa', ep: '/api/wbase1020', field: 'tel', codeKey: 'cpaCode', valueKey: 'tel' },
    { label: '客戶', dbf: 'customer', ep: '/api/wbase2010', field: 'fax', codeKey: 'companyCode', valueKey: 'fax' },
  ];
  for (const c of cases) {
    const rows = dbfRows(c.dbf);
    const target = trim(rows[0]?.no);
    if (!target) { report('stampede', 'WARN', `${c.dbf}.dbf 沒有資料，略過`); continue; }
    const marker = `ST${Date.now().toString().slice(-8)}`;

    // 先量一次單人重灌的時間，作為對照
    const w0 = await legacyWrite(c.dbf, 'no', target, { [c.field]: `${marker}0` });
    const single = await api('GET', c.ep);

    const w = await legacyWrite(c.dbf, 'no', target, { [c.field]: marker });
    if (!w0.ok || !w.ok || w.json?.success === false) {
      report('stampede', 'FAIL', `無法模擬舊系統寫入 ${c.dbf}.dbf`, [errorSample([w]) || trim(w.text).slice(0, 200)]);
      continue;
    }
    const started = performance.now();
    const res = await Promise.all(Array.from({ length: BURST }, () => api('GET', c.ep)));
    const wall = performance.now() - started;
    const stale = res.filter((r) => r.ok && !(Array.isArray(r.json) && r.json.some((x) => trim(x[c.codeKey]) === target && trim(x[c.valueKey]) === marker)));
    const failed = res.filter((r) => !r.ok);
    const details = [
      `${c.dbf}.dbf ${rows.length} 筆、${(readFileSize(c.dbf) / 1024).toFixed(0)} KB；單人讀取並重灌 ${fmtMs(single.ms)}`,
      `舊系統修改${c.label} ${target} 後，${BURST} 人同時開${c.label}清單：狀態 ${statusCounts(res)}；全部完成 ${fmtMs(wall)}，最慢 ${fmtMs(Math.max(...res.map((r) => r.ms)))}`,
      `看到舊資料的回應：${stale.length}`,
    ];
    if (failed.length) details.push(`錯誤範例：${errorSample(failed)}`);
    report('stampede', failed.length || stale.length ? 'FAIL' : 'PASS',
      failed.length || stale.length ? `${c.label}：重灌期間有請求失敗或拿到舊資料` : `${c.label}：同時重灌時全部成功且看到新資料`,
      details, { table: c.dbf, singleMs: single.ms, wallMs: wall });
  }
}

/**
 * 多人同時新增同一個代號：後端各自查 PostgreSQL 都說「不存在」。
 * 修正前 DBF 被插入多筆；修正後 LocalAgent 在 DBF 檔頭鎖內確認代號不存在才新增，其餘的人收到 409。
 */
async function dupKey() {
  const base = await cpaRecord(cpaCodes[0]);
  // cpa.no 只有 C(2)，找一個還沒用過的兩碼代號
  const used = new Set(dbfRows('cpa').map((r) => trim(r.no)));
  const code = [...'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((c) => `Z${c}`).find((c) => !used.has(c));
  if (!code) { report('dup-key', 'WARN', '找不到未使用的兩碼代號，略過'); return; }
  const body = { ...base, cpaCode: code, cpaName: '壓力測試重複代號', guid: '' };
  delete body.recordNumber;
  const res = await Promise.all(Array.from({ length: BURST }, () => api('POST', '/api/wbase1020', body)));
  const inDbf = dbfRows('cpa').filter((r) => trim(r.no) === code).length;
  const created = res.filter((r) => r.ok).length;
  const other = res.filter((r) => !r.ok && r.status !== 409);
  const details = [
    `${BURST} 人同時新增會計師代號 ${code}，狀態：${statusCounts(res)}`,
    `DBF 中代號 ${code} 的筆數：${inDbf}`,
  ];
  if (res.some((r) => !r.ok)) details.push(`錯誤範例：${errorSample(res)}`);
  let title;
  if (inDbf !== 1) title = `同一代號在 DBF 寫入了 ${inDbf} 筆 (DBF 沒有唯一限制，之後依代號修改只會找到第一筆)`;
  else if (created !== 1 || other.length) title = `DBF 只有一筆，但 ${created} 人收到成功、${other.length} 人收到 409 以外的錯誤`;
  report('dup-key', title ? 'FAIL' : 'PASS', title || '同一代號只寫入一筆，其餘的人收到 409', details);

  // 舊系統剛新增、PostgreSQL 快照還沒重灌時，網頁新增同一代號 (後端查快照會以為不存在)
  const used2 = new Set(dbfRows('cpa').map((r) => trim(r.no)));
  const code2 = [...'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((c) => `Y${c}`).find((c) => !used2.has(c));
  if (!code2) { report('dup-key', 'WARN', '找不到未使用的兩碼代號，略過舊系統新增的檢查'); return; }
  const lg = await legacyInsert('cpa', { no: code2, name: 'LEGACY' });
  if (!lg.ok) { report('dup-key', 'FAIL', '無法模擬舊系統新增 cpa.dbf', [String(lg.error || lg.text).slice(0, 200)]); return; }
  const web = await api('POST', '/api/wbase1020', { ...base, cpaCode: code2, cpaName: '壓力測試舊系統已新增', guid: '' });
  const inDbf2 = dbfRows('cpa').filter((r) => trim(r.no) === code2).length;
  const ok2 = inDbf2 === 1 && web.status === 409;
  report('dup-key', ok2 ? 'PASS' : 'FAIL',
    ok2 ? '舊系統剛新增的代號，網頁再新增時回 409' : '舊系統剛新增的代號，網頁仍可再新增一筆', [
      `舊系統新增會計師 ${code2} 後，網頁立刻新增同一代號：${web.status}${web.ok ? '' : ` ${errorSample([web])}`}`,
      `DBF 中代號 ${code2} 的筆數：${inDbf2}`,
    ]);
}

/**
 * 同時新增需要自動取號的資料：比對 DBF 中的號碼是否重複，並確認每個請求都成功、DBF 新增的筆數等於成功的回應數
 * (回應失敗但 DBF 已寫入，使用者會以為沒存到而重按)。
 */
function judgeNumbering(label, res, added, dup, keyName) {
  const created = res.filter((r) => r.ok).length;
  const k = /[A-Za-z]$/.test(keyName) ? `${keyName} ` : keyName; // 英文欄名後面空一格
  const details = [`${label}：${BURST} 人同時新增，狀態：${statusCounts(res)}；DBF 新增 ${added} 筆`];
  if (res.some((r) => !r.ok)) details.push(`錯誤範例：${errorSample(res)}`);
  if (dup.length) details.push(`DBF 重複的 ${keyName}：${dup.map(([k, c]) => `${k} (${c} 筆)`).join('、')}`);
  let title;
  if (dup.length) title = `${label}：${k}重複`;
  else if (created !== BURST) title = `${label}：${BURST - created} 個請求失敗`;
  else if (added !== created) title = `${label}：成功 ${created} 筆，DBF 卻新增 ${added} 筆`;
  return { status: title ? 'FAIL' : 'PASS', title: title || `${label}：${k}沒有重複，全部成功`, details };
}

async function numbering() {
  // 5-6 委任書條文：seq 由 VFP 在 DBF 檔頭鎖內取 MAX(seq)+1 (修正前由後端查 PostgreSQL 取號，沒有鎖)
  {
    const before = dbfRows('bsdesc').length;
    const res = await Promise.all(Array.from({ length: BURST }, (_, i) =>
      api('POST', '/api/wbase5010/bsdesc', { seq: 0, no: '', desc: `壓力測試條文 ${i + 1}`, sel: '', serial: 0 })));
    const rows = dbfRows('bsdesc');
    const r = judgeNumbering('5-6 委任書條文', res, rows.length - before, duplicates(rows, (x) => String(x.seq)), 'seq');
    report('numbering', r.status, r.title, r.details);
  }

  // 4-5 共用摘要：serial 由 VFP 取該科目 MAX(serial)+1 (修正前由後端查 PostgreSQL 取號，沒有鎖)
  {
    const acc = await api('GET', '/api/wbase4020/descrip/accounts');
    const accno = Array.isArray(acc.json) && acc.json.length ? trim(acc.json[0].accno) : '';
    if (!accno) {
      report('numbering', 'WARN', '4-5 共用摘要：找不到會計科目，略過', [errorSample([acc])]);
    } else {
      const before = dbfRows('descrip').length;
      const res = await Promise.all(Array.from({ length: BURST }, (_, i) =>
        api('POST', '/api/wbase4020/descrip', { accno, descrip: `壓力測試摘要 ${i + 1}` })));
      const rows = dbfRows('descrip');
      const dup = duplicates(rows.filter((x) => trim(x.accno) === accno), (x) => String(x.serial));
      const r = judgeNumbering(`4-5 共用摘要 (科目 ${accno})`, res, rows.length - before, dup, 'serial');
      report('numbering', r.status, r.title, r.details);
    }
  }

  // 2-4 客戶收費：單號由 VFP 在 DBF 檔頭鎖內取號 (修正前在後端用 SemaphoreSlim 排隊，擋不住舊系統同時新增)
  {
    const before = dbfRows('recmom').length;
    const res = await Promise.all(Array.from({ length: BURST }, () => api('POST', '/api/wbase2040')));
    const rows = dbfRows('recmom');
    const r = judgeNumbering('2-4 收費單', res, rows.length - before, duplicates(rows, (x) => trim(x.rno)), '單號');
    report('numbering', r.status, r.title, r.details);
  }
}

/** 兩人打開同一筆資料，各改不同欄位後存檔：後存的整筆覆蓋，先存的修改消失。 */
async function lostUpdate() {
  const code = cpaCodes[0];
  const a = await cpaRecord(code);
  const b = structuredClone(a);
  const stamp = Date.now().toString().slice(-6);
  a.tel = `LU-A-${stamp}`;
  b.fax = `LU-B-${stamp}`;
  const ra = await api('PUT', `/api/wbase1020/${encodeURIComponent(code)}`, a);
  const rb = await api('PUT', `/api/wbase1020/${encodeURIComponent(code)}`, b);
  const row = dbfRows('cpa').find((r) => trim(r.no) === code);
  const lost = trim(row?.tel) !== a.tel;
  const details = [
    `甲改電話為 ${a.tel} 先存 (${ra.status})，乙用存檔前打開的畫面改傳真為 ${b.fax} 後存 (${rb.status})`,
    `DBF 結果：電話 ${trim(row?.tel)}、傳真 ${trim(row?.fax)}`,
  ];
  report('lost-update', lost ? 'FAIL' : 'PASS',
    lost ? '後存檔的人整筆覆蓋，先存檔的修改不見了 (沒有版本檢查)' : '兩人的修改都保留', details);
}

/**
 * 網頁存檔與舊系統修改同時發生：
 * 後端「寫 DBF → 寫 PostgreSQL → 重新取 checksum 存入字典」之間若插進舊系統的修改，
 * 字典記下的 checksum 已包含舊系統的修改，但 PostgreSQL 沒有，之後讀取不會重灌，網頁一直看到舊資料。
 */
async function legacyRace() {
  const webCode = cpaCodes[0];
  const legacyCode = cpaCodes[1];
  let lost = 0;
  let persisted = 0;
  let skipped = 0;
  const examples = [];
  for (let i = 1; i <= ROUNDS; i++) {
    const legacyVal = `LG${i}-${Date.now().toString().slice(-6)}`;
    const rec = await cpaRecord(webCode);
    rec.tel = `WB${i}-${Date.now().toString().slice(-6)}`;
    const pWeb = api('PUT', `/api/wbase1020/${encodeURIComponent(webCode)}`, rec);
    await sleep(rand(0, 150));
    const pLegacy = legacyWrite('cpa', 'no', legacyCode, { fax: legacyVal });
    const [rw, rl] = await Promise.all([pWeb, pLegacy]);
    if (!rw.ok || !rl.ok || rl.json?.success === false) { skipped++; continue; }

    const g = await cpaRecord(legacyCode);
    if (trim(g.fax) !== legacyVal) {
      lost++;
      // 隔一秒再讀，確認不是暫時現象
      await sleep(1000);
      const again = await cpaRecord(legacyCode);
      if (trim(again.fax) !== legacyVal) persisted++;
      if (examples.length < 3) examples.push(`第 ${i} 輪：DBF 傳真 ${legacyVal}，網頁讀到 ${trim(again.fax)}`);
    }
  }
  const details = [
    `${ROUNDS} 輪：每輪網頁修改會計師 ${webCode} 的同時，舊系統修改會計師 ${legacyCode} 的傳真，接著用網頁讀 ${legacyCode}`,
    `網頁沒讀到舊系統修改：${lost} 輪 (其中 ${persisted} 輪隔 1 秒再讀仍是舊資料)；略過 ${skipped} 輪`,
    ...examples,
  ];
  report('legacy-race', lost ? 'FAIL' : 'PASS',
    lost ? '網頁存檔時若舊系統同時修改，舊系統的修改可能不會同步到網頁' : '舊系統的修改每輪都同步到網頁', details,
    { rounds: ROUNDS, lost, persisted, skipped });
}

/** 最後核對：網頁看到的資料 (PostgreSQL 快照) 與 DBF 是否一致。 */
async function consistency() {
  const issues = [];

  const cpaApi = await api('GET', '/api/wbase1020');
  const cpaDbf = dbfRows('cpa');
  if (Array.isArray(cpaApi.json)) {
    const firstByCode = new Map();
    for (const r of cpaDbf) if (!firstByCode.has(trim(r.no))) firstByCode.set(trim(r.no), r);
    if (cpaApi.json.length !== firstByCode.size) issues.push(`會計師：網頁 ${cpaApi.json.length} 筆，DBF ${firstByCode.size} 個代號`);
    for (const c of cpaApi.json) {
      const d = firstByCode.get(trim(c.cpaCode));
      if (!d) { issues.push(`會計師 ${c.cpaCode}：DBF 沒有這筆`); continue; }
      for (const [apiKey, dbfKey] of [['cpaName', 'name'], ['tel', 'tel'], ['fax', 'fax']]) {
        if (trim(c[apiKey]) !== trim(d[dbfKey])) issues.push(`會計師 ${c.cpaCode} 的 ${dbfKey}：網頁「${trim(c[apiKey])}」，DBF「${trim(d[dbfKey])}」`);
      }
    }
    const dup = duplicates(cpaDbf, (r) => trim(r.no));
    if (dup.length) issues.push(`cpa.dbf 有重複代號：${dup.map(([k, c]) => `${k} (${c} 筆)`).join('、')}`);
  } else {
    issues.push(`讀取會計師清單失敗：${errorSample([cpaApi])}`);
  }

  for (const [ep, dbf, keyFn, label] of [
    ['/api/wbase5010/bsdesc', 'bsdesc', (r) => String(r.seq), '委任書條文'],
    ['/api/wbase4020/descrip', 'descrip', null, '共用摘要'],
    ['/api/wbase2040', 'recmom', null, '收費單'],
  ]) {
    const r = await api('GET', ep);
    const rows = dbfRows(dbf);
    const expected = keyFn ? new Set(rows.map(keyFn)).size : rows.length;
    const got = Array.isArray(r.json) ? r.json.length : Array.isArray(r.json?.items) ? r.json.items.length : -1;
    if (got !== expected) issues.push(`${label}：網頁 ${got} 筆，DBF ${expected} 筆${keyFn && expected !== rows.length ? ` (DBF 共 ${rows.length} 筆，主鍵重複的只會顯示第一筆)` : ''}`);
  }

  report('consistency', issues.length ? 'FAIL' : 'PASS',
    issues.length ? '測試結束時網頁資料與 DBF 不一致' : '測試結束時網頁資料與 DBF 一致', issues.slice(0, 15));
}

// ---------------------------------------------------------------- 主程式
function writeReport(meta) {
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const jsonPath = path.join(OUT_DIR, `stress-${stamp}.json`);
  const mdPath = path.join(OUT_DIR, `stress-${stamp}.md`);
  writeFileSync(jsonPath, JSON.stringify({ meta, results }, null, 2), 'utf8');
  const md = [
    `# Wx3000 壓力測試結果 ${meta.startedAt}`,
    '',
    `- 後端：${meta.api}；LocalAgent：${meta.agent}；測試磁碟機：${meta.drive}:`,
    `- 使用者級數：${meta.users.join(', ')}；每級 ${meta.duration} 秒；同時請求數：${meta.burst}；競態輪數：${meta.rounds}`,
    '',
    '| 結果 | 情境 | 說明 |',
    '| --- | --- | --- |',
    ...results.map((r) => `| ${r.status} | ${r.scenario} | ${r.title} |`),
    '',
    ...results.flatMap((r) => [`## ${r.status} ${r.scenario}：${r.title}`, '', ...r.details.map((d) => `- ${d}`), '']),
  ].join('\n');
  writeFileSync(mdPath, md, 'utf8');
  return { jsonPath, mdPath };
}

async function main() {
  const selected = !args.scenarios || args.scenarios === 'all' || args.scenarios === true
    ? Object.keys(SCENARIOS)
    : String(args.scenarios).split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = selected.filter((s) => !SCENARIOS[s]);
  if (unknown.length) fatal(`未知的情境：${unknown.join(', ')}；可用：${Object.keys(SCENARIOS).join(', ')}`);

  await guard();
  await prepare();
  const meta = {
    startedAt: new Date().toLocaleString('zh-TW', { hour12: false }),
    api: API, agent: AGENT, drive: DRIVE, users: USERS, duration: DURATION, burst: BURST, rounds: ROUNDS, scenarios: selected,
  };
  console.log(`Wx3000 壓力測試：後端 ${API}，LocalAgent ${AGENT}，測試資料 ${DBF_DIR}`);
  console.log(`情境：${selected.join(', ')}\n`);

  for (const name of selected) {
    try {
      await SCENARIOS[name]();
    } catch (err) {
      report(name, 'FAIL', `測試程式執行失敗：${err.message}`);
    }
  }

  const { mdPath } = writeReport(meta);
  const counts = ['PASS', 'WARN', 'FAIL', 'INFO'].map((s) => `${s} ${results.filter((r) => r.status === s).length}`).join('、');
  console.log(`\n結果：${counts}\n報告：${mdPath}`);
  keepAlive.destroy();
  process.exitCode = results.some((r) => r.status === 'FAIL') ? 1 : 0;
}

main();
