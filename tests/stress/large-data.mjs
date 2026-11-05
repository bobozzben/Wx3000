#!/usr/bin/env node
// Wx3000 大量資料壓力測試 (Node 18 以上，不需額外套件)
//
// 把測試複本裡的資料表用 VFP 灌到指定筆數 (例如一萬、三萬筆)，量測每一級的：
//   DBF checksum 成本、重灌腳本大小與時間、清單 API 冷/熱讀取、多人同時讀取、
//   舊系統改了一筆後多人同時開畫面 (整表重灌)、大表重灌時其他畫面是否被擋住、網頁存檔、
//   多人同時存檔 (是否被當成外部修改而整表重灌)、客戶表變動後存收費單 (跨畫面)。
// 會大幅改寫資料，只能對 subst 掛上的測試複本執行；一般請用 Run-StressTest.ps1 -Suite large，它會建立複本並在測完後清除。
//
//   node tests/stress/large-data.mjs --drive V [--api http://localhost:5007] [--agent http://127.0.0.1:5009]
//        [--rows 10000,30000] [--tables buyinv,recmom,customer] [--users 1,5,10] [--duration 10] [--burst 5] [--out 目錄]
//
// 有任何 FAIL 時結束代碼為 1。

import http from 'node:http';
import crypto from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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
const ROW_LEVELS = String(args.rows || '10000,30000').split(',').map(Number).filter((n) => n > 0).sort((a, b) => a - b);
const TABLE_NAMES = String(args.tables || 'buyinv,recmom,customer').split(',').map((s) => s.trim()).filter(Boolean);
const USERS = String(args.users || '1,5,10').split(',').map(Number).filter((n) => n > 0);
const DURATION = Number(args.duration || 10);
const BURST = Number(args.burst || 5);
const OUT_DIR = path.resolve(String(args.out || path.join(__dirname, '..', 'out', 'stress')));
const DBF_DIR = `${DRIVE}:\\w3000\\comm`;
const BRIDGE_EXE = path.resolve(String(args.bridge || path.join(__dirname, '..', '..', 'localagent', 'bridge', 'lazarus', 'DBFBridge.exe')));
const SLOW_P95_MS = 3000;
const HTTP_TIMEOUT_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------- HTTP
const keepAlive = new http.Agent({ keepAlive: true, maxSockets: 512 });

// 用 node:http 而不是 fetch：LocalAgent 的 /api/dbf/* 會拒絕帶 Origin 的請求
function request(base, method, urlPath, body, headers = {}) {
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
        const buf = Buffer.concat(chunks);
        const text = buf.toString('utf8');
        let json;
        try { json = text ? JSON.parse(text) : undefined; } catch { /* 非 JSON */ }
        const status = res.statusCode || 0;
        resolve({ status, ok: status >= 200 && status < 300, ms: performance.now() - started, json, text, bytes: buf.length });
      });
    });
    req.setTimeout(HTTP_TIMEOUT_MS, () => req.destroy(new Error('timeout')));
    req.on('error', (err) => resolve({ status: 0, ok: false, ms: performance.now() - started, error: err.message, text: '', bytes: 0 }));
    if (payload) req.write(payload);
    req.end();
  });
}

const api = (method, urlPath, body) => request(API, method, urlPath, body, { 'X-Data-Drive': DRIVE });
const agent = (method, urlPath, body) => request(AGENT, method, urlPath, body);

/** 另外啟動一個 32-bit DBFBridge.exe 執行 VFP 腳本：和真正的 VFP 工作站一樣不經 LocalAgent 的隊列與後端。 */
function bridgeExec(script) {
  const started = performance.now();
  const b64 = Buffer.from(JSON.stringify({ action: 'EXEC_VFP', script }), 'utf8').toString('base64');
  return new Promise((resolve) => {
    const child = spawn(BRIDGE_EXE, [b64], { cwd: path.dirname(BRIDGE_EXE), windowsHide: true });
    const out = [];
    child.stdout.on('data', (c) => out.push(c));
    child.on('error', (err) => resolve({ ok: false, ms: performance.now() - started, error: err.message }));
    child.on('close', () => {
      const text = Buffer.concat(out).toString('utf8').trim();
      let json;
      try { json = JSON.parse(text); } catch { /* 非 JSON */ }
      const result = String(json?.result ?? '');
      const ok = Boolean(json?.success) && result.startsWith('OK');
      resolve({ ok, ms: performance.now() - started, result, error: ok ? undefined : (json?.error || result || text) });
    });
  });
}

const vfpPath = (dbf) => `${DBF_DIR}\\${dbf}.dbf`.replace(/\\/g, '\\\\');

/** 模擬舊系統修改一筆記錄 (值只能是英數字測試標記)。 */
function legacyWrite(dbf, keyField, keyValue, fields) {
  for (const v of [keyValue, ...Object.values(fields)]) {
    if (!/^[A-Za-z0-9 -]*$/.test(String(v))) throw new Error(`legacyWrite 只接受英數字：${v}`);
  }
  const alias = `lg_${dbf}`;
  return bridgeExec([
    `USE "${vfpPath(dbf)}" IN 0 ALIAS ${alias} SHARED AGAIN`,
    `SELECT ${alias}`,
    `LOCATE FOR ALLTRIM(${keyField}) == "${keyValue}"`,
    'IF EOF()',
    `  USE IN ${alias}`,
    '  RETURN "RECORD_NOT_FOUND"',
    'ENDIF',
    `REPLACE ${Object.entries(fields).map(([k, v]) => `${alias}.${k} WITH "${v}"`).join(', ')}`,
    `USE IN ${alias}`,
    'RETURN "OK"',
  ].join('\r\n'));
}

/**
 * 用 VFP 把資料表灌到 target 筆：每次複製現有記錄 (最多一倍) 再 APPEND FROM，索引 (CDX) 由 VFP 一併維護。
 * 新增的記錄主鍵改成 "Z" + RECNO()，不和原有資料重複。
 */
function inflate(dbf, target, keyField, keyWidth) {
  return bridgeExec([
    'LOCAL n0, need, tpl, loops',
    'SET SAFETY OFF',
    `USE "${vfpPath(dbf)}" IN 0 ALIAS wxbig EXCLUSIVE`,
    'SELECT wxbig',
    'n0 = RECCOUNT()',
    'loops = 0',
    `DO WHILE RECCOUNT() < ${target} AND RECCOUNT() > 0 AND loops < 200`,
    '  loops = loops + 1',
    `  need = MIN(${target} - RECCOUNT(), RECCOUNT())`,
    '  tpl = ADDBS(SYS(2023)) + "wx" + SYS(2015)',
    '  GO TOP',
    '  COPY TO (tpl) NEXT need',
    '  APPEND FROM (tpl)',
    '  DELETE FILE (tpl + ".dbf")',
    '  IF FILE(tpl + ".fpt")',
    '    DELETE FILE (tpl + ".fpt")',
    '  ENDIF',
    'ENDDO',
    `REPLACE ALL ${keyField} WITH "Z" + PADL(TRANSFORM(RECNO()), ${keyWidth - 1}, "0") FOR RECNO() > n0`,
    'need = RECCOUNT()',
    'USE IN wxbig',
    'RETURN "OK:" + TRANSFORM(need)',
  ].join('\r\n'));
}

// ---------------------------------------------------------------- 工具
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const trim = (v) => (v == null ? '' : String(v).trim());
const fmtMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`);
const fmtBytes = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
const dbfFile = (dbf) => path.join(DBF_DIR, `${dbf}.dbf`);
const listOf = (json) => (Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : null);
const marker = (prefix, width) => (prefix + Date.now().toString()).slice(0, 2) + Date.now().toString().slice(-(width - 2));
// 多人同時存檔用：同一毫秒送出也不會重複 (前綴 2 字 + 使用者編號 2 位 + 時間)
const userMarker = (prefix, i, width) => {
  const head = `${prefix.slice(0, 2)}${String(i).padStart(2, '0')}`;
  return head + Date.now().toString().slice(-(width - head.length));
};
const WRITE_ROUNDS = 3;

function percentile(sorted, q) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))];
}

function summarize(samples) {
  const s = samples.map((x) => x.ms).sort((a, b) => a - b);
  return { n: s.length, p50: percentile(s, 0.5), p95: percentile(s, 0.95), max: s.length ? s[s.length - 1] : 0, errors: samples.filter((x) => !x.ok).length };
}

function errorSample(responses) {
  const bad = responses.find((r) => !r.ok);
  if (!bad) return '';
  const msg = bad.json?.message || bad.json?.error || bad.json?.title || bad.error || bad.text;
  const text = String(msg ?? '').replace(/\s+/g, ' ').replace(/ DETAIL: Detail redacted.*$/, '').slice(0, 200);
  return `${bad.status}: ${text || '(沒有錯誤訊息)'}`;
}

const results = [];
const summaryRows = [];
function report(scenario, status, title, details = []) {
  results.push({ scenario, status, title, details });
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
      fatal(`${DRIVE}: 不是 subst 掛上的磁碟機。這個測試會大幅改寫資料，只能對複本執行；確定 ${DBF_DIR} 是複本時加 --allow-non-subst`);
    }
  }
  const health = await request(API, 'GET', '/health');
  if (!health.ok) fatal(`後端 ${API} 沒有回應 (${health.error || health.status})，請先啟動後端`);
  const ping = await agent('GET', '/api/dbf/ping');
  if (!ping.ok || ping.json?.success === false) fatal(`LocalAgent ${AGENT} 沒有回應或 DBFBridge 無法使用，請先啟動`);
  const cfg = await request(API, 'GET', '/api/systemconfig');
  const serverDrive = trim(cfg.json?.dataDrive).toUpperCase();
  if (serverDrive && serverDrive === DRIVE) fatal(`${DRIVE}: 是後端目前的預設磁碟機，可能是正式資料，拒絕執行`);
  if (!existsSync(BRIDGE_EXE)) fatal(`找不到 ${BRIDGE_EXE}，請用 --bridge 指定 DBFBridge.exe`);
}

// ---------------------------------------------------------------- 資料表設定
// expected：快照完整時清單 API 應回傳的筆數 (依各畫面的 keyFields 與篩選條件，從 DBF 直接算)
const TABLES = {
  customer: {
    label: '客戶 (2010)',
    dbf: 'customer', key: 'no', keyWidth: 8,
    fields: ['no', 'fax'],
    listPath: () => '/api/wbase2010',
    expected: (rows) => new Set(rows.map((r) => trim(r.no)).filter(Boolean)).size,
    mark: { field: 'fax', width: 20, apiKey: 'companyCode', apiField: 'fax' },
    // 網頁存檔：先讀單筆再整筆 PUT (與畫面相同)
    write: async (code, value) => {
      const g = await api('GET', `/api/wbase2010/${encodeURIComponent(code)}`);
      if (!g.ok || !g.json) return g;
      const p = await api('PUT', `/api/wbase2010/${encodeURIComponent(code)}`, { ...g.json, fax: value });
      return { ...p, ms: g.ms + p.ms };
    },
    // 收費單 (2040) 存檔時也會同步客戶表：客戶表變大或剛被舊系統改過時，別的畫面存檔也要等
    crossWrite: true,
    // 快照同步不了時，再測新增與存檔 (見 staleWrites)
    staleWrites: true,
  },
  buyinv: {
    label: '進項發票 (3020)',
    dbf: 'buyinv', key: 'no', keyWidth: 10,
    fields: ['no', 'yymm', 'times', 'name'],
    setup(rows) {
      const counts = new Map();
      for (const r of rows) {
        const k = `${trim(r.yymm)}|${trim(r.times)}`;
        if (trim(r.no)) counts.set(k, (counts.get(k) || 0) + 1);
      }
      const [best] = [...counts].sort((a, b) => b[1] - a[1]);
      if (!best) return null;
      const [yymm, times] = best[0].split('|');
      return { yymm, times };
    },
    // 3020 清單會直接讀客戶快照 (不會自己同步 customer)，所以先開一次客戶清單
    prime: ['/api/wbase2010'],
    listPath: (ctx) => `/api/wbase3020?period=${encodeURIComponent(ctx.yymm)}&times=${encodeURIComponent(ctx.times)}`,
    // 3020 清單只列這一期、每家公司一筆
    expected: (rows, ctx) => new Set(rows
      .filter((r) => trim(r.yymm) === ctx.yymm && trim(r.times) === ctx.times && trim(r.no))
      .map((r) => trim(r.no).toUpperCase())).size,
    inScope: (r, ctx) => trim(r.yymm) === ctx.yymm && trim(r.times) === ctx.times,
    mark: { field: 'name', width: 10, apiKey: 'companyCode', apiField: 'companyShortName' },
    // 網頁存檔：先讀單筆再整筆 PUT (與畫面相同)
    write: async (code, value, ctx) => {
      const url = `/api/wbase3020/${encodeURIComponent(ctx.yymm)}/${encodeURIComponent(ctx.times)}/${encodeURIComponent(code)}`;
      const g = await api('GET', url);
      if (!g.ok || !g.json) return g;
      const p = await api('PUT', url, { ...g.json, companyShortName: value });
      return { ...p, ms: g.ms + p.ms };
    },
  },
  recmom: {
    label: '收費單 (2040)',
    dbf: 'recmom', key: 'rno', keyWidth: 10,
    fields: ['rno', 'recman', 'isover'],
    listPath: () => '/api/wbase2040',
    expected: (rows) => rows.length,
    mark: { field: 'recman', width: 10, apiKey: 'rno', apiField: 'recman' },
    // 已全部收款 (isover = *) 的收費單不能改表頭，網頁存檔只挑未收款的
    writable: (r) => trim(r.isover) !== '*',
    write: (rno, value) => recmomWrite(rno, value),
  },
};

/** 收費單表頭離開欄位時的存檔 (VFP Text1.LostFocus)：後端會同步 recmom、recmod 與 customer 後再寫入 */
function recmomWrite(rno, value) {
  return api('PUT', `/api/wbase2040/${encodeURIComponent(rno)}`, { recman: value });
}
const SMALL_READ = '/api/wbase1020';

// ---------------------------------------------------------------- 量測
async function agentChecksum(dbf) {
  return agent('POST', '/api/dbf/checksum', { filePath: dbfFile(dbf), dbfPath: DBF_DIR, dbfName: dbf });
}

function nodeSha256Ms(dbf) {
  const started = performance.now();
  crypto.createHash('sha256').update(readFileSync(dbfFile(dbf))).digest('hex');
  return performance.now() - started;
}

/**
 * 等 LocalAgent 把隊列裡的工作做完：後端逾時放棄的請求，LocalAgent 仍會照樣執行。
 * PING 也排在同一列，回應變快就代表前面的工作都做完了。
 */
async function drainAgent(tag) {
  const started = performance.now();
  const deadline = Date.now() + 30 * 60 * 1000;
  while (Date.now() < deadline) {
    const r = await agent('GET', '/api/dbf/ping');
    if (r.ok && r.ms < 2000) break;
  }
  const waited = performance.now() - started;
  if (waited > 3000) report(tag, 'INFO', `等 LocalAgent 做完積壓的工作 ${fmtMs(waited)}`, ['後端逾時放棄的請求，LocalAgent 仍會照樣執行，期間所有人的 DBF 讀寫都要排在後面']);
  return waited;
}

async function readsFor(ep, users, seconds) {
  const samples = [];
  const until = Date.now() + seconds * 1000;
  await Promise.all(Array.from({ length: users }, async () => {
    while (Date.now() < until) {
      const r = await api('GET', ep);
      samples.push({ ms: r.ms, ok: r.ok, err: r.ok ? '' : errorSample([r]) });
    }
  }));
  return summarize(samples);
}

function hasMark(res, t, key, value) {
  const list = listOf(res.json);
  return Boolean(list && list.some((x) => trim(x[t.mark.apiKey]).toUpperCase() === key.toUpperCase() && trim(x[t.mark.apiField]) === value));
}

/**
 * 客戶快照同步不了 (停在舊版) 時的寫入 (2010)：
 *   a. 新增一個 DBF 已有、但快照沒有的代號：後端新增前只查快照，判定不存在就 INSERT 進 DBF
 *   b. LocalAgent 隊列被重灌塞住時存檔：後端等 60 秒就放棄並回錯誤，但這筆寫入仍排在 LocalAgent 隊列裡
 */
async function staleWrites(t, tag, listRes, targets, sum) {
  const list = listOf(listRes.json) || [];
  const inSnapshot = new Set(list.map((x) => trim(x.companyCode).toUpperCase()));
  const template = list.find((x) => trim(x.companyCode).startsWith('Z')) || list[0];
  if (!template) return;
  const dbfRowsOf = (key) => readActiveRows(dbfFile(t.dbf), { fields: [t.key, 'fax'] }).filter((r) => trim(r[t.key]).toUpperCase() === key.toUpperCase());

  // a. 新增 DBF 已有、快照沒有的代號
  const ghost = [...targets].reverse().find((k) => !inSnapshot.has(k.toUpperCase()));
  if (ghost) {
    const before = dbfRowsOf(ghost).length;
    const res = await api('POST', '/api/wbase2010', { ...template, companyCode: ghost, fax: marker('SC', 20) });
    await drainAgent(tag);
    const after = dbfRowsOf(ghost).length;
    sum.staleDup = after > before;
    report(tag, after > before ? 'FAIL' : 'PASS', after > before
      ? `快照停在舊版時新增 ${ghost}：DBF 多了一筆重複代號 (${before} → ${after} 筆)`
      : `快照停在舊版時新增 ${ghost}：DBF 沒有重複 (${after} 筆)`, [
      `POST 回 ${res.status} (${fmtMs(res.ms)})；這個代號在 DBF 裡已經有了，只是快照沒有`,
      ...(res.ok ? [] : [errorSample([res])]),
      ...(after > before ? ['後端新增前只查 PostgreSQL 快照，判定不存在就 INSERT 進 DBF'] : []),
    ]);
  }

  // b. 重灌把 LocalAgent 隊列塞住時存檔
  const code = trim(template.companyCode);
  const mk = marker('TO', 20);
  const reload = api('GET', t.listPath()); // 快照與 DBF 不一致，這次讀取會再試一次整表重灌
  await sleep(4000); // 等重灌的 checksum 與結構腳本做完，讓存檔排在產生資料腳本的後面
  const put = await api('PUT', `/api/wbase2010/${encodeURIComponent(code)}`, { ...template, fax: mk });
  await reload;
  const drained = await drainAgent(tag);
  const written = dbfRowsOf(code).some((r) => trim(r.fax) === mk);
  const busy = put.json?.error && /LocalAgent 忙碌|未執行寫入/.test(`${put.json.error} ${put.json.message}`);
  const unconfirmed = /無法確認/.test(String(put.json?.message ?? ''));
  Object.assign(sum, { timeoutWriteOk: put.ok, timeoutWriteLanded: written });
  // 回覆要和 DBF 一致：說成功就要寫入、說失敗就不能寫入；回「無法確認」時兩種都可能
  const lost = !put.ok && !unconfirmed && written;
  const phantom = put.ok && !written;
  report(tag, lost || phantom ? 'FAIL' : 'PASS', lost
    ? `重灌塞住 LocalAgent 時存檔：網頁回 ${put.status} 存檔失敗 (${fmtMs(put.ms)})，但 LocalAgent 之後仍把資料寫進 DBF`
    : `重灌塞住 LocalAgent 時存檔：網頁回 ${put.status} (${fmtMs(put.ms)})，DBF ${written ? '已' : '沒有'}寫入${busy ? '，LocalAgent 排隊逾時後沒有執行這筆寫入' : ''}`, [
    `存完後 LocalAgent 又花了 ${fmtMs(drained)} 才做完積壓的工作`,
    ...(put.ok ? [] : [errorSample([put])]),
    ...(lost ? ['使用者以為沒存到而再存一次或改用舊系統輸入；PostgreSQL 沒有這次修改，checksum 字典也沒更新'] : []),
    ...(phantom ? ['網頁回成功，DBF 卻沒有這次修改'] : []),
  ]);
}

async function runLevel(t, n, ctx, smallBaseline, crossCtx) {
  const tag = `${t.dbf}@${n}`;
  const sum = { table: t.dbf, rows: n };

  // 1. 灌資料
  const inf = await inflate(t.dbf, n, t.key, t.keyWidth);
  if (!inf.ok) { report(tag, 'FAIL', `無法把 ${t.dbf}.dbf 灌到 ${n} 筆`, [String(inf.error).slice(0, 300)]); return; }
  const fileBytes = statSync(dbfFile(t.dbf)).size;
  const rows = readActiveRows(dbfFile(t.dbf), { fields: t.fields });
  const expected = t.expected(rows, ctx);
  const targets = rows
    .filter((r) => trim(r[t.key]).startsWith('Z') && (!t.inScope || t.inScope(r, ctx)) && (!t.writable || t.writable(r)))
    .map((r) => trim(r[t.key]));
  Object.assign(sum, { fileBytes, active: rows.length, expected });
  report(tag, 'INFO', `${t.label}：DBF ${rows.length} 筆 (未刪除)、${fmtBytes(fileBytes)}`, [`灌資料 ${fmtMs(inf.ms)} (${inf.result})；清單應有 ${expected} 筆`]);

  // 2. checksum：每次讀取都要先算一次，而且排在 LocalAgent 的單一隊列裡
  const cks = [];
  for (let i = 0; i < 3; i++) cks.push(await agentChecksum(t.dbf));
  const ckAvg = cks.reduce((a, r) => a + r.ms, 0) / cks.length;
  const nodeMs = nodeSha256Ms(t.dbf);
  sum.checksumMs = ckAvg;
  report(tag, cks.some((r) => !r.ok || r.json?.success === false) ? 'FAIL' : 'INFO', `checksum 平均 ${fmtMs(ckAvg)} (DBFBridge + VFP)`, [
    `同一個檔案用 Node crypto 直接算 SHA-256：${fmtMs(nodeMs)}`,
    `LocalAgent 一次只做一個 DBF 動作，所以這張表每秒最多約 ${(1000 / ckAvg).toFixed(1)} 次讀取 (全公司共用)`,
  ]);

  // 3. 重灌腳本：VFP 一次產生整張表的 INSERT 文字
  const ps = await agent('POST', '/api/dbf/get_pg_script', {
    dbfPath: DBF_DIR, dbfName: t.dbf, mode: 'DATA', schema: `${DRIVE.toLowerCase()}:/w3000/comm`, table: t.dbf, keyFields: '', hexFields: '',
  });
  const scriptLen = typeof ps.json?.script === 'string' ? Buffer.byteLength(ps.json.script, 'utf8') : 0;
  const psOk = ps.ok && ps.json?.success !== false && scriptLen > 0;
  Object.assign(sum, { scriptMs: ps.ms, scriptBytes: scriptLen, scriptOk: psOk });
  report(tag, psOk ? 'INFO' : 'FAIL', psOk ? `重灌資料腳本 ${fmtBytes(scriptLen)}，VFP 產生 ${fmtMs(ps.ms)}` : '無法產生重灌資料腳本', psOk ? [
    `回應 JSON ${fmtBytes(ps.bytes)}`,
  ] : [`${ps.status} ${trim(ps.json?.error || ps.error || ps.text).slice(0, 300)}`]);

  // 4. 冷讀取：DBF 變了，第一個開畫面的人要等整表重灌
  const cold = await api('GET', t.listPath(ctx));
  const coldList = listOf(cold.json);
  const coldCount = coldList ? coldList.length : -1;
  Object.assign(sum, { coldMs: cold.ms, coldOk: cold.ok && coldCount === expected, payloadBytes: cold.bytes });
  const coldLevel = !cold.ok || coldCount !== expected ? 'FAIL' : cold.ms > 10000 ? 'WARN' : 'PASS';
  report(tag, coldLevel, coldLevel === 'FAIL' ? '整表重灌失敗或快照不完整' : `整表重灌後開清單 ${fmtMs(cold.ms)}`, [
    `狀態 ${cold.status}，清單 ${coldCount} 筆 (DBF 應有 ${expected} 筆)，回應 ${fmtBytes(cold.bytes)}`,
    ...(cold.ok ? [] : [errorSample([cold])]),
    ...(cold.ok && coldCount !== expected ? ['API 回 200 但筆數不符：重灌失敗時後端會沿用舊快照 (見後端日誌 [DbfSync])'] : []),
  ]);

  if (!cold.ok) {
    summaryRows.push(sum);
    return false;
  }
  if (!sum.coldOk) {
    // 快照同步不了：之後每次開畫面都會再試一次重灌，量一次「卡住」時開這張表與開小表各要多久，其餘項目略過
    const stuckBig = api('GET', t.listPath(ctx));
    await sleep(1000);
    const stuckSmall = await api('GET', SMALL_READ);
    const big = await stuckBig;
    const bigList = listOf(big.json);
    Object.assign(sum, { warmMs: big.ms, blockedSmallMs: stuckSmall.ms, stuck: true });
    report(tag, 'FAIL', `快照同步不了：再開一次清單 ${fmtMs(big.ms)}，同時開會計師清單 ${fmtMs(stuckSmall.ms)} (平常 ${fmtMs(smallBaseline)})`, [
      `清單仍是 ${bigList ? bigList.length : '?'} 筆；每次開這個畫面都會重新算 checksum、重試重灌，直到逾時`,
      '後端放棄的重灌仍在 LocalAgent 裡執行，排在後面的所有讀寫 (包括其他畫面的小表) 都要等',
    ]);
    await drainAgent(tag);
    if (t.staleWrites) await staleWrites(t, tag, big, targets, sum);
    summaryRows.push(sum);
    return false;
  }

  // 5. 熱讀取：DBF 沒變，只算 checksum + 查 PostgreSQL + 傳 JSON
  const warm = [];
  for (let i = 0; i < 3; i++) warm.push(await api('GET', t.listPath(ctx)));
  const warmS = summarize(warm);
  sum.warmMs = warmS.p50;
  report(tag, warmS.errors ? 'FAIL' : warmS.p50 > SLOW_P95_MS ? 'WARN' : 'PASS', `沒有變動時開清單 ${fmtMs(warmS.p50)}`, [
    `checksum 約 ${fmtMs(ckAvg)}，其餘是 PostgreSQL 查詢、序列化與傳輸 ${fmtBytes(warm[0]?.bytes || 0)}`,
  ]);

  // 6. 多人同時開清單 (沒有變動)
  const loadRows = [];
  for (const u of USERS) loadRows.push({ u, ...(await readsFor(t.listPath(ctx), u, DURATION)) });
  const worst = loadRows[loadRows.length - 1];
  sum.loadP95 = worst.p95;
  sum.loadUsers = worst.u;
  const loadLevel = loadRows.some((r) => r.errors) ? 'FAIL' : worst.p95 > SLOW_P95_MS ? 'WARN' : 'PASS';
  report(tag, loadLevel, `${worst.u} 人同時開清單 p95 ${fmtMs(worst.p95)}`, [
    '使用者 | 請求數 | p50 | p95 | 最慢 | 錯誤',
    ...loadRows.map((r) => `${String(r.u).padStart(5)} | ${String(r.n).padStart(6)} | ${fmtMs(r.p50)} | ${fmtMs(r.p95)} | ${fmtMs(r.max)} | ${r.errors}`),
  ]);

  // 7. 舊系統改了一筆後，多人同時開清單：每個請求都發現 checksum 不同，各自整表重灌
  const target = targets[targets.length - 1];
  if (target) {
    await drainAgent(tag);
    const mk = marker('LG', t.mark.width);
    const lw = await legacyWrite(t.dbf, t.key, target, { [t.mark.field]: mk });
    if (!lw.ok) {
      report(tag, 'FAIL', '無法模擬舊系統修改', [String(lw.error).slice(0, 200)]);
    } else {
      const started = performance.now();
      const res = await Promise.all(Array.from({ length: BURST }, () => api('GET', t.listPath(ctx))));
      const wall = performance.now() - started;
      const failed = res.filter((r) => !r.ok);
      const stale = res.filter((r) => r.ok && !hasMark(r, t, target, mk));
      Object.assign(sum, { churnWallMs: wall, churnFail: failed.length + stale.length });
      const level = failed.length || stale.length ? 'FAIL' : wall > 30000 ? 'WARN' : 'PASS';
      report(tag, level, `舊系統改一筆後 ${BURST} 人同時開清單：全部完成 ${fmtMs(wall)}`, [
        `最快 ${fmtMs(Math.min(...res.map((r) => r.ms)))}、最慢 ${fmtMs(Math.max(...res.map((r) => r.ms)))}；失敗 ${failed.length}、看到舊資料 ${stale.length}`,
        ...(failed.length ? [errorSample(failed)] : []),
      ]);
    }

    // 8. 大表重灌時，別人開小表畫面要等多久 (LocalAgent 隊列與 PostgreSQL 都被重灌占住)
    await drainAgent(tag);
    const mk2 = marker('HL', t.mark.width);
    const lw2 = await legacyWrite(t.dbf, t.key, target, { [t.mark.field]: mk2 });
    if (lw2.ok) {
      // 重灌期間每 0.5 秒有一個人開小表畫面，記下最慢的一次
      let done = false;
      const big = api('GET', t.listPath(ctx)).then((r) => { done = true; return r; });
      const smalls = [];
      while (!done) {
        await sleep(500);
        if (done) break;
        smalls.push(await api('GET', SMALL_READ));
      }
      const bigRes = await big;
      const s = summarize(smalls);
      sum.blockedSmallMs = s.max;
      report(tag, s.errors ? 'FAIL' : s.max > SLOW_P95_MS ? 'WARN' : 'INFO', `重灌 ${t.dbf} 期間開會計師清單最慢 ${fmtMs(s.max)} (平常 ${fmtMs(smallBaseline)})`, [
        `重灌那個請求 ${fmtMs(bigRes.ms)}；期間開了 ${s.n} 次會計師清單，p50 ${fmtMs(s.p50)}、錯誤 ${s.errors}`,
        '會計師清單只有幾筆，慢的部分是排在 LocalAgent 隊列裡，等 VFP 產生大表的重灌腳本',
      ]);
    }
  }

  // 存完再開清單：比沒有變動時慢很多，表示存檔後的 checksum 沒有記上，被當成外部修改而整表重灌
  const isReload = (ms) => ms > Math.max(warmS.p50 * 3, warmS.p50 + 1000);

  // 9. 網頁存檔：LocalAgent 讀寫入前後的整個 DBF 比對；存完再開清單應不需重灌
  if (t.write && target) {
    await drainAgent(tag);
    const ws = [];
    for (let i = 0; i < 3; i++) ws.push(await t.write(target, marker('WB', t.mark.width), ctx));
    const wsS = summarize(ws);
    const after = await api('GET', t.listPath(ctx));
    Object.assign(sum, { writeMs: wsS.p50, afterWriteMs: after.ms });
    const reloaded = isReload(after.ms);
    report(tag, wsS.errors || !after.ok ? 'FAIL' : wsS.p50 > SLOW_P95_MS || reloaded ? 'WARN' : 'PASS', `網頁存一筆 ${fmtMs(wsS.p50)}`, [
      `存完後開清單 ${fmtMs(after.ms)}${reloaded ? '：比沒有變動時慢很多，存檔後的 checksum 沒有記上，被當成外部修改而整表重灌' : ''}`,
      ...(wsS.errors ? [errorSample(ws)] : []),
    ]);
  }

  // 10. 多人同時存檔：每人改不同的一筆，連做幾輪；每輪後開一次清單，看有沒有被當成外部修改而整表重灌
  const writers = targets.slice(Math.max(0, targets.length - 1 - BURST), -1);
  if (t.write && writers.length) {
    await drainAgent(tag);
    const saves = [];
    const walls = [];
    const afterMs = [];
    let reloads = 0;
    const last = new Map();
    for (let round = 0; round < WRITE_ROUNDS; round++) {
      const started = performance.now();
      const res = await Promise.all(writers.map((key, i) => {
        const value = userMarker('MW', i, t.mark.width);
        return t.write(key, value, ctx).then((r) => {
          if (r.ok) last.set(key, value);
          return r;
        });
      }));
      walls.push(performance.now() - started);
      saves.push(...res);
      const after = await api('GET', t.listPath(ctx));
      afterMs.push(after.ms);
      if (isReload(after.ms)) reloads++;
    }
    const s = summarize(saves);
    // 測完核對：清單 (PostgreSQL) 與 DBF 都要是每人最後一次存的值
    const list = await api('GET', t.listPath(ctx));
    const dbfRows = new Map(readActiveRows(dbfFile(t.dbf), { fields: [t.key, t.mark.field] }).map((r) => [trim(r[t.key]).toUpperCase(), trim(r[t.mark.field])]));
    const pgMiss = [...last].filter(([key, value]) => !hasMark(list, t, key, value));
    const dbfMiss = [...last].filter(([key, value]) => dbfRows.get(key.toUpperCase()) !== value);
    const maxWall = Math.max(...walls);
    Object.assign(sum, { multiWriteUsers: writers.length, multiWriteMs: maxWall, multiWriteReloads: reloads, multiWriteFail: s.errors + pgMiss.length + dbfMiss.length });
    const level = s.errors || pgMiss.length || dbfMiss.length ? 'FAIL' : reloads || maxWall > SLOW_P95_MS * 2 ? 'WARN' : 'PASS';
    report(tag, level, `${writers.length} 人同時存檔 ${WRITE_ROUNDS} 輪：每輪最慢 ${fmtMs(maxWall)}，存完後整表重灌 ${reloads} 次`, [
      `單次存檔 p50 ${fmtMs(s.p50)}、最慢 ${fmtMs(s.max)}、失敗 ${s.errors}；每輪全部存完 ${walls.map(fmtMs).join(' / ')}`,
      `每輪存完後開清單 ${afterMs.map(fmtMs).join(' / ')} (沒有變動時 ${fmtMs(warmS.p50)})`,
      ...(reloads ? ['同時存檔的請求提交 checksum 的順序和 LocalAgent 寫入的順序不同時，條件式 UPDATE 會失敗，下一個開畫面的人要等整表重灌'] : []),
      ...(pgMiss.length ? [`清單讀不到 ${pgMiss.length} 人最後存的值，例如 ${pgMiss[0][0]}`] : []),
      ...(dbfMiss.length ? [`DBF 裡沒有 ${dbfMiss.length} 人最後存的值，例如 ${dbfMiss[0][0]}`] : []),
      ...(s.errors ? [errorSample(saves)] : []),
    ]);
  }

  // 11. 跨畫面：收費單 (2040) 存檔時也會同步客戶表，客戶表剛被舊系統改過時，存一張收費單要等客戶表整表重灌
  if (t.crossWrite && crossCtx?.rno && target) {
    await drainAgent(tag);
    await api('GET', `/api/wbase2040/${encodeURIComponent(crossCtx.rno)}`); // 先讓收費單的快照與 DBF 一致
    const calm = await recmomWrite(crossCtx.rno, marker('XA', 10));
    const lw = await legacyWrite(t.dbf, t.key, target, { [t.mark.field]: marker('XL', t.mark.width) });
    if (lw.ok) {
      const hit = await recmomWrite(crossCtx.rno, marker('XB', 10));
      Object.assign(sum, { crossCalmMs: calm.ms, crossHitMs: hit.ms });
      const failed = [calm, hit].filter((r) => !r.ok);
      report(tag, failed.length ? 'FAIL' : hit.ms > 10000 ? 'WARN' : 'INFO', `客戶表剛被舊系統改過時，存一張收費單 ${fmtMs(hit.ms)} (客戶表沒變動時 ${fmtMs(calm.ms)})`, [
        `收費單 ${crossCtx.rno}；2040 存檔前會同步 recmom、recmod 與 customer，客戶表變動就要先整表重灌客戶`,
        ...(failed.length ? [errorSample(failed)] : []),
      ]);
    }
  }

  summaryRows.push(sum);
  return true;
}

// ---------------------------------------------------------------- 主程式
function summaryTable() {
  const head = '| 表 | 筆數 | DBF | checksum | 重灌腳本 | 重灌後開清單 | 沒變動開清單 | 多人 p95 | 舊系統改一筆後多人 | 重灌時開小表 | 網頁存一筆 | 多人同時存檔 | 客戶變動後存收費單 |';
  const sep = '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |';
  const cell = (v, f) => (v === undefined ? '-' : f(v));
  const multiWrite = (s) => {
    if (!s.multiWriteUsers) return '-';
    if (s.multiWriteFail) return `失敗 ${s.multiWriteFail}`;
    return `${s.multiWriteUsers} 人 ${fmtMs(s.multiWriteMs)}${s.multiWriteReloads ? `，重灌 ${s.multiWriteReloads} 次` : ''}`;
  };
  return [head, sep, ...summaryRows.map((s) => `| ${s.table} | ${s.active ?? s.rows} | ${cell(s.fileBytes, fmtBytes)} | ${cell(s.checksumMs, fmtMs)} | ${s.scriptOk === false ? '失敗' : cell(s.scriptBytes, fmtBytes)} | ${s.coldOk === false ? `失敗 (${cell(s.coldMs, fmtMs)})` : cell(s.coldMs, fmtMs)} | ${cell(s.warmMs, fmtMs)} | ${s.loadUsers ? `${s.loadUsers} 人 ${fmtMs(s.loadP95)}` : '-'} | ${s.churnFail ? `失敗 ${s.churnFail}` : cell(s.churnWallMs, fmtMs)} | ${cell(s.blockedSmallMs, fmtMs)} | ${cell(s.writeMs, fmtMs)} | ${multiWrite(s)} | ${cell(s.crossHitMs, fmtMs)} |`)];
}

function writeReport(meta) {
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const jsonPath = path.join(OUT_DIR, `large-${stamp}.json`);
  const mdPath = path.join(OUT_DIR, `large-${stamp}.md`);
  writeFileSync(jsonPath, JSON.stringify({ meta, summary: summaryRows, results }, null, 2), 'utf8');
  const md = [
    `# Wx3000 大量資料壓力測試結果 ${meta.startedAt}`,
    '',
    `- 後端：${meta.api}；LocalAgent：${meta.agent}；測試磁碟機：${meta.drive}:`,
    `- 筆數級距：${meta.rows.join(', ')}；資料表：${meta.tables.join(', ')}；多人讀取：${meta.users.join(', ')} 人各 ${meta.duration} 秒；同時開畫面：${meta.burst} 人`,
    '',
    ...summaryTable(),
    '',
    ...results.flatMap((r) => [`## ${r.status} ${r.scenario}：${r.title}`, '', ...r.details.map((d) => `- ${d}`), '']),
  ].join('\n');
  writeFileSync(mdPath, md, 'utf8');
  return mdPath;
}

async function main() {
  const unknown = TABLE_NAMES.filter((n) => !TABLES[n]);
  if (unknown.length) fatal(`未知的資料表：${unknown.join(', ')}；可用：${Object.keys(TABLES).join(', ')}`);
  if (!ROW_LEVELS.length) fatal('請用 --rows 指定筆數級距，例如 --rows 10000,30000');

  await guard();
  const meta = {
    startedAt: new Date().toLocaleString('zh-TW', { hour12: false }),
    api: API, agent: AGENT, drive: DRIVE, rows: ROW_LEVELS, tables: TABLE_NAMES, users: USERS, duration: DURATION, burst: BURST,
  };
  console.log(`Wx3000 大量資料壓力測試：後端 ${API}，LocalAgent ${AGENT}，測試資料 ${DBF_DIR}`);
  console.log(`資料表：${TABLE_NAMES.join(', ')}；筆數：${ROW_LEVELS.join(', ')}\n`);

  // 小表讀取的平常時間 (對照第 8 項)
  await api('GET', SMALL_READ);
  const base = [];
  for (let i = 0; i < 3; i++) base.push(await api('GET', SMALL_READ));
  const smallBaseline = summarize(base).p50;

  // 跨畫面測試用的收費單：挑一張未收款的 (已收款的不能改表頭)
  const crossRno = readActiveRows(dbfFile('recmom'), { fields: TABLES.recmom.fields })
    .find((r) => trim(r.rno) && TABLES.recmom.writable(r));
  const crossCtx = crossRno ? { rno: trim(crossRno.rno) } : null;

  for (const name of TABLE_NAMES) {
    const t = TABLES[name];
    try {
      const rows = readActiveRows(dbfFile(t.dbf), { fields: t.fields });
      const ctx = t.setup ? t.setup(rows) : {};
      if (!ctx) { report(t.dbf, 'WARN', `${t.dbf}.dbf 沒有可用的資料，略過`); continue; }
      await drainAgent(t.dbf);
      for (const ep of t.prime || []) {
        const p = await api('GET', ep);
        if (!p.ok) report(t.dbf, 'WARN', `預先開啟 ${ep} 失敗`, [errorSample([p])]);
      }
      // 先讓快照與 DBF 一致，之後每一級的第一次讀取都是「DBF 變了」的重灌
      await api('GET', t.listPath(ctx));
      for (let i = 0; i < ROW_LEVELS.length; i++) {
        const n = ROW_LEVELS[i];
        if (n <= rows.length) { report(`${t.dbf}@${n}`, 'INFO', `DBF 已有 ${rows.length} 筆，略過這一級`); continue; }
        if (!(await runLevel(t, n, ctx, smallBaseline, crossCtx))) {
          const rest = ROW_LEVELS.slice(i + 1);
          if (rest.length) report(`${t.dbf}@${rest.join(',')}`, 'INFO', `${n} 筆時已同步不了，略過更大的級距`);
          break;
        }
      }
    } catch (err) {
      report(t.dbf, 'FAIL', `測試程式執行失敗：${err.message}`);
    }
  }

  console.log(`\n${summaryTable().join('\n')}`);
  const mdPath = writeReport(meta);
  const counts = ['PASS', 'WARN', 'FAIL', 'INFO'].map((s) => `${s} ${results.filter((r) => r.status === s).length}`).join('、');
  console.log(`\n結果：${counts}\n報告：${mdPath}`);
  keepAlive.destroy();
  process.exitCode = results.some((r) => r.status === 'FAIL') ? 1 : 0;
}

main();
